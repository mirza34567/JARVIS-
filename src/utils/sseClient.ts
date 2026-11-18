import type { FileAttachment, SearchSource } from '../types/jarvis';

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onGrounding?: (sources: SearchSource[], queries: string[]) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

async function consumeSseResponse(response: Response, handlers: StreamHandlers): Promise<void> {
  if (!response.ok) {
    let errMessage = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) errMessage = data.error;
    } catch {
      // Fallback to status message
    }
    handlers.onError(errMessage);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('Streaming is unavailable in this browser.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let receivedDoneOrError = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as {
              type: 'chunk' | 'grounding' | 'done' | 'error';
              text?: string;
              sources?: SearchSource[];
              queries?: string[];
              message?: string;
            };
            if (event.type === 'chunk' && event.text) {
              handlers.onChunk(event.text);
            } else if (event.type === 'grounding' && handlers.onGrounding) {
              handlers.onGrounding(event.sources || [], event.queries || []);
            } else if (event.type === 'error') {
              receivedDoneOrError = true;
              handlers.onError(event.message || 'Unknown error from Gemini.');
              return;
            } else if (event.type === 'done') {
              receivedDoneOrError = true;
              handlers.onDone();
              return;
            }
          } catch {
            // Skip malformed SSE line
          }
        }
      }
    }

    if (!receivedDoneOrError) {
      handlers.onDone();
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
    handlers.onError(err instanceof Error ? err.message : 'Stream connection interrupted.');
  }
}

export async function streamGeminiChat(
  payload: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      attachments?: FileAttachment[];
    }>;
    model: string;
    assistantName: string;
    thinkingDepth: string;
    responseStyle: string;
    maxResponseNote: string;
    memories: Array<{ category: string; content: string }>;
    useWebSearch: boolean;
    language: string;
  },
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    await consumeSseResponse(response, handlers);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
    handlers.onError(err instanceof Error ? err.message : 'Network error connecting to JARVIS backend.');
  }
}

export async function streamToolRun(
  payload: {
    toolId: string;
    input: string;
    options?: Record<string, string>;
    attachments?: FileAttachment[];
    model: string;
  },
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch('/api/tools/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    await consumeSseResponse(response, handlers);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
    handlers.onError(err instanceof Error ? err.message : 'Network error running tool.');
  }
}
