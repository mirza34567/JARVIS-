import { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '../types/jarvis';

interface HistoryViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onTogglePinConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAllHistory: () => void;
}

export function HistoryView({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onTogglePinConversation,
  onDeleteConversation,
  onClearAllHistory,
}: HistoryViewProps) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const sortedAndFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...conversations]
      .filter((conv) => {
        if (!q) return true;
        if (conv.title.toLowerCase().includes(q)) return true;
        return conv.messages.some((m) => m.content.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [conversations, query]);

  const exportMarkdown = (conv: Conversation) => {
    const lines = [
      `# ${conv.title}`,
      `Exported: ${new Date().toISOString()}`,
      '',
      ...conv.messages.map((m) => {
        const who = m.role === 'user' ? 'User' : 'JARVIS';
        const time = new Date(m.timestamp).toLocaleString();
        return `### ${who} (${time})\n\n${m.content}\n`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'conversation'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Conversation History
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Search, resume, pin, rename, or export your saved sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewConversation}
            className="inline-flex items-center gap-1.5 rounded-xl hud-accent-bg px-4 py-2 text-xs font-medium text-slate-950 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </button>

          {conversations.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllHistory();
                    setConfirmClear(false);
                  }}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500"
                >
                  Confirm Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rose-500/40 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear History</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations by title or message content..."
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* List */}
      {sortedAndFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 py-14 px-6 text-center">
          <MessageSquare className="h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {conversations.length === 0 ? 'No saved conversations yet.' : 'No conversations match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAndFiltered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;
            const lastMsg = conv.messages[conv.messages.length - 1];

            return (
              <div
                key={conv.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isActive
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editTitle.trim()) {
                              onRenameConversation(conv.id, editTitle.trim());
                            }
                            setEditingId(null);
                          }}
                          className="rounded-lg hud-accent-bg p-1.5 text-slate-950"
                          aria-label="Save title"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 p-1.5 text-slate-500"
                          aria-label="Cancel rename"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conv.id)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:hud-accent-text">
                            {conv.title}
                          </h2>
                          {conv.pinned && (
                            <span className="text-[11px] font-medium hud-accent-text">Pinned</span>
                          )}
                        </div>
                        {lastMsg && (
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {lastMsg.content}
                          </p>
                        )}
                        <p className="mt-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                          {conv.messages.length} messages · Updated {new Date(conv.updatedAt).toLocaleString()}
                        </p>
                      </button>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTogglePinConversation(conv.id)}
                        title={conv.pinned ? 'Unpin' : 'Pin'}
                        className={`rounded-lg p-1.5 ${
                          conv.pinned
                            ? 'hud-accent-text bg-cyan-500/10'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(conv.id);
                          setEditTitle(conv.title);
                        }}
                        title="Rename"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportMarkdown(conv)}
                        title="Export Markdown"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
