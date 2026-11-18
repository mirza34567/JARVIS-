import { useState } from 'react';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { JarvisSettings, SearchHistoryEntry } from '../types/jarvis';

interface SearchViewProps {
  settings: JarvisSettings;
  searchHistory: SearchHistoryEntry[];
  onSaveSearchResult: (entry: SearchHistoryEntry) => void;
  onDeleteSearchEntry: (id: string) => void;
}

export function SearchView({
  settings,
  searchHistory,
  onSaveSearchResult,
  onDeleteSearchEntry,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<SearchHistoryEntry | null>(
    searchHistory[0] || null
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          model: settings.model,
          depth,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Search failed (${res.status})`);
      }

      const entry: SearchHistoryEntry = {
        id: `search_${Date.now()}`,
        query: data.query || query.trim(),
        summary: data.summary || '',
        sources: Array.isArray(data.sources) ? data.sources : [],
        queries: Array.isArray(data.queries) ? data.queries : [],
        timestamp: data.timestamp || Date.now(),
        model: data.model || settings.model,
      };

      setActiveResult(entry);
      onSaveSearchResult(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to perform web search.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Web Search Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Live Google Search grounding through Gemini with verified source links and synthesized briefings.
        </p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-4 space-y-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search current news, documentation, specifications, or research..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl hud-accent-bg px-5 py-2.5 text-sm font-medium text-slate-950 hover:opacity-90 disabled:opacity-45"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" />
                <span>Search Web</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 p-1">
            {(['quick', 'standard', 'deep'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDepth(mode)}
                className={`rounded-md px-2.5 py-1 capitalize font-medium transition-colors ${
                  depth === mode
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <span>Provider: Server-side Gemini Google Search Grounding</span>
        </div>
      </form>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results & Recent Searches Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 py-14 text-center">
              <Loader2 className="h-7 w-7 animate-spin hud-accent-text" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                Querying live web sources...
              </p>
            </div>
          ) : activeResult ? (
            <>
              {/* AI Synthesized Summary */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      {activeResult.query}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                      {new Date(activeResult.timestamp).toLocaleString()} · {activeResult.sources.length} sources
                    </p>
                  </div>
                </div>

                <MarkdownRenderer content={activeResult.summary} fontSize={settings.chatFontSize} />

                {activeResult.queries.length > 0 && (
                  <div className="mt-4 border-t border-slate-200/70 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Search queries executed: </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {activeResult.queries.join(' · ')}
                    </span>
                  </div>
                )}
              </section>

              {/* Source Attribution Cards */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Retrieved Sources ({activeResult.sources.length})
                </h3>
                {activeResult.sources.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 dark:text-slate-400">
                    No external web citations were returned for this query.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {activeResult.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-4 hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:hud-accent-text">
                              {src.title}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-xs text-cyan-700 dark:text-cyan-400">
                              {src.domain} · {src.uri}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-400" />
                        </div>
                        {src.snippet && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {src.snippet}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 py-14 px-6 text-center">
              <Globe className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Enter a query above to search the live web.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Results include grounded web citations, snippets, and an AI-generated summary.
              </p>
            </div>
          )}
        </div>

        {/* Search History Sidebar */}
        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-4 lg:col-span-4 self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Clock className="h-4 w-4 hud-accent-text" />
              <span>Recent Searches</span>
            </h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {searchHistory.length}
            </span>
          </div>

          {searchHistory.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Your search history will appear here.
            </p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors ${
                    activeResult?.id === item.id
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveResult(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                      {item.query}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500 tabular-nums">
                      {item.sources.length} sources · {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSearchEntry(item.id)}
                    className="rounded p-1 text-slate-400 hover:text-rose-500"
                    aria-label="Delete search entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
