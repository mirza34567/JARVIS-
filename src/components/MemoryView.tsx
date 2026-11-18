import { useMemo, useState } from 'react';
import {
  Brain,
  Check,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { JarvisSettings, MemoryCategory, MemoryItem } from '../types/jarvis';

interface MemoryViewProps {
  memories: MemoryItem[];
  settings: JarvisSettings;
  onUpdateSettings: (patch: Partial<JarvisSettings>) => void;
  onAddMemory: (content: string, category: MemoryCategory) => { ok: boolean; error?: string };
  onUpdateMemory: (id: string, content: string, category: MemoryCategory) => { ok: boolean; error?: string };
  onToggleMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearAllMemories: () => void;
}

const CATEGORIES: Array<{ id: MemoryCategory; label: string }> = [
  { id: 'preference', label: 'Preference' },
  { id: 'project', label: 'Project' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'workflow', label: 'Workflow' },
];

export function MemoryView({
  memories,
  settings,
  onUpdateSettings,
  onAddMemory,
  onUpdateMemory,
  onToggleMemory,
  onDeleteMemory,
  onClearAllMemories,
}: MemoryViewProps) {
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preference');
  const [formError, setFormError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | MemoryCategory>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryCategory>('preference');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return memories.filter((m) => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      if (q && !m.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [memories, filterText, filterCategory]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newContent.trim()) {
      setFormError('Enter a memory fact or preference first.');
      return;
    }
    const res = onAddMemory(newContent.trim(), newCategory);
    if (res.ok) {
      setNewContent('');
    } else {
      setFormError(res.error || 'Could not save memory.');
    }
  };

  const handleSaveEdit = (id: string) => {
    setFormError(null);
    if (!editText.trim()) return;
    const res = onUpdateMemory(id, editText.trim(), editCategory);
    if (res.ok) {
      setEditingId(null);
    } else {
      setFormError(res.error || 'Could not update memory.');
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      {/* Header & Global Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            AI Memory System
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage user-approved context that {settings.assistantName} references across conversations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.memoryEnabled}
              onChange={(e) => onUpdateSettings({ memoryEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Enable Memory in Chat</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.privacyFilterEnabled}
              onChange={(e) => onUpdateSettings({ privacyFilterEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Sensitive Data Guard</span>
          </label>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3.5 text-xs text-slate-700 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 hud-accent-text" />
        <p>
          Memories are stored locally in your browser and never saved automatically without your action. When Sensitive Data Guard is active, API keys, passwords, and payment patterns are blocked from memory storage.
        </p>
      </div>

      {/* Add Memory Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Approved Memory
          </h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {memories.filter((m) => m.active).length} / {memories.length} active
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            maxLength={500}
            placeholder="e.g., I prefer TypeScript with strict types and concise code reviews."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl hud-accent-bg px-4 py-2 text-sm font-medium text-slate-950 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>

        {formError && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>
        )}
      </form>

      {/* Filter & Clear Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter memories..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/70 p-1">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCategory(c.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterCategory === c.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {memories.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearAllMemories();
                  setConfirmClear(false);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
              >
                Confirm Delete All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-rose-500/40 hover:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )
        )}
      </div>

      {/* Memory List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 py-12 px-6 text-center">
          <Brain className="h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {memories.length === 0 ? 'No memories stored yet.' : 'No memories match your filter.'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add preferences, project context, or workflow rules above to personalize {settings.assistantName}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((mem) => {
            const isEditing = editingId === mem.id;
            return (
              <div
                key={mem.id}
                className={`rounded-xl border p-4 transition-colors ${
                  mem.active
                    ? 'border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85'
                    : 'border-slate-200/60 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/30 opacity-70'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={500}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Cancel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(mem.id)}
                        className="inline-flex items-center gap-1 rounded-lg hud-accent-bg px-3 py-1 text-xs font-medium text-slate-950"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                        {mem.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize font-medium">{mem.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{mem.active ? 'Active' : 'Paused'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(mem.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleMemory(mem.id)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {mem.active ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(mem.id);
                          setEditText(mem.content);
                          setEditCategory(mem.category);
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                        aria-label="Edit memory"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMemory(mem.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-500"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
