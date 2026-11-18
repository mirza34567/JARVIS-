import { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calculator,
  Check,
  Code2,
  Copy,
  FileText,
  Languages,
  Lightbulb,
  Loader2,
  Paperclip,
  PenTool,
  Play,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { FileAttachment, JarvisSettings, ToolId } from '../types/jarvis';
import { streamToolRun } from '../utils/sseClient';
import { formatBytes, processUploadedFile } from '../utils/storage';

interface ToolsViewProps {
  settings: JarvisSettings;
  activeTool: ToolId;
  onSelectTool: (id: ToolId) => void;
}

interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  icon: typeof Code2;
  placeholder: string;
  options: Array<{
    key: string;
    label: string;
    choices: string[];
    defaultValue: string;
  }>;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'code',
    name: 'AI Code Assistant',
    description: 'Generate, debug, refactor, or explain production code across languages.',
    icon: Code2,
    placeholder: 'Paste code to debug/refactor or describe the function/module you want built...',
    options: [
      { key: 'mode', label: 'Mode', choices: ['Generate', 'Debug', 'Refactor', 'Explain'], defaultValue: 'Generate' },
      { key: 'language', label: 'Language', choices: ['Auto-detect', 'TypeScript', 'Python', 'Rust', 'Go', 'SQL'], defaultValue: 'TypeScript' },
    ],
  },
  {
    id: 'writing',
    name: 'AI Writing Assistant',
    description: 'Draft, polish, or rewrite articles, emails, proposals, and documentation.',
    icon: PenTool,
    placeholder: 'Enter your topic, rough draft, or text to improve...',
    options: [
      { key: 'mode', label: 'Task', choices: ['Draft', 'Polish & Edit', 'Rewrite', 'Expand'], defaultValue: 'Draft' },
      { key: 'tone', label: 'Tone', choices: ['Professional', 'Executive', 'Friendly', 'Academic', 'Persuasive'], defaultValue: 'Professional' },
      { key: 'format', label: 'Format', choices: ['Article / Prose', 'Email', 'Proposal', 'Technical Docs'], defaultValue: 'Article / Prose' },
    ],
  },
  {
    id: 'translator',
    name: 'AI Translator',
    description: 'Accurate, context-aware translation preserving nuance and formatting.',
    icon: Languages,
    placeholder: 'Paste text or attach a document to translate...',
    options: [
      { key: 'sourceLang', label: 'From', choices: ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Hindi'], defaultValue: 'Auto-detect' },
      { key: 'targetLang', label: 'To', choices: ['Spanish', 'English', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Hindi'], defaultValue: 'Spanish' },
      { key: 'tone', label: 'Register', choices: ['Natural', 'Formal', 'Technical', 'Casual'], defaultValue: 'Natural' },
    ],
  },
  {
    id: 'summarizer',
    name: 'AI Summarizer',
    description: 'Distill long documents, PDFs, transcripts, or articles into key points.',
    icon: FileText,
    placeholder: 'Paste long text or attach a PDF / text document to summarize...',
    options: [
      { key: 'format', label: 'Format', choices: ['Executive Brief & Bullets', 'Action Items', 'TL;DR One Paragraph', 'Key Takeaways'], defaultValue: 'Executive Brief & Bullets' },
      { key: 'length', label: 'Detail', choices: ['Short', 'Medium', 'Detailed'], defaultValue: 'Medium' },
    ],
  },
  {
    id: 'study',
    name: 'AI Study Assistant',
    description: 'Concept breakdowns, active recall flashcards, and practice quizzes.',
    icon: BookOpen,
    placeholder: 'Enter a topic, syllabus excerpt, or attach study notes...',
    options: [
      { key: 'mode', label: 'Study Mode', choices: ['Concept Breakdown', 'Flashcards (Q&A)', 'Practice Quiz', 'ELI5 Intuition'], defaultValue: 'Concept Breakdown' },
      { key: 'level', label: 'Level', choices: ['Beginner', 'Intermediate', 'University / Advanced'], defaultValue: 'Intermediate' },
    ],
  },
  {
    id: 'brainstorm',
    name: 'AI Brainstorming',
    description: 'Generate structured ideas, trade-offs, and actionable execution plans.',
    icon: Lightbulb,
    placeholder: 'Describe your goal, product challenge, or creative prompt...',
    options: [
      { key: 'mode', label: 'Framework', choices: ['Divergent Ideas & Trade-offs', 'First-Principles Breakdown', 'Execution Roadmap', 'Risk & Edge-Case Analysis'], defaultValue: 'Divergent Ideas & Trade-offs' },
    ],
  },
  {
    id: 'math',
    name: 'AI Math Assistant',
    description: 'Step-by-step derivations, proofs, calculus, linear algebra, and verification.',
    icon: Calculator,
    placeholder: 'Type an equation, word problem, or upload an image of a math problem...',
    options: [
      { key: 'mode', label: 'Output Style', choices: ['Step-by-Step Solution', 'Verify My Work', 'Concept & Formula Guide'], defaultValue: 'Step-by-Step Solution' },
    ],
  },
  {
    id: 'developer',
    name: 'AI Developer Assistant',
    description: 'System architecture, API contracts, database schemas, and regex builders.',
    icon: Terminal,
    placeholder: 'Describe your architecture goal, API spec, schema problem, or regex need...',
    options: [
      { key: 'mode', label: 'Focus', choices: ['Architecture & API Design', 'Database Schema & Queries', 'Security & Threat Review', 'Regex & CLI Helper'], defaultValue: 'Architecture & API Design' },
    ],
  },
];

export function ToolsView({ settings, activeTool, onSelectTool }: ToolsViewProps) {
  const tool = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [toolOptions, setToolOptions] = useState<Record<string, Record<string, string>>>({});
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentInput = inputs[tool.id] || '';
  const currentOpts: Record<string, string> = {};
  for (const opt of tool.options) {
    currentOpts[opt.key] = toolOptions[tool.id]?.[opt.key] || opt.defaultValue;
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= 3) {
        setUploadError('Maximum 3 attachments per tool run.');
        break;
      }
      try {
        const processed = await processUploadedFile(file);
        next.push(processed);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Unable to attach file.');
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    if (!currentInput.trim() && attachments.length === 0) {
      setError('Enter input text or attach a supported file first.');
      return;
    }

    setError(null);
    setOutput('');
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamToolRun(
      {
        toolId: tool.id,
        input: currentInput.trim(),
        options: currentOpts,
        attachments,
        model: settings.model,
      },
      {
        onChunk: (chunk) => {
          setOutput((prev) => prev + chunk);
        },
        onError: (msg) => {
          setError(msg);
          setRunning(false);
        },
        onDone: () => {
          setRunning(false);
        },
      },
      controller.signal
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          AI Tools Center
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Eight specialized Gemini-powered workspaces with multimodal attachment support.
        </p>
      </div>

      {/* Tool Selector Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === tool.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTool(item.id);
                setError(null);
              }}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                isActive
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'hud-accent-text' : 'text-slate-400'}`} />
              <span className="text-xs font-semibold leading-tight">
                {item.name.replace(/^AI\s+/, '')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tool Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Tool Input & Options */}
        <form
          onSubmit={handleRun}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 lg:col-span-5"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {tool.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tool.options.map((opt) => (
              <div key={opt.key}>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {opt.label}
                </label>
                <select
                  value={currentOpts[opt.key]}
                  onChange={(e) =>
                    setToolOptions((prev) => ({
                      ...prev,
                      [tool.id]: { ...prev[tool.id], [opt.key]: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {opt.choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Input Prompt / Source Material
            </label>
            <textarea
              rows={8}
              value={currentInput}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, [tool.id]: e.target.value }))
              }
              placeholder={tool.placeholder}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.py"
              onChange={(e) => void handleFiles(e.target.files)}
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>Attach Image / Doc</span>
              </button>
              <span className="font-mono text-[11px] text-slate-500">Model: {settings.model}</span>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-2 py-1 text-xs"
                  >
                    <span className="max-w-[130px] truncate">{att.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatBytes(att.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadError && (
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {running ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-500"
              >
                <Square className="h-4 w-4" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl hud-accent-bg px-4 py-2.5 text-sm font-medium text-slate-950 hover:opacity-90"
              >
                <Play className="h-4 w-4" />
                <span>Run {tool.name.replace(/^AI\s+/, '')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Right: Tool Output */}
        <section className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 lg:col-span-7 min-h-[420px]">
          <div className="mb-3 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Output Workspace
            </h3>
            <div className="flex items-center gap-2">
              {running && (
                <span className="inline-flex items-center gap-1.5 text-xs hud-accent-text">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Streaming...</span>
                </span>
              )}
              {output && (
                <button
                  type="button"
                  onClick={() => void handleCopyOutput()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {output ? (
              <MarkdownRenderer content={output} fontSize={settings.chatFontSize} />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Ready to run {tool.name}
                </p>
                <p className="mt-1 max-w-sm text-xs">
                  Configure your options on the left, enter input or attach a file, and click Run.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
