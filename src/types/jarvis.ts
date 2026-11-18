export type NavSection =
  | 'dashboard'
  | 'chat'
  | 'voice'
  | 'memory'
  | 'tools'
  | 'search'
  | 'history'
  | 'settings';

export type CoreState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type AccentTheme = 'cyan' | 'blue' | 'purple' | 'red' | 'green' | 'orange';

export type ChatFontSize = 'small' | 'medium' | 'large';

export type AnimationLevel = 'full' | 'balanced' | 'reduced';

export type ThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export type ToolId =
  | 'code'
  | 'writing'
  | 'translator'
  | 'summarizer'
  | 'study'
  | 'brainstorm'
  | 'math'
  | 'developer';

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'document' | 'text';
  previewUrl?: string;
  base64Data?: string;
  textContent?: string;
}

export interface SearchSource {
  title: string;
  uri: string;
  domain: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  attachments?: FileAttachment[];
  sources?: SearchSource[];
  searchQueries?: string[];
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  pinned?: boolean;
}

export type MemoryCategory = 'preference' | 'project' | 'knowledge' | 'workflow';

export interface MemoryItem {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description: string;
  tier: 'standard' | 'paid';
  supportsThinking: boolean;
  supportsXHigh: boolean;
  isDefault?: boolean;
}

export interface ApiStatusState {
  configured: boolean;
  connected: boolean;
  checking: boolean;
  latencyMs: number | null;
  lastChecked: number | null;
  error: string | null;
}

export interface JarvisSettings {
  assistantName: string;
  greeting: string;
  model: string;
  thinkingDepth: ThinkingDepth;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  maxResponseNote: 'auto' | 'brief' | 'standard' | 'comprehensive';
  useWebSearchInChat: boolean;
  showCitations: boolean;
  memoryEnabled: boolean;
  privacyFilterEnabled: boolean;
  accentTheme: AccentTheme;
  colorMode: 'dark' | 'light';
  chatFontSize: ChatFontSize;
  animationLevel: AnimationLevel;
  soundEffects: boolean;
  voiceUri: string;
  voiceRate: number;
  voicePitch: number;
  autoListenAfterSpeak: boolean;
  language: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  summary: string;
  sources: SearchSource[];
  queries: string[];
  timestamp: number;
  model: string;
}
