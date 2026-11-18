import { useEffect, useState } from 'react';
import {
  Brain,
  Code2,
  FileText,
  Globe,
  Languages,
  RefreshCw,
  X,
} from 'lucide-react';
import { JarvisCore } from './JarvisCore';
import type {
  ApiStatusState,
  Conversation,
  CoreState,
  JarvisSettings,
  NavSection,
  ToolId,
} from '../types/jarvis';

interface RightStatusPanelProps {
  settings: JarvisSettings;
  coreState: CoreState;
  audioLevel: number;
  apiStatus: ApiStatusState;
  activeConversation: Conversation | null;
  activeMemoryCount: number;
  totalMemoryCount: number;
  voiceSupported: boolean;
  onRefreshStatus: () => void;
  onOpenTool: (id: ToolId) => void;
  onNavigate: (section: NavSection) => void;
  onCloseMobile?: () => void;
}

export function RightStatusPanel({
  settings,
  coreState,
  audioLevel,
  apiStatus,
  activeConversation,
  activeMemoryCount,
  totalMemoryCount,
  voiceSupported,
  onRefreshStatus,
  onOpenTool,
  onNavigate,
  onCloseMobile,
}: RightStatusPanelProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activityText =
    coreState === 'thinking'
      ? 'Processing Request'
      : coreState === 'listening'
      ? 'Listening to Microphone'
      : coreState === 'speaking'
      ? 'Speaking Response'
      : coreState === 'error'
      ? 'Error Attention Needed'
      : 'Idle · Ready';

  const quickTools: Array<{ id: ToolId; label: string; icon: typeof Code2 }> = [
    { id: 'code', label: 'Code Assistant', icon: Code2 },
    { id: 'summarizer', label: 'Summarizer', icon: FileText },
    { id: 'translator', label: 'Translator', icon: Languages },
  ];

  return (
    <div className="flex h-full flex-col justify-between gap-5 overflow-y-auto p-4 text-xs">
      <div className="space-y-5">
        {onCloseMobile && (
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 lg:hidden">
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              System Telemetry
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close telemetry panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Compact AI Core & Activity State */}
        <div className="flex flex-col items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/45 p-4">
          <JarvisCore
            state={coreState}
            size="sm"
            audioLevel={audioLevel}
            animationLevel={settings.animationLevel}
            assistantName={settings.assistantName}
            onClick={() => onNavigate('voice')}
          />
          <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">
            {activityText}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {settings.model}
          </p>
        </div>

        {/* AI & Service Status */}
        <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Service Status
            </h3>
            <button
              type="button"
              onClick={onRefreshStatus}
              disabled={apiStatus.checking}
              title="Verify API connection"
              className="rounded p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${apiStatus.checking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <dl className="space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Gemini API</dt>
              <dd
                className={`font-medium ${
                  apiStatus.connected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : apiStatus.configured
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {apiStatus.connected
                  ? 'Connected'
                  : apiStatus.configured
                  ? 'Unverified'
                  : 'Not Configured'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Web Search</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {apiStatus.configured ? 'Ready' : 'Key Required'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Voice Input</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {voiceSupported ? 'Supported' : 'Unavailable'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Firebase</dt>
              <dd className="font-medium text-slate-500 dark:text-slate-400">
                Local Mode
              </dd>
            </div>
          </dl>
        </div>

        {/* Current Session Information */}
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Current Session
          </h3>
          <p className="truncate text-slate-700 dark:text-slate-300 font-medium">
            {activeConversation?.title || 'Standby Session'}
          </p>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Turns</span>
            <span>{activeConversation?.messages.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Reasoning</span>
            <span className="font-mono">{settings.thinkingDepth}</span>
          </div>
        </div>

        {/* Memory Status */}
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              <Brain className="h-3.5 w-3.5 hud-accent-text" />
              <span>AI Memory</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('memory')}
              className="hud-accent-text hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Status</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {settings.memoryEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Active entries</span>
            <span>
              {activeMemoryCount} / {totalMemoryCount}
            </span>
          </div>
        </div>

        {/* Quick Available Tools */}
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Available Tools
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="hud-accent-text hover:underline"
            >
              All 8
            </button>
          </div>
          <div className="space-y-1">
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onOpenTool(tool.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 hud-accent-text shrink-0" />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onNavigate('search')}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
            >
              <Globe className="h-3.5 w-3.5 hud-accent-text shrink-0" />
              <span className="truncate">Live Web Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Date & Clock */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <p className="font-mono text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
