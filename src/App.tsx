import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Brain,
  Globe,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  Settings,
  Wrench,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { ChatView } from './components/ChatView';
import { VoiceView } from './components/VoiceView';
import { MemoryView } from './components/MemoryView';
import { ToolsView } from './components/ToolsView';
import { SearchView } from './components/SearchView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { RightStatusPanel } from './components/RightStatusPanel';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import type {
  ApiStatusState,
  ChatMessage,
  Conversation,
  CoreState,
  FileAttachment,
  GeminiModelInfo,
  JarvisSettings,
  MemoryCategory,
  MemoryItem,
  NavSection,
  SearchHistoryEntry,
  ToolId,
} from './types/jarvis';
import { streamGeminiChat } from './utils/sseClient';
import {
  clearAllLocalData,
  DEFAULT_SETTINGS,
  detectSensitiveData,
  loadActiveConversationId,
  loadConversations,
  loadMemories,
  loadSearchHistory,
  loadSettings,
  playHudTone,
  saveActiveConversationId,
  saveConversations,
  saveMemories,
  saveSearchHistory,
  saveSettings,
} from './utils/storage';

const FALLBACK_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    description: 'Fast, high-intelligence model for everyday tasks, coding, research, and multimodal analysis.',
    tier: 'standard',
    supportsThinking: true,
    supportsXHigh: true,
    isDefault: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-low-latency model optimized for rapid responses.',
    tier: 'standard',
    supportsThinking: true,
    supportsXHigh: false,
  },
];

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'voice', label: 'Voice Assistant', icon: Mic },
  { id: 'memory', label: 'AI Memory', icon: Brain },
  { id: 'tools', label: 'AI Tools', icon: Wrench },
  { id: 'search', label: 'Web Search', icon: Globe },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [activeTool, setActiveTool] = useState<ToolId>('code');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  const [settings, setSettings] = useState<JarvisSettings>(() => loadSettings());
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    loadActiveConversationId()
  );
  const [memories, setMemories] = useState<MemoryItem[]>(() => loadMemories());
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => loadSearchHistory());

  const [models, setModels] = useState<GeminiModelInfo[]>(FALLBACK_MODELS);
  const [fetchedFromApi, setFetchedFromApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatusState>({
    configured: false,
    connected: false,
    checking: true,
    latencyMs: null,
    lastChecked: null,
    error: null,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [hasErrorState, setHasErrorState] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const speakOnCompleteRef = useRef(false);

  // Sync theme, dark/light mode, and animation preferences onto <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.colorMode === 'dark') {
      root.classList.add('dark');
      document.body.className =
        'bg-[#05070B] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-100';
    } else {
      root.classList.remove('dark');
      document.body.className =
        'bg-slate-50 text-slate-900 antialiased selection:bg-cyan-500/20 selection:text-cyan-900';
    }
    root.setAttribute('data-accent', settings.accentTheme);
    root.setAttribute('data-animations', settings.animationLevel);
  }, [settings.colorMode, settings.accentTheme, settings.animationLevel]);

  // Persist state changes
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    saveMemories(memories);
  }, [memories]);

  useEffect(() => {
    saveSearchHistory(searchHistory);
  }, [searchHistory]);

  const checkApiStatus = useCallback(async (verify = false) => {
    setApiStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`/api/gemini/status${verify ? '?verify=true' : ''}`);
      const data = await res.json();
      setApiStatus({
        configured: Boolean(data.configured),
        connected: Boolean(data.connected),
        checking: false,
        latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
        lastChecked: Date.now(),
        error: data.error || null,
      });
    } catch {
      setApiStatus({
        configured: false,
        connected: false,
        checking: false,
        latencyMs: null,
        lastChecked: Date.now(),
        error: 'Unable to reach JARVIS backend server.',
      });
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/gemini/models');
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setFetchedFromApi(Boolean(data.fetchedFromApi));
      }
    } catch {
      // Keep fallback curated list
    }
  }, []);

  useEffect(() => {
    void checkApiStatus(false);
    void fetchModels();
  }, [checkApiStatus, fetchModels]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const updateSettings = useCallback((patch: Partial<JarvisSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const createNewConversation = useCallback((): string => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const conv: Conversation = {
      id,
      title: 'New Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(id);
    return id;
  }, []);

  // Voice assistant hook (wired to real send function via ref below)
  const sendChatMessageRef = useRef<
    (
      text: string,
      attachments?: FileAttachment[],
      useWebSearch?: boolean,
      options?: { speakReply?: boolean; targetConvId?: string }
    ) => void
  >(() => {});

  const voice = useVoiceAssistant({
    voiceUri: settings.voiceUri,
    voiceRate: settings.voiceRate,
    voicePitch: settings.voicePitch,
    language: settings.language,
    autoListenAfterSpeak: settings.autoListenAfterSpeak,
    onTranscriptFinal: (transcript) => {
      playHudTone('send', settings.soundEffects);
      sendChatMessageRef.current(transcript, [], settings.useWebSearchInChat, {
        speakReply: true,
      });
    },
  });

  const sendChatMessage = useCallback(
    async (
      text: string,
      attachments: FileAttachment[] = [],
      useWebSearch = settings.useWebSearchInChat,
      options?: { speakReply?: boolean; targetConvId?: string; baseMessages?: ChatMessage[] }
    ) => {
      if (isGenerating) return;
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;

      setHasErrorState(false);
      playHudTone('send', settings.soundEffects);
      speakOnCompleteRef.current = Boolean(options?.speakReply);

      let convId = options?.targetConvId || activeConversationId;
      if (!convId || !conversations.some((c) => c.id === convId)) {
        convId = createNewConversation();
      }

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: trimmed || 'Please inspect the attached file.',
        timestamp: Date.now(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const assistantMsgId = `msg_${Date.now()}_a`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: settings.model,
      };

      let historyForRequest: ChatMessage[] = [];

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== convId) return conv;
          const prior = options?.baseMessages ?? conv.messages;
          historyForRequest = [...prior, userMsg];
          const nextTitle =
            prior.length === 0
              ? (trimmed || attachments[0]?.name || 'New Session').slice(0, 48)
              : conv.title;
          return {
            ...conv,
            title: nextTitle,
            updatedAt: Date.now(),
            messages: [...prior, userMsg, assistantPlaceholder],
          };
        })
      );

      setIsGenerating(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const activeMemories = settings.memoryEnabled
        ? memories.filter((m) => m.active).map((m) => ({ category: m.category, content: m.content }))
        : [];

      let fullReply = '';

      await streamGeminiChat(
        {
          messages: historyForRequest.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          model: settings.model,
          assistantName: settings.assistantName,
          thinkingDepth: settings.thinkingDepth,
          responseStyle: settings.responseStyle,
          maxResponseNote: settings.maxResponseNote,
          memories: activeMemories,
          useWebSearch,
          language: settings.language,
        },
        {
          onChunk: (chunk) => {
            fullReply += chunk;
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id !== convId) return conv;
                return {
                  ...conv,
                  updatedAt: Date.now(),
                  messages: conv.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: fullReply } : m
                  ),
                };
              })
            );
          },
          onGrounding: (sources, queries) => {
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id !== convId) return conv;
                return {
                  ...conv,
                  messages: conv.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, sources, searchQueries: queries } : m
                  ),
                };
              })
            );
          },
          onError: (message) => {
            setHasErrorState(true);
            setIsGenerating(false);
            voice.setVoiceState('error');
            playHudTone('error', settings.soundEffects);
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id !== convId) return conv;
                return {
                  ...conv,
                  messages: conv.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: message } : m
                  ),
                };
              })
            );
          },
          onDone: () => {
            setIsGenerating(false);
            setApiStatus((prev) => ({ ...prev, connected: true, error: null }));
            playHudTone('receive', settings.soundEffects);
            if (speakOnCompleteRef.current && fullReply.trim()) {
              voice.speak(fullReply);
            } else {
              voice.setVoiceState('idle');
            }
          },
        },
        controller.signal
      );
    },
    [
      activeConversationId,
      conversations,
      createNewConversation,
      isGenerating,
      memories,
      settings,
      voice,
    ]
  );

  sendChatMessageRef.current = sendChatMessage;

  const handleStopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    voice.setVoiceState('idle');
  }, [voice]);

  const handleRegenerate = useCallback(() => {
    if (!activeConversation || isGenerating) return;
    const msgs = activeConversation.messages;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const userMsg = msgs[lastUserIdx];
    const prior = msgs.slice(0, lastUserIdx);
    void sendChatMessage(userMsg.content, userMsg.attachments || [], settings.useWebSearchInChat, {
      targetConvId: activeConversation.id,
      baseMessages: prior,
    });
  }, [activeConversation, isGenerating, sendChatMessage, settings.useWebSearchInChat]);

  const handleEditAndResend = useCallback(
    (messageId: string, newText: string) => {
      if (!activeConversation || isGenerating) return;
      const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const targetMsg = activeConversation.messages[idx];
      const prior = activeConversation.messages.slice(0, idx);
      void sendChatMessage(newText, targetMsg.attachments || [], settings.useWebSearchInChat, {
        targetConvId: activeConversation.id,
        baseMessages: prior,
      });
    },
    [activeConversation, isGenerating, sendChatMessage, settings.useWebSearchInChat]
  );

  const handleAddMemory = useCallback(
    (content: string, category: MemoryCategory = 'knowledge'): { ok: boolean; error?: string } => {
      if (settings.privacyFilterEnabled) {
        const sensitiveWarning = detectSensitiveData(content);
        if (sensitiveWarning) {
          return { ok: false, error: sensitiveWarning };
        }
      }
      const item: MemoryItem = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content,
        category,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        active: true,
      };
      setMemories((prev) => [item, ...prev]);
      return { ok: true };
    },
    [settings.privacyFilterEnabled]
  );

  const handleUpdateMemory = useCallback(
    (id: string, content: string, category: MemoryCategory): { ok: boolean; error?: string } => {
      if (settings.privacyFilterEnabled) {
        const sensitiveWarning = detectSensitiveData(content);
        if (sensitiveWarning) {
          return { ok: false, error: sensitiveWarning };
        }
      }
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, category, updatedAt: Date.now() } : m))
      );
      return { ok: true };
    },
    [settings.privacyFilterEnabled]
  );

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      conversations,
      memories,
      searchHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      settings?: Partial<JarvisSettings>;
      conversations?: Conversation[];
      memories?: MemoryItem[];
      searchHistory?: SearchHistoryEntry[];
    };
    if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
    if (Array.isArray(parsed.conversations)) setConversations(parsed.conversations);
    if (Array.isArray(parsed.memories)) setMemories(parsed.memories);
    if (Array.isArray(parsed.searchHistory)) setSearchHistory(parsed.searchHistory);
  };

  const handleClearAllData = () => {
    clearAllLocalData();
    setConversations([]);
    setActiveConversationId(null);
    setMemories([]);
    setSearchHistory([]);
    setSettings(DEFAULT_SETTINGS);
  };

  const coreState: CoreState = isGenerating
    ? 'thinking'
    : voice.voiceState !== 'idle'
    ? voice.voiceState
    : hasErrorState
    ? 'error'
    : 'idle';

  const activeMemoryCount = memories.filter((m) => m.active).length;

  const navigate = (section: NavSection) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#05070B] text-slate-900 dark:text-slate-100">
      {/* Subtle Background HUD Grid */}
      <div className="hud-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

      {/* Mobile Left Navigation Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#070B12]/95 backdrop-blur-md transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800/90 px-4">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="font-display text-lg font-bold tracking-[0.12em] text-slate-900 dark:text-white whitespace-nowrap"
          >
            {settings.assistantName} <span className="hud-accent-text">AI</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              createNewConversation();
              navigate('chat');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl hud-accent-bg px-3 py-2 text-xs font-semibold text-slate-950 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span>New Session</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-cyan-500/12 hud-accent-text border border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800/90 p-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <span>API Status</span>
            <span
              className={
                apiStatus.connected
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-amber-600 dark:text-amber-400 font-medium'
              }
            >
              {apiStatus.connected ? 'Online' : apiStatus.configured ? 'Configured' : 'Key Required'}
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-[10px]">{settings.model}</div>
        </div>
      </aside>

      {/* Center Content Column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top Bar (3 zones: mobile menu/title — nav context — action) */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/90 bg-white/80 dark:bg-[#070B12]/85 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('voice')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Mic className="h-3.5 w-3.5 hud-accent-text" />
              <span>Voice Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileRightOpen(true)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 xl:hidden"
              aria-label="Open system status panel"
            >
              <Activity className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Area */}
        <main className="flex-1 overflow-y-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              settings={settings}
              coreState={coreState}
              audioLevel={voice.audioLevel}
              apiStatus={apiStatus}
              conversations={conversations}
              memoryCount={activeMemoryCount}
              voiceSupported={voice.capabilities.recognitionSupported}
              onSubmitPrompt={(prompt, atts, useSearch) => {
                const newId = createNewConversation();
                setActiveSection('chat');
                void sendChatMessage(prompt, atts || [], useSearch, { targetConvId: newId });
              }}
              onNavigate={navigate}
              onOpenTool={(toolId) => {
                setActiveTool(toolId);
                navigate('tools');
              }}
              onSelectConversation={(id) => {
                setActiveConversationId(id);
                navigate('chat');
              }}
              onToggleListening={() => {
                if (voice.voiceState === 'listening') voice.stopListening();
                else void voice.startListening();
              }}
            />
          )}

          {activeSection === 'chat' && (
            <ChatView
              conversation={activeConversation}
              settings={settings}
              isGenerating={isGenerating}
              voiceSupported={voice.capabilities.recognitionSupported}
              synthesisSupported={voice.capabilities.synthesisSupported}
              isListening={voice.voiceState === 'listening'}
              onSendMessage={(text, atts, useSearch) => {
                void sendChatMessage(text, atts, useSearch);
              }}
              onStopGenerating={handleStopGenerating}
              onRegenerate={handleRegenerate}
              onRetryLast={handleRegenerate}
              onEditAndResend={handleEditAndResend}
              onNewConversation={() => {
                createNewConversation();
              }}
              onClearConversation={() => {
                if (!activeConversationId) return;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeConversationId ? { ...c, messages: [], updatedAt: Date.now() } : c
                  )
                );
              }}
              onToggleListening={() => {
                if (voice.voiceState === 'listening') voice.stopListening();
                else void voice.startListening();
              }}
              onSpeakText={(txt) => voice.speak(txt)}
              onSaveMemory={(content) => handleAddMemory(content, 'knowledge')}
            />
          )}

          {activeSection === 'voice' && (
            <VoiceView
              settings={settings}
              onUpdateSettings={updateSettings}
              capabilities={voice.capabilities}
              voices={voice.voices}
              voiceState={voice.voiceState}
              isPaused={voice.isPaused}
              interimTranscript={voice.interimTranscript}
              audioLevel={voice.audioLevel}
              voiceError={voice.voiceError}
              messages={activeConversation?.messages || []}
              isGenerating={isGenerating}
              onStartListening={() => void voice.startListening()}
              onStopListening={voice.stopListening}
              onStopSpeaking={voice.stopSpeaking}
              onPauseSpeaking={voice.pauseSpeaking}
              onResumeSpeaking={voice.resumeSpeaking}
              onStopGenerating={handleStopGenerating}
              onSendVoicePrompt={(text) => {
                void sendChatMessage(text, [], settings.useWebSearchInChat, { speakReply: true });
              }}
              onSpeakMessage={(text) => voice.speak(text)}
            />
          )}

          {activeSection === 'memory' && (
            <MemoryView
              memories={memories}
              settings={settings}
              onUpdateSettings={updateSettings}
              onAddMemory={handleAddMemory}
              onUpdateMemory={handleUpdateMemory}
              onToggleMemory={(id) =>
                setMemories((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, active: !m.active, updatedAt: Date.now() } : m))
                )
              }
              onDeleteMemory={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
              onClearAllMemories={() => setMemories([])}
            />
          )}

          {activeSection === 'tools' && (
            <ToolsView
              settings={settings}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
            />
          )}

          {activeSection === 'search' && (
            <SearchView
              settings={settings}
              searchHistory={searchHistory}
              onSaveSearchResult={(entry) =>
                setSearchHistory((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)])
              }
              onDeleteSearchEntry={(id) =>
                setSearchHistory((prev) => prev.filter((e) => e.id !== id))
              }
            />
          )}

          {activeSection === 'history' && (
            <HistoryView
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => {
                setActiveConversationId(id);
                navigate('chat');
              }}
              onNewConversation={() => {
                createNewConversation();
                navigate('chat');
              }}
              onRenameConversation={(id, title) =>
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
                )
              }
              onTogglePinConversation={(id) =>
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
                )
              }
              onDeleteConversation={(id) => {
                setConversations((prev) => prev.filter((c) => c.id !== id));
                if (activeConversationId === id) setActiveConversationId(null);
              }}
              onClearAllHistory={() => {
                setConversations([]);
                setActiveConversationId(null);
              }}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settings}
              models={models}
              fetchedFromApi={fetchedFromApi}
              apiStatus={apiStatus}
              voices={voice.voices}
              onUpdateSettings={updateSettings}
              onResetSettings={() => setSettings(DEFAULT_SETTINGS)}
              onTestConnection={() => void checkApiStatus(true)}
              onRefreshModels={() => void fetchModels()}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onClearAllData={handleClearAllData}
            />
          )}
        </main>
      </div>

      {/* Mobile Right Telemetry Overlay */}
      {mobileRightOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs xl:hidden"
          onClick={() => setMobileRightOpen(false)}
        />
      )}

      {/* Right Context & Status Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-72 border-l border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#070B12]/95 backdrop-blur-md transition-transform duration-200 xl:static xl:translate-x-0 ${
          mobileRightOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <RightStatusPanel
          settings={settings}
          coreState={coreState}
          audioLevel={voice.audioLevel}
          apiStatus={apiStatus}
          activeConversation={activeConversation}
          activeMemoryCount={activeMemoryCount}
          totalMemoryCount={memories.length}
          voiceSupported={voice.capabilities.recognitionSupported}
          onRefreshStatus={() => void checkApiStatus(true)}
          onOpenTool={(toolId) => {
            setActiveTool(toolId);
            navigate('tools');
            setMobileRightOpen(false);
          }}
          onNavigate={(sec) => {
            navigate(sec);
            setMobileRightOpen(false);
          }}
          onCloseMobile={() => setMobileRightOpen(false)}
        />
      </aside>
    </div>
  );
}
