import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoreState } from '../types/jarvis';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface VoiceCapabilities {
  recognitionSupported: boolean;
  synthesisSupported: boolean;
  micPermission: 'unknown' | 'granted' | 'denied' | 'prompt';
}

function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useVoiceAssistant(options: {
  voiceUri: string;
  voiceRate: number;
  voicePitch: number;
  language: string;
  autoListenAfterSpeak: boolean;
  onTranscriptFinal: (transcript: string) => void;
}) {
  const [capabilities, setCapabilities] = useState<VoiceCapabilities>({
    recognitionSupported: false,
    synthesisSupported: false,
    micPermission: 'unknown',
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceState, setVoiceState] = useState<CoreState>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const speakPulseRef = useRef<number>(0);
  const transcriptCallbackRef = useRef(options.onTranscriptFinal);
  transcriptCallbackRef.current = options.onTranscriptFinal;

  const autoListenRef = useRef(options.autoListenAfterSpeak);
  autoListenRef.current = options.autoListenAfterSpeak;

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const recognitionSupported = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    setCapabilities((prev) => ({
      ...prev,
      recognitionSupported,
      synthesisSupported,
    }));

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          setCapabilities((prev) => ({
            ...prev,
            micPermission: status.state as 'granted' | 'denied' | 'prompt',
          }));
          status.onchange = () => {
            setCapabilities((prev) => ({
              ...prev,
              micPermission: status.state as 'granted' | 'denied' | 'prompt',
            }));
          };
        })
        .catch(() => {
          // Permissions API unavailable for microphone in this browser
        });
    }

    if (synthesisSupported) {
      const loadVoices = () => {
        const rawList = window.speechSynthesis.getVoices();
        const seen = new Set<string>();
        const unique = rawList.filter((v) => {
          const sig = `${v.voiceURI}::${v.name}::${v.lang}`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });
        setVoices(unique);
      };
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

  const stopMicAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startMicAnalyser = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setCapabilities((prev) => ({ ...prev, micPermission: 'granted' }));

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / (data.length * 255);
        setAudioLevel(Math.min(1, avg * 2.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setCapabilities((prev) => ({ ...prev, micPermission: 'denied' }));
        setVoiceError('Microphone access was denied. Enable microphone permission in your browser settings to use voice input.');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore already stopped
      }
      recognitionRef.current = null;
    }
    stopMicAnalyser();
    setInterimTranscript('');
    setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, [stopMicAnalyser]);

  const stopSpeaking = useCallback(() => {
    if (speakPulseRef.current) {
      clearInterval(speakPulseRef.current);
      speakPulseRef.current = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPaused(false);
    setAudioLevel(0);
    setVoiceState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const startListening = useCallback(async () => {
    setVoiceError(null);
    stopSpeaking();

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceError('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari, or type your message.');
      setVoiceState('error');
      return;
    }

    if (recognitionRef.current) {
      stopListening();
      return;
    }

    await startMicAnalyser();

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang =
      options.language === 'Spanish'
        ? 'es-ES'
        : options.language === 'French'
        ? 'fr-FR'
        : options.language === 'German'
        ? 'de-DE'
        : options.language === 'Japanese'
        ? 'ja-JP'
        : 'en-US';

    let finalBuffer = '';

    recognition.onstart = () => {
      setVoiceState('listening');
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalBuffer += `${text} `;
        } else {
          interim += text;
        }
      }
      setInterimTranscript((finalBuffer + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setCapabilities((prev) => ({ ...prev, micPermission: 'denied' }));
        setVoiceError('Microphone permission denied. Allow microphone access in browser site settings.');
        setVoiceState('error');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech was detected. Click Listen and speak clearly.');
        setVoiceState('idle');
      } else if (event.error !== 'aborted') {
        setVoiceError(`Voice recognition error: ${event.error}`);
        setVoiceState('error');
      }
      stopMicAnalyser();
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      stopMicAnalyser();
      recognitionRef.current = null;
      const committed = finalBuffer.trim();
      setInterimTranscript('');
      if (committed) {
        setVoiceState('thinking');
        transcriptCallbackRef.current(committed);
      } else {
        setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to start speech recognition.');
      setVoiceState('error');
      stopMicAnalyser();
    }
  }, [options.language, startMicAnalyser, stopListening, stopMicAnalyser, stopSpeaking]);

  const speak = useCallback(
    (rawText: string) => {
      if (!capabilities.synthesisSupported) {
        setVoiceError('Text-to-speech is not supported in this browser.');
        return;
      }
      const clean = stripMarkdownForSpeech(rawText);
      if (!clean) return;

      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(clean);
      const selectedVoice = voices.find((v) => v.voiceURI === options.voiceUri);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = Math.min(2, Math.max(0.6, options.voiceRate || 1));
      utterance.pitch = Math.min(1.6, Math.max(0.6, options.voicePitch || 1));

      utterance.onstart = () => {
        setVoiceState('speaking');
        setIsPaused(false);
        speakPulseRef.current = window.setInterval(() => {
          setAudioLevel(0.25 + Math.random() * 0.55);
        }, 120);
      };

      utterance.onend = () => {
        if (speakPulseRef.current) {
          clearInterval(speakPulseRef.current);
          speakPulseRef.current = 0;
        }
        setAudioLevel(0);
        setIsPaused(false);
        setVoiceState('idle');
        if (autoListenRef.current) {
          void startListening();
        }
      };

      utterance.onerror = () => {
        if (speakPulseRef.current) {
          clearInterval(speakPulseRef.current);
          speakPulseRef.current = 0;
        }
        setAudioLevel(0);
        setIsPaused(false);
        setVoiceState('idle');
      };

      window.speechSynthesis.speak(utterance);
    },
    [
      capabilities.synthesisSupported,
      options.voicePitch,
      options.voiceRate,
      options.voiceUri,
      startListening,
      stopSpeaking,
      voices,
    ]
  );

  const pauseSpeaking = useCallback(() => {
    if (capabilities.synthesisSupported && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setAudioLevel(0.05);
    }
  }, [capabilities.synthesisSupported]);

  const resumeSpeaking = useCallback(() => {
    if (capabilities.synthesisSupported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [capabilities.synthesisSupported]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  return {
    capabilities,
    voices,
    voiceState,
    setVoiceState,
    isPaused,
    interimTranscript,
    audioLevel,
    voiceError,
    setVoiceError,
    startListening,
    stopListening,
    speak,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
  };
}
