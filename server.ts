import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Curated active Gemini models per SDK specification (excluding deprecated 1.5/2.0 models)
const CURATED_MODELS = [
  {
    id: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    description: 'Fast, high-intelligence model for everyday tasks, coding, research, and multimodal analysis.',
    tier: 'standard' as const,
    supportsThinking: true,
    supportsXHigh: true,
    isDefault: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-low-latency model optimized for rapid responses and lightweight tasks.',
    tier: 'standard' as const,
    supportsThinking: true,
    supportsXHigh: false,
  },
  {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    description: 'Advanced reasoning model for complex STEM, software architecture, and multi-step logic (requires paid API key).',
    tier: 'paid' as const,
    supportsThinking: true,
    supportsXHigh: false,
  },
  {
    id: 'gemini-4-carbon',
    displayName: 'Gemini 4 Carbon',
    description: 'Deep reasoning model for root-cause debugging, scientific proofs, and security auditing (requires paid API key).',
    tier: 'paid' as const,
    supportsThinking: true,
    supportsXHigh: false,
  },
];

const DEPRECATED_PATTERNS = [
  'gemini-1.0',
  'gemini-1.5',
  'gemini-2.0',
  'gemini-pro',
  'embedding',
  'aqa',
  'imagen',
  'veo',
  'lyria',
  'tts',
  'transcribe',
  'live',
  'decision',
  'image',
];

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Simple sliding-window rate limiter for API routes
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'local';
    const now = Date.now();
    const history = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (history.length >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please pause briefly before sending another request.',
      });
      return;
    }
    history.push(now);
    rateBuckets.set(key, history);
    next();
  };
}

function mapThinkingLevel(model: string, depth?: string): ThinkingLevel | undefined {
  if (!model.startsWith('gemini-3') && !model.startsWith('gemini-4')) {
    return undefined;
  }
  switch (depth) {
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'XHIGH':
      return model === 'gemini-4-hydrogen' ? ThinkingLevel.XHIGH : ThinkingLevel.HIGH;
    case 'HIGH':
    default:
      return ThinkingLevel.HIGH;
  }
}

function extractReadableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      // Handle double-encoded JSON error message from SDK
      try {
        const inner = JSON.parse(parsed.error.message) as { error?: { message?: string } };
        if (inner?.error?.message) return inner.error.message;
      } catch {
        // Not double-encoded
      }
      return parsed.error.message;
    }
  } catch {
    // Not JSON
  }
  return raw;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const readable = extractReadableError(raw);
  const lower = readable.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('401')) {
    return {
      status: 400,
      message: 'The configured Gemini API key appears invalid. Verify your GEMINI_API_KEY in AI Studio Settings > Secrets.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403') || lower.includes('free tier is not available')) {
    return {
      status: 403,
      message: `${readable} Please select or update your GEMINI_API_KEY in AI Studio Settings > Secrets.`,
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API quota exceeded (429). Check your quota or select a billing-enabled key in AI Studio Settings > Secrets.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Requested Gemini model was not found or is unsupported. Try switching to Gemini 4 Hydrogen in Settings.',
    };
  }
  return {
    status: 500,
    message: readable || 'An unexpected error occurred while communicating with Gemini.',
  };
}

const DEFAULT_JARVIS_INSTRUCTION =
  'You are JARVIS, a highly capable AI personal assistant. Communicate clearly, intelligently, politely and professionally. Help users with technology, programming, education, research, writing, planning and general questions. Understand context and respond naturally. Do not claim to have performed actions you have not actually completed. When tools are available, use them only within their actual capabilities and permissions. Be transparent about limitations. Prioritize accuracy, user privacy and safety.';

