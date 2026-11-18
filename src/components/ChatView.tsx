import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type {
  ChatMessage,
  Conversation,
  FileAttachment,
  JarvisSettings,
} from '../types/jarvis';
import { formatBytes, processUploadedFile } from '../utils/storage';

interface ChatViewProps {
  conversation: Conversation | null;
  settings: JarvisSettings;
  isGenerating: boolean;
  voiceSupported: boolean;
  synthesisSupported: boolean;
  isListening: boolean;
  onSendMessage: (text: string, attachments: FileAttachment[], useWebSearch: boolean) => void;
  onStopGenerating: () => void;
  onRegenerate: () => void;
  onRetryLast: () => void;
  onEditAndResend: (messageId: string, newText: string) => void;
  onNewConversation: () => void;
  onClearConversation: () => void;
  onToggleListening: () => void;
  onSpeakText: (text: string) => void;
  onSaveMemory: (content: string) => { ok: boolean; error?: string };
}

export function ChatView({
  conversation,
  settings,
  isGenerating,
  voiceSupported,
  synthesisSupported,
  isListening,
  onSendMessage,
  onStopGenerating,
  onRegenerate,
  onRetryLast,
  onEditAndResend,
  onNewConversation,
  onClearConversation,
  onToggleListening,
  onSpeakText,
  onSaveMemory,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(settings.useWebSearchInChat);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedMemId, setSavedMemId] = useState<string | null>(null);
  const [memNotice, setMemNotice] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = conversation?.messages || [];

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= 4) {
        setUploadError('Maximum 4 attachments allowed per message.');
        break;
      }
      try {
        const processed = await processUploadedFile(file);
        next.push(processed);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'File upload failed.');
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;
    if (!input.trim() && attachments.length === 0) return;
    onSendMessage(input.trim(), attachments, useSearch);
    setInput('');
    setAttachments([]);
    setUploadError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard blocked
    }
  };

  const handleSaveToMemory = (msg: ChatMessage) => {
    const snippet = msg.content.slice(0, 420).trim();
    const res = onSaveMemory(snippet);
    if (res.ok) {
      setSavedMemId(msg.id);
      setMemNotice(null);
      setTimeout(() => setSavedMemId(null), 2000);
    } else {
      setMemNotice(res.error || 'Could not save memory.');
    }
  };

  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const lastAssistantId =
    lastAssistantIdx >= 0 ? messages[messages.length - 1 - lastAssistantIdx]?.id : null;

  return (
    <div className="flex h-full flex-col">
      {/* Chat Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-[#080C15]/80 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {conversation?.title || 'New Conversation'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {messages.length} messages · {settings.model}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSearchBar((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showSearchBar
                ? 'border-cyan-500/50 bg-cyan-500/10 hud-accent-text'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Find</span>
          </button>

          <button
            type="button"
            onClick={onNewConversation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>

          {messages.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearConversation();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-rose-500/40 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Inline Chat Search */}
      {showSearchBar && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-4 py-2 sm:px-6">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages in this conversation..."
            className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {memNotice && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 sm:mx-6">
          <span>{memNotice}</span>
          <button type="button" onClick={() => setMemNotice(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 py-14 px-6 text-center">
              <p className="font-display text-lg font-medium text-slate-900 dark:text-slate-100">
                {searchQuery
                  ? 'No messages match your search.'
                  : `${settings.assistantName} is ready.`}
              </p>
              <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? 'Try a different keyword or clear the search filter.'
                  : 'Ask questions about engineering, architecture, science, writing, or attach images, PDFs, and code files for multimodal analysis.'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const isEditing = editingMsgId === msg.id;

              return (
                <article
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`w-full rounded-2xl border px-4 py-3.5 sm:px-5 ${
                      isUser
                        ? 'max-w-[88%] border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0B101B]/90'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {isUser ? 'You' : settings.assistantName}
                        </span>
                        {!isUser && msg.model && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px]">{msg.model}</span>
                          </>
                        )}
                      </div>
                      <span className="font-mono text-[11px] tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2 text-xs"
                          >
                            {att.previewUrl ? (
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                className="h-12 w-12 rounded object-cover"
                              />
                            ) : (
                              <FileText className="h-4 w-4 hud-accent-text" />
                            )}
                            <div>
                              <p className="max-w-[160px] truncate font-medium text-slate-800 dark:text-slate-200">
                                {att.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-500">
                                {formatBytes(att.size)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message Content or Inline Edit */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingText.trim()) {
                                onEditAndResend(msg.id, editingText.trim());
                                setEditingMsgId(null);
                              }
                            }}
                            className="rounded-lg hud-accent-bg px-3 py-1 text-xs font-medium text-slate-950"
                          >
                            Save & Resend
                          </button>
                        </div>
                      </div>
                    ) : isUser ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
                        {msg.content}
                      </p>
                    ) : msg.error ? (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{msg.error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={onRetryLast}
                          disabled={isGenerating}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Retry Request</span>
                        </button>
                      </div>
                    ) : msg.content ? (
                      <MarkdownRenderer content={msg.content} fontSize={settings.chatFontSize} />
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>Synthesizing response...</span>
                      </div>
                    )}

                    {/* Grounding Sources */}
                    {!isUser && settings.showCitations && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-slate-200/70 dark:border-slate-800 pt-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <Globe className="h-3.5 w-3.5" />
                          <span>Web Sources Referenced</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 transition-colors"
                            >
                              <span className="max-w-[200px] truncate">{src.title}</span>
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Actions */}
                    {!isEditing && (msg.content || isUser) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/50 dark:border-slate-800/60 pt-2 text-xs text-slate-500 dark:text-slate-400">
                        {isUser ? (
                          <button
                            type="button"
                            disabled={isGenerating}
                            onClick={() => {
                              setEditingMsgId(msg.id);
                              setEditingText(msg.content);
                            }}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit & Resend</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleCopy(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              {copiedId === msg.id ? (
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

                            {synthesisSupported && (
                              <button
                                type="button"
                                onClick={() => onSpeakText(msg.content)}
                                className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>Speak</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSaveToMemory(msg)}
                              className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              <span>{savedMemId === msg.id ? 'Saved to Memory' : 'Save Memory'}</span>
                            </button>

                            {msg.id === lastAssistantId && !isGenerating && (
                              <button
                                type="button"
                                onClick={onRegenerate}
                                className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Regenerate</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Input Composer */}
      <div className="border-t border-slate-200 dark:border-slate-800/80 bg-white/75 dark:bg-[#080C15]/90 p-3 sm:px-6 sm:py-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          {attachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900 px-2.5 py-1 text-xs"
                >
                  {att.previewUrl && (
                    <img src={att.previewUrl} alt={att.name} className="h-5 w-5 rounded object-cover" />
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

          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B101B] p-2 focus-within:border-cyan-500 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`Message ${settings.assistantName}... (Shift+Enter for new line)`}
              className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />

            <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/70 pt-2 px-1">
              <div className="flex items-center gap-2">
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
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseSearch((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    useSearch
                      ? 'bg-cyan-500/15 hud-accent-text border border-cyan-500/40'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Web Search {useSearch ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleListening}
                  disabled={!voiceSupported}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isListening
                      ? 'bg-rose-500/15 text-rose-500'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40'
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isListening ? 'Stop' : 'Voice'}</span>
                </button>
              </div>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStopGenerating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition-colors"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && attachments.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl hud-accent-bg px-4 py-1.5 text-xs font-medium text-slate-950 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
