import type {
  Conversation,
  FileAttachment,
  JarvisSettings,
  MemoryItem,
  SearchHistoryEntry,
} from '../types/jarvis';

const STORAGE_KEYS = {
  SETTINGS: 'jarvis_settings_v1',
  CONVERSATIONS: 'jarvis_conversations_v1',
  ACTIVE_CONVERSATION: 'jarvis_active_conversation_v1',
  MEMORIES: 'jarvis_memories_v1',
  SEARCH_HISTORY: 'jarvis_search_history_v1',
} as const;

export const DEFAULT_SETTINGS: JarvisSettings = {
  assistantName: 'JARVIS',
  greeting: 'Good day. JARVIS systems are online.',
  model: 'gemini-4-hydrogen',
  thinkingDepth: 'HIGH',
  responseStyle: 'balanced',
  maxResponseNote: 'auto',
  useWebSearchInChat: false,
  showCitations: true,
  memoryEnabled: true,
  privacyFilterEnabled: true,
  accentTheme: 'cyan',
  colorMode: 'dark',
  chatFontSize: 'medium',
  animationLevel: 'full',
  soundEffects: false,
  voiceUri: '',
  voiceRate: 1.0,
  voicePitch: 1.0,
  autoListenAfterSpeak: false,
  language: 'English',
};

export function loadSettings(): JarvisSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: JarvisSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // Ignore quota failures silently
  }
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    // Strip large inline base64 payloads from persisted history to stay within localStorage limits
    const lightweight = conversations.slice(0, 60).map((conv) => ({
      ...conv,
      messages: conv.messages.map((msg) => ({
        ...msg,
        attachments: msg.attachments?.map((att) => ({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
          kind: att.kind,
          textContent: att.textContent ? att.textContent.slice(0, 4000) : undefined,
        })),
      })),
    }));
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(lightweight));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
    }
  } catch {
    // Ignore
  }
}

export function loadMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(memories: MemoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
  } catch {
    // Ignore
  }
}

export function loadSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(entries: SearchHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(entries.slice(0, 30)));
  } catch {
    // Ignore
  }
}

export function clearAllLocalData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  });
}

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z\-_]{20,}/i,
  /sk-[0-9A-Za-z]{20,}/i,
  /ghp_[0-9A-Za-z]{20,}/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,16}\b/,
];

export function detectSensitiveData(text: string): string | null {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return 'Memory appears to contain sensitive credentials, tokens, or payment/ID numbers. For your security, avoid saving secrets in AI memory.';
    }
  }
  return null;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'html',
  'css',
  'yaml',
  'yml',
  'xml',
  'sql',
  'sh',
  'log',
]);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function processUploadedFile(file: File): Promise<FileAttachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 8 MB upload limit (${formatBytes(file.size)}).`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (IMAGE_MIMES.has(file.type)) {
    const dataUrl = await readFileAsDataUrl(file);
    const base64Data = dataUrl.split(',')[1] || '';
    return {
      id,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'image',
      previewUrl: dataUrl,
      base64Data,
    };
  }

  if (file.type === 'application/pdf' || ext === 'pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    const base64Data = dataUrl.split(',')[1] || '';
    return {
      id,
      name: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      kind: 'document',
      base64Data,
    };
  }

  if (file.type.startsWith('text/') || file.type === 'application/json' || TEXT_EXTENSIONS.has(ext)) {
    const textContent = await file.text();
    return {
      id,
      name: file.name,
      mimeType: file.type || 'text/plain',
      size: file.size,
      kind: 'text',
      textContent: textContent.slice(0, 40000),
    };
  }

  throw new Error(
    `Unsupported file type for "${file.name}". Supported: PNG, JPEG, WEBP, GIF, PDF, TXT, MD, CSV, JSON, and source code files.`
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

let audioCtx: AudioContext | null = null;

export function playHudTone(type: 'send' | 'receive' | 'listen' | 'error', enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.001, now);

    if (type === 'listen') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'send') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'receive') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(170, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    }
  } catch {
    // Ignore audio context issues
  }
}
