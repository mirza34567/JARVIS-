import { useRef, useState } from 'react';
import {
  ArrowRight,
  Brain,
  Code2,
  FileText,
  Globe,
  MessageSquare,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { JarvisCore } from './JarvisCore';
import type {
  ApiStatusState,
  Conversation,
  CoreState,
  FileAttachment,
  JarvisSettings,
  NavSection,
  ToolId,
} from '../types/jarvis';
import { formatBytes, processUploadedFile } from '../utils/storage';

interface DashboardViewProps {
  settings: JarvisSettings;
  coreState: CoreState;
  audioLevel: number;
  apiStatus: ApiStatusState;
  conversations: Conversation[];
  memoryCount: number;
  voiceSupported: boolean;
  onSubmitPrompt: (prompt: string, attachments?: FileAttachment[], useSearch?: boolean) => void;
  onNavigate: (section: NavSection) => void;
  onOpenTool: (toolId: ToolId) => void;
  onSelectConversation: (id: string) => void;
  onToggleListening: () => void;
}

export function DashboardView({
  settings,
  coreState,
  audioLevel,
  apiStatus,
  conversations,
  memoryCount,
  voiceSupported,
  onSubmitPrompt,
  onNavigate,
  onOpenTool,
  onSelectConversation,
  onToggleListening,
}: DashboardViewProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(settings.useWebSearchInChat);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const next: FileAttachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= 4) {
        setUploadError('Maximum 4 attachments per prompt.');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    onSubmitPrompt(input.trim(), attachments, useSearch);
    setInput('');
    setAttachments([]);
  };

  const recentConversations = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  const quickActions = [
    {
      title: 'Code Engineering',
      description: 'Debug, refactor, or scaffold TypeScript, Python, and full-stack APIs.',
      icon: Code2,
      action: () => onOpenTool('code'),
    },
    {
      title: 'Live Web Search',
      description: 'Retrieve verified web sources with AI-synthesized citations.',
      icon: Globe,
      action: () => onNavigate('search'),
    },
    {
      title: 'Document Summarizer',
      description: 'Upload PDFs, notes, or transcripts for structured briefs.',
      icon: FileText,
      action: () => onOpenTool('summarizer'),
    },
    {
      title: 'Brainstorming Studio',
      description: 'Explore product strategies, trade-offs, and action plans.',
      icon: Sparkles,
      action: () => onOpenTool('brainstorm'),
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 sm:p-6 lg:p-8">
      {/* Hero Core + Greeting + Primary Command Bar */}
      <section className="flex flex-col items-center rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white/75 dark:bg-[#0B101B]/85 px-5 py-8 sm:px-8">
        <JarvisCore
          state={coreState}
          size="lg"
          audioLevel={audioLevel}
          animationLevel={settings.animationLevel}
          assistantName={settings.assistantName}
          onClick={() => onNavigate('voice')}
        />

        <h1 className="mt-5 text-center font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl text-balance">
          {settings.greeting || `Good day. ${settings.assistantName} systems are online.`}
        </h1>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            AI API:{' '}
            <strong
              className={
                apiStatus.connected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : apiStatus.configured
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {apiStatus.connected
                ? 'Connected'
                : apiStatus.configured
                ? 'Configured (Needs Check)'
                : 'Key Not Set'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Model: <strong className="font-mono text-slate-700 dark:text-slate-200">{settings.model}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Memory:{' '}
            <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
              {settings.memoryEnabled ? `${memoryCount} active` : 'Paused'}
            </strong>
          </span>
        </div>

        {/* Main Command Input */}
        <form onSubmit={handleSubmit} className="mt-6 w-full max-w-2xl">
          {attachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  {att.previewUrl && (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="h-5 w-5 rounded object-cover"
                    />
                  )}
                  <span className="max-w-[140px] truncate font-medium text-slate-800 dark:text-slate-200">
                    {att.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {formatBytes(att.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
          )}

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-300 dark:border-slate-700/90 bg-white dark:bg-[#070B14] p-2 focus-within:border-cyan-500 transition-colors">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${settings.assistantName} anything, attach files, or issue a command...`}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.py"
                onChange={(e) => void handleFiles(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image or document"
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleListening}
                disabled={!voiceSupported}
                title={voiceSupported ? 'Voice input' : 'Voice recognition unsupported in this browser'}
                className={`rounded-xl p-2 transition-colors ${
                  coreState === 'listening'
                    ? 'bg-rose-500/20 text-rose-500'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl hud-accent-bg px-4 py-2 text-sm font-medium text-slate-950 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/70 px-3 pt-1.5 pb-0.5 text-xs text-slate-500 dark:text-slate-400">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-cyan-500"
                />
                <span>Include live Web Search grounding</span>
              </label>
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="inline-flex items-center gap-1 hud-accent-text hover:underline"
              >
                <span>Open Full Chat</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Quick Action Modules */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Quick Action Modules
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="text-xs font-medium hud-accent-text hover:underline"
          >
            View all 8 tools
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="group flex flex-col items-start rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-4 text-left hover:border-cyan-500/50 transition-colors"
              >
                <Icon className="h-5 w-5 hud-accent-text" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Conversations & Real System State */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Conversations
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium hud-accent-text hover:underline"
            >
              Manage history
            </button>
          </div>

          {recentConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                No conversations saved yet.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Send a prompt above to begin your first session with {settings.assistantName}.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {recentConversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {conv.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {conv.messages.length} messages · {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              System Readiness
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium hud-accent-text hover:underline"
            >
              Configure
            </button>
          </div>

          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Gemini AI Service</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {apiStatus.connected
                  ? 'Operational'
                  : apiStatus.configured
                  ? 'Configured'
                  : 'Secret Required'}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Firebase Cloud Sync</dt>
              <dd className="font-medium text-slate-600 dark:text-slate-300">
                Not Configured (Local Storage Active)
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Browser Voice Input</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {voiceSupported ? 'Available' : 'Unsupported'}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Web Search Grounding</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {apiStatus.configured ? 'Available via Gemini' : 'Requires Gemini Key'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                <span>Long-Term Memory</span>
              </dt>
              <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {settings.memoryEnabled ? `${memoryCount} entries` : 'Disabled'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