interface IncomingAttachment {
  name: string;
  mimeType: string;
  kind: 'image' | 'document' | 'text';
  base64Data?: string;
  textContent?: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

function buildGeminiContents(messages: IncomingMessage[]) {
  const ALLOWED_INLINE_MIMES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]);

  return messages.map((msg) => {
    const parts: Array<Record<string, unknown>> = [];

    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const att of msg.attachments.slice(0, 4)) {
        if (att.kind === 'text' && typeof att.textContent === 'string') {
          parts.push({
            text: `[Attached File: ${att.name} (${att.mimeType})]\n\`\`\`\n${att.textContent.slice(0, 40000)}\n\`\`\``,
          });
        } else if (
          att.base64Data &&
          ALLOWED_INLINE_MIMES.has(att.mimeType) &&
          att.base64Data.length < 12 * 1024 * 1024
        ) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        }
      }
    }

    if (msg.content && msg.content.trim().length > 0) {
      parts.push({ text: msg.content });
    } else if (parts.length === 0) {
      parts.push({ text: 'Please analyze the attached content.' });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

function extractGroundingSources(groundingMetadata: unknown) {
  const meta = groundingMetadata as
    | {
        webSearchQueries?: string[];
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        groundingSupports?: Array<{
          segment?: { text?: string };
          groundingChunkIndices?: number[];
        }>;
      }
    | undefined;

  if (!meta) {
    return { sources: [], queries: [] };
  }

  const queries = Array.isArray(meta.webSearchQueries) ? meta.webSearchQueries : [];
  const chunks = Array.isArray(meta.groundingChunks) ? meta.groundingChunks : [];
  const supports = Array.isArray(meta.groundingSupports) ? meta.groundingSupports : [];

  const snippetsByIndex = new Map<number, string[]>();
  for (const sup of supports) {
    const text = sup.segment?.text?.trim();
    if (!text || !Array.isArray(sup.groundingChunkIndices)) continue;
    for (const idx of sup.groundingChunkIndices) {
      const list = snippetsByIndex.get(idx) || [];
      if (list.length < 2) {
        list.push(text);
        snippetsByIndex.set(idx, list);
      }
    }
  }

  const seenUris = new Set<string>();
  const sources: Array<{ title: string; uri: string; domain: string; snippet?: string }> = [];

  chunks.forEach((chunk, idx) => {
    const uri = chunk.web?.uri;
    if (!uri || seenUris.has(uri)) return;
    seenUris.add(uri);
    let domain = 'web';
    try {
      domain = new URL(uri).hostname.replace(/^www\./, '');
    } catch {
      domain = 'source';
    }
    const snippetParts = snippetsByIndex.get(idx);
    sources.push({
      title: chunk.web?.title || domain,
      uri,
      domain,
      snippet: snippetParts ? snippetParts.join(' ') : undefined,
    });
  });

  return { sources, queries };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));
  app.use('/api', rateLimit(90, 60_000));

  // 1. Check Gemini configuration & live connectivity
  app.get('/api/gemini/status', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.json({
        configured: false,
        connected: false,
        latencyMs: null,
        error: 'GEMINI_API_KEY is not configured in server environment secrets.',
      });
      return;
    }

    const verify = req.query.verify === 'true';
    if (!verify) {
      res.json({
        configured: true,
        connected: true,
        latencyMs: null,
        error: null,
      });
      return;
    }

    const startedAt = Date.now();
    try {
      await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: 'Reply with OK.',
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({
        configured: true,
        connected: true,
        latencyMs: Date.now() - startedAt,
        error: null,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(200).json({
        configured: true,
        connected: false,
        latencyMs: Date.now() - startedAt,
        error: formatted.message,
      });
    }
  });

  // 2. Fetch supported models from Gemini API + curated active models
  app.get('/api/gemini/models', async (_req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.json({
        configured: false,
        models: CURATED_MODELS,
        fetchedFromApi: false,
      });
      return;
    }

    try {
      const pager = await ai.models.list({ config: { pageSize: 50 } });
      const apiModels: Array<{
        id: string;
        displayName: string;
        description: string;
        tier: 'standard' | 'paid';
        supportsThinking: boolean;
        supportsXHigh: boolean;
        isDefault?: boolean;
      }> = [...CURATED_MODELS];

      const knownIds = new Set(CURATED_MODELS.map((m) => m.id));

      for await (const model of pager) {
        const rawName = (model.name || '').replace(/^models\//, '');
        if (!rawName || knownIds.has(rawName)) continue;

        const lower = rawName.toLowerCase();
        const isDeprecatedOrSpecialty = DEPRECATED_PATTERNS.some((pat) => lower.includes(pat));
        const supportsGenerate =
          !model.supportedActions ||
          model.supportedActions.includes('generateContent');

        if (!isDeprecatedOrSpecialty && supportsGenerate && lower.startsWith('gemini')) {
          knownIds.add(rawName);
          apiModels.push({
            id: rawName,
            displayName: model.displayName || rawName,
            description: model.description || 'Supported Gemini generative model returned by API.',
            tier: lower.includes('pro') || lower.includes('argon') || lower.includes('carbon') ? 'paid' : 'standard',
            supportsThinking: lower.includes('gemini-3') || lower.includes('gemini-4') || lower.includes('2.5'),
            supportsXHigh: rawName === 'gemini-4-hydrogen',
          });
        }
      }

      res.json({
        configured: true,
        models: apiModels,
        fetchedFromApi: true,
      });
    } catch {
      res.json({
        configured: true,
        models: CURATED_MODELS,
        fetchedFromApi: false,
      });
    }
  });

  // 3. Streaming AI Chat endpoint (SSE)
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment secrets. Add it in Settings > Secrets.',
      });
      return;
    }

    const {
      messages,
      model = 'gemini-4-hydrogen',
      assistantName = 'JARVIS',
      thinkingDepth = 'HIGH',
      responseStyle = 'balanced',
      maxResponseNote = 'auto',
      memories = [],
      useWebSearch = false,
      language = 'English',
    } = req.body as {
      messages: IncomingMessage[];
      model?: string;
      assistantName?: string;
      thinkingDepth?: string;
      responseStyle?: string;
      maxResponseNote?: string;
      memories?: Array<{ category: string; content: string }>;
      useWebSearch?: boolean;
      language?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let aborted = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        aborted = true;
      }
    });

    const sendEvent = (payload: Record<string, unknown>) => {
      if (!aborted && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const styleDirectives: Record<string, string> = {
        concise: 'Keep responses crisp, direct, and concise unless detail is explicitly requested.',
        balanced: 'Provide clear, well-structured, balanced explanations with practical examples when helpful.',
        detailed: 'Provide thorough, comprehensive technical depth and structured breakdowns.',
      };

      const lengthDirectives: Record<string, string> = {
        auto: '',
        brief: 'Target a brief response (under ~150 words unless code requires more).',
        standard: 'Target a moderate response length.',
        comprehensive: 'Do not abbreviate complex answers; cover edge cases and nuances thoroughly.',
      };

      const memoryBlock =
        Array.isArray(memories) && memories.length > 0
          ? `\n\nUser-Approved Long-Term Memories (use when relevant, do not fabricate additional facts):\n${memories
              .slice(0, 25)
              .map((m) => `- [${m.category}] ${m.content}`)
              .join('\n')}`
          : '';

      const systemInstruction = [
        DEFAULT_JARVIS_INSTRUCTION.replace('You are JARVIS', `You are ${assistantName || 'JARVIS'}`),
        `Respond primarily in ${language} unless the user writes or requests another language.`,
        styleDirectives[responseStyle] || styleDirectives.balanced,
        lengthDirectives[maxResponseNote] || '',
        memoryBlock,
      ]
        .filter(Boolean)
        .join('\n');

      const contents = buildGeminiContents(messages.slice(-24));
      const thinkingLevel = mapThinkingLevel(model, thinkingDepth);

      const config: Record<string, unknown> = {
        systemInstruction,
      };

      if (thinkingLevel) {
        config.thinkingConfig = { thinkingLevel };
      }

      if (useWebSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config,
      });

      let collectedSources: Array<{ title: string; uri: string; domain: string; snippet?: string }> = [];
      let collectedQueries: string[] = [];

      for await (const chunk of stream) {
        if (aborted) break;
        if (chunk.text) {
          sendEvent({ type: 'chunk', text: chunk.text });
        }
        const groundingMeta = chunk.candidates?.[0]?.groundingMetadata;
        if (groundingMeta) {
          const extracted = extractGroundingSources(groundingMeta);
          if (extracted.sources.length > 0) {
            collectedSources = extracted.sources;
          }
          if (extracted.queries.length > 0) {
            collectedQueries = extracted.queries;
          }
        }
      }

      if (collectedSources.length > 0 || collectedQueries.length > 0) {
        sendEvent({
          type: 'grounding',
          sources: collectedSources,
          queries: collectedQueries,
        });
      }

      sendEvent({ type: 'done' });
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendEvent({ type: 'error', message: formatted.message });
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // 4. Real Web Search via Gemini Google Search Grounding
  app.post('/api/search', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment secrets.',
      });
      return;
    }

    const { query, model = 'gemini-4-hydrogen', depth = 'standard' } = req.body as {
      query?: string;
      model?: string;
      depth?: 'quick' | 'standard' | 'deep';
    };

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'A search query is required.' });
      return;
    }

    try {
      const prompt =
        depth === 'quick'
          ? `Search the web and provide a concise, factual briefing answering: ${query.trim()}`
          : depth === 'deep'
          ? `Perform a comprehensive web search and synthesize key findings, dates, specifications, and differing viewpoints for: ${query.trim()}`
          : `Search the web and provide an accurate, well-organized summary with key facts for: ${query.trim()}`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'You are JARVIS Web Intelligence. Answer strictly based on live Google Search grounding results. Cite facts clearly and transparently note if information is unavailable.',
          tools: [{ googleSearch: {} }],
        },
      });

      const groundingMeta = response.candidates?.[0]?.groundingMetadata;
      const { sources, queries } = extractGroundingSources(groundingMeta);

      res.json({
        query: query.trim(),
        summary: response.text || 'No summary returned for this query.',
        sources,
        queries,
        model,
        timestamp: Date.now(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Specialized AI Tools Center endpoint (SSE streaming)
  app.post('/api/tools/run', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment secrets.',
      });
      return;
    }

    const {
      toolId,
      input,
      options = {},
      attachments = [],
      model = 'gemini-4-hydrogen',
    } = req.body as {
      toolId: string;
      input: string;
      options?: Record<string, string>;
      attachments?: IncomingAttachment[];
      model?: string;
    };

    if ((!input || !input.trim()) && (!attachments || attachments.length === 0)) {
      res.status(400).json({ error: 'Input text or an attachment is required to run this tool.' });
      return;
    }

    const toolInstructions: Record<string, string> = {
      code: `You are JARVIS Code Assistant. Mode: ${options.mode || 'Generate'}. Target Language: ${options.language || 'Auto-detect'}. Deliver clean, production-quality, well-commented code with complexity/edge-case notes.`,
      writing: `You are JARVIS Writing Assistant. Task: ${options.mode || 'Draft'}. Tone: ${options.tone || 'Professional'}. Format: ${options.format || 'Article / Prose'}. Produce polished, natural writing.`,
      translator: `You are JARVIS Translator. Source Language: ${options.sourceLang || 'Auto-detect'}. Target Language: ${options.targetLang || 'Spanish'}. Tone: ${options.tone || 'Natural'}. Provide an accurate translation plus brief cultural/idiomatic notes when relevant.`,
      summarizer: `You are JARVIS Summarizer. Format: ${options.format || 'Executive Brief & Bullet Points'}. Length: ${options.length || 'Medium'}. Distill key arguments, facts, and action items accurately without inventing details.`,
      study: `You are JARVIS Study Assistant. Mode: ${options.mode || 'Concept Breakdown'}. Level: ${options.level || 'Intermediate'}. Teach clearly using analogies, structured steps, and active recall questions.`,
      brainstorm: `You are JARVIS Brainstorming Partner. Framework: ${options.mode || 'Divergent Ideas & Trade-offs'}. Generate distinct, actionable ideas with feasibility considerations and next steps.`,
      math: `You are JARVIS Math Assistant. Mode: ${options.mode || 'Step-by-Step Solution'}. Show exact algebraic/logical steps clearly, state formulas used, and verify the final result.`,
      developer: `You are JARVIS Developer Architect. Focus: ${options.mode || 'Architecture & API Design'}. Provide pragmatic engineering guidance, schemas, failure modes, and security considerations.`,
    };

    const systemInstruction = toolInstructions[toolId];
    if (!systemInstruction) {
      res.status(400).json({ error: 'Unknown tool requested.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let aborted = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        aborted = true;
      }
    });

    const sendEvent = (payload: Record<string, unknown>) => {
      if (!aborted && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const contents = buildGeminiContents([
        {
          role: 'user',
          content: input || 'Analyze the attached file.',
          attachments,
        },
      ]);

      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of stream) {
        if (aborted) break;
        if (chunk.text) {
          sendEvent({ type: 'chunk', text: chunk.text });
        }
      }

      sendEvent({ type: 'done' });
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendEvent({ type: 'error', message: formatted.message });
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Frontend serving: Vite middleware in dev, dist/ static files in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start JARVIS AI server:', err);
  process.exit(1);
});
