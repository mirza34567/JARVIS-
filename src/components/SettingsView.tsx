import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Info,
  Loader2,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  Upload,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {
  AccentTheme,
  AnimationLevel,
  ApiStatusState,
  ChatFontSize,
  GeminiModelInfo,
  JarvisSettings,
  ThinkingDepth,
} from '../types/jarvis';

interface SettingsViewProps {
  settings: JarvisSettings;
  models: GeminiModelInfo[];
  fetchedFromApi: boolean;
  apiStatus: ApiStatusState;
  voices: SpeechSynthesisVoice[];
  onUpdateSettings: (patch: Partial<JarvisSettings>) => void;
  onResetSettings: () => void;
  onTestConnection: () => void;
  onRefreshModels: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<void>;
  onClearAllData: () => void;
}

const THEMES: Array<{ id: AccentTheme; label: string; swatch: string }> = [
  { id: 'cyan', label: 'Neon Cyan', swatch: 'bg-cyan-500' },
  { id: 'blue', label: 'Neon Blue', swatch: 'bg-blue-500' },
  { id: 'purple', label: 'Purple', swatch: 'bg-purple-500' },
  { id: 'red', label: 'Red', swatch: 'bg-red-500' },
  { id: 'green', label: 'Green', swatch: 'bg-emerald-500' },
  { id: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
];

export function SettingsView({
  settings,
  models,
  fetchedFromApi,
  apiStatus,
  voices,
  onUpdateSettings,
  onResetSettings,
  onTestConnection,
  onRefreshModels,
  onExportBackup,
  onImportBackup,
  onClearAllData,
}: SettingsViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const selectedModel = models.find((m) => m.id === settings.model);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6 pb-12">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Settings & System Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure Gemini AI models, voice synthesis, memory privacy, appearance, and local data.
        </p>
      </div>

      {/* 1. AI Configuration & Gemini API Status */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 hud-accent-text" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              AI Configuration & Gemini Connection
            </h2>
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={apiStatus.checking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {apiStatus.checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>Test API Connection</span>
          </button>
        </div>

        {/* Live Connection Diagnostic */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              {apiStatus.connected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Connected to Gemini API via server route
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-500" />
                  <span className="text-rose-700 dark:text-rose-400">
                    {apiStatus.configured ? 'Connection Verification Failed' : 'Gemini API Key Not Configured'}
                  </span>
                </>
              )}
            </div>
            {apiStatus.latencyMs !== null && (
              <span className="font-mono text-slate-500 tabular-nums">
                Round-trip: {apiStatus.latencyMs} ms
              </span>
            )}
          </div>

          {apiStatus.error && (
            <p className="text-rose-600 dark:text-rose-400">{apiStatus.error}</p>
          )}

          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            For security, the Gemini API credential (<code className="font-mono">GEMINI_API_KEY</code>) is managed exclusively on the server via the AI Studio <strong>Settings &gt; Secrets</strong> panel and is never stored or exposed in browser UI.
          </p>
        </div>

        {/* Model Selector */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Active AI Model
              </label>
              <button
                type="button"
                onClick={onRefreshModels}
                className="text-[11px] hud-accent-text hover:underline"
              >
                Refresh Models
              </button>
            </div>
            <select
              value={settings.model}
              onChange={(e) => onUpdateSettings({ model: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.id}){m.tier === 'paid' ? ' — Paid Key' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {selectedModel?.description || 'Selected Gemini model.'}{' '}
              {fetchedFromApi && 'Live list verified with API.'}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Reasoning / Thinking Depth
            </label>
            <select
              value={settings.thinkingDepth}
              onChange={(e) => onUpdateSettings({ thinkingDepth: e.target.value as ThinkingDepth })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="LOW">Low (Fastest latency)</option>
              <option value="MEDIUM">Medium (Balanced)</option>
              <option value="HIGH">High (Recommended depth)</option>
              <option value="XHIGH" disabled={settings.model !== 'gemini-4-hydrogen'}>
                Maximum XHIGH (Gemini 4 Hydrogen only)
              </option>
            </select>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Controls reasoning allocation for Gemini 3 and Gemini 4 series models.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Response Style
            </label>
            <select
              value={settings.responseStyle}
              onChange={(e) =>
                onUpdateSettings({ responseStyle: e.target.value as JarvisSettings['responseStyle'] })
              }
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Target Response Length
            </label>
            <select
              value={settings.maxResponseNote}
              onChange={(e) =>
                onUpdateSettings({ maxResponseNote: e.target.value as JarvisSettings['maxResponseNote'] })
              }
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="auto">Automatic</option>
              <option value="brief">Brief</option>
              <option value="standard">Standard</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>
        </div>
      </section>

      {/* 2. Personalization & Identity */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          Assistant Identity & Appearance
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Assistant Name
            </label>
            <input
              type="text"
              maxLength={24}
              value={settings.assistantName}
              onChange={(e) => onUpdateSettings({ assistantName: e.target.value || 'JARVIS' })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Primary Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Dashboard Greeting
            </label>
            <input
              type="text"
              maxLength={120}
              value={settings.greeting}
              onChange={(e) => onUpdateSettings({ greeting: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Accent Theme Selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
            HUD Accent Theme
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
            {THEMES.map((t) => {
              const active = settings.accentTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdateSettings({ accentTheme: t.id })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${t.swatch}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode, Font Size, Animation Level */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Interface Mode
            </label>
            <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => onUpdateSettings({ colorMode: 'dark' })}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium ${
                  settings.colorMode === 'dark'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ colorMode: 'light' })}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium ${
                  settings.colorMode === 'light'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>Light</span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Chat Font Size
            </label>
            <select
              value={settings.chatFontSize}
              onChange={(e) => onUpdateSettings({ chatFontSize: e.target.value as ChatFontSize })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Core Animations
            </label>
            <select
              value={settings.animationLevel}
              onChange={(e) => onUpdateSettings({ animationLevel: e.target.value as AnimationLevel })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="full">Full (Rings + Particles)</option>
              <option value="balanced">Balanced (Rings only)</option>
              <option value="reduced">Reduced Motion</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3. Voice, Memory & Web Search Controls */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          <Volume2 className="h-4 w-4 hud-accent-text" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Voice, Search & Privacy Preferences
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Voice Synthesis Profile
            </label>
            <select
              value={settings.voiceUri}
              onChange={(e) => onUpdateSettings({ voiceUri: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="">System Default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>Speech Rate</span>
              <span className="font-mono tabular-nums">{settings.voiceRate.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.7"
              max="1.6"
              step="0.1"
              value={settings.voiceRate}
              onChange={(e) => onUpdateSettings({ voiceRate: Number(e.target.value) })}
              className="w-full accent-cyan-500 mt-2"
            />
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>Speech Pitch</span>
              <span className="font-mono tabular-nums">{settings.voicePitch.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.1"
              value={settings.voicePitch}
              onChange={(e) => onUpdateSettings({ voicePitch: Number(e.target.value) })}
              className="w-full accent-cyan-500 mt-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 text-xs">
          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.soundEffects}
              onChange={(e) => onUpdateSettings({ soundEffects: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Play subtle HUD interaction tones</span>
          </label>

          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useWebSearchInChat}
              onChange={(e) => onUpdateSettings({ useWebSearchInChat: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Enable Web Search grounding by default in Chat</span>
          </label>

          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showCitations}
              onChange={(e) => onUpdateSettings({ showCitations: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Display web source citations on responses</span>
          </label>

          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.memoryEnabled}
              onChange={(e) => onUpdateSettings({ memoryEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Include saved AI memories in chat context</span>
          </label>

          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.privacyFilterEnabled}
              onChange={(e) => onUpdateSettings({ privacyFilterEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Block sensitive secrets in AI memory</span>
          </label>

          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoListenAfterSpeak}
              onChange={(e) => onUpdateSettings({ autoListenAfterSpeak: e.target.checked })}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            <span>Auto-listen after speaking in Voice Assistant</span>
          </label>
        </div>
      </section>

      {/* 4. Firebase Configuration Status */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          <Database className="h-4 w-4 hud-accent-text" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Firebase & Cloud Storage Status
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 text-xs space-y-2 text-slate-600 dark:text-slate-300">
          <p>
            <strong>Status:</strong> Firebase provisioning was not enabled for this workspace.
          </p>
          <p>
            Conversations, preferences, search history, and AI memories are persisted locally in your browser using <code className="font-mono">localStorage</code>. You can export or restore a JSON backup anytime below.
          </p>
        </div>
      </section>

      {/* 5. Data Management & About */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-[#0B101B]/85 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          <Shield className="h-4 w-4 hud-accent-text" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Data Management & About
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Data (JSON)</span>
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            <span>Import Backup</span>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await onImportBackup(file);
                  setImportNotice('Backup imported successfully.');
                } catch (err) {
                  setImportNotice(err instanceof Error ? err.message : 'Invalid backup file.');
                }
                e.target.value = '';
              }}
            />
          </label>

          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onResetSettings();
                  setConfirmReset(false);
                }}
                className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-medium text-white"
              >
                Confirm Reset Settings
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reset Settings
            </button>
          )}

          {confirmClearData ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClearData(false);
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white"
              >
                Confirm Erase All Data
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearData(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearData(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All Local Data</span>
            </button>
          )}
        </div>

        {importNotice && (
          <p className="text-xs hud-accent-text">{importNotice}</p>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 text-xs text-slate-500 dark:text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>About JARVIS AI:</strong> Built as a full-stack React + Express personal assistant command center powered by Google Gemini via server-side API routes, browser Web Speech APIs, and local browser persistence. JARVIS does not access host OS hardware telemetry or execute shell commands on your device.
          </p>
        </div>
      </section>
    </div>
  );
}
