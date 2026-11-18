import { useState } from 'react';
import {
  AlertTriangle,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { JarvisCore } from './JarvisCore';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ChatMessage, CoreState, JarvisSettings } from '../types/jarvis';
import type { VoiceCapabilities } from '../hooks/useVoiceAssistant';

interface VoiceViewProps {
  settings: JarvisSettings;
  onUpdateSettings: (patch: Partial<JarvisSettings>) => void;
  capabilities: VoiceCapabilities;
  voices: SpeechSynthesisVoice[];
  voiceState: CoreState;
  isPaused: boolean;
  interimTranscript: string;
  audioLevel: number;
  voiceError: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onPauseSpeaking: () => void;
  onResumeSpeaking: () => void;
  onStopGenerating: () => void;
  onSendVoicePrompt: (text: string) => void;
  onSpeakMessage: (text: string) => void;
}

export function VoiceView({
  settings,
  onUpdateSettings,
  capabilities,
  voices,
  voiceState,
  isPaused,
  interimTranscript,
  audioLevel,
  voiceError,
  messages,
  isGenerating,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onPauseSpeaking,
  onResumeSpeaking,
  onStopGenerating,
  onSendVoicePrompt,
  onSpeakMessage,
}: VoiceViewProps) {
  const [manualInput, setManualInput] = useState('');

  const effectiveState: CoreState = isGenerating
    ? 'thinking'
    : voiceState;

  const recentTurns = messages.slice(-6);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim() || isGenerating) return;
    onSendVoicePrompt(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      {/* Top Capability Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Voice Assistant
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Speech Input:{' '}
              <strong className={capabilities.recognitionSupported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {capabilities.recognitionSupported ? 'Supported' : 'Unsupported in browser'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Speech Output:{' '}
              <strong className={capabilities.synthesisSupported ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {capabilities.synthesisSupported ? 'Supported' : 'Unsupported'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Microphone:{' '}
              <strong className="text-slate-700 dark:text-slate-200 capitalize">
                {capabilities.micPermission}
              </strong>
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoListenAfterSpeak}
            onChange={(e) => onUpdateSettings({ autoListenAfterSpeak: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 accent-cyan-500"
          />
          <span>Listen again after speaking</span>
        </label>
      </div>

      {/* Browser Limitation / Error Notice */}
      {(!capabilities.recognitionSupported || voiceError) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            {voiceError && <p>{voiceError}</p>}
            {!capabilities.recognitionSupported && (
              <p>
                This browser does not expose the Web Speech Recognition API. You can still type prompts below and listen to spoken responses via Speech Synthesis.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Center Core & Voice Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-6 lg:col-span-5">
          <JarvisCore
            state={effectiveState}
            size="lg"
            audioLevel={audioLevel}
            animationLevel={settings.animationLevel}
            assistantName={settings.assistantName}
            onClick={() => {
              if (effectiveState === 'listening') onStopListening();
              else if (effectiveState === 'speaking') onStopSpeaking();
              else if (capabilities.recognitionSupported && !isGenerating) onStartListening();
            }}
          />

          {/* Live interim transcript */}
          <div className="mt-5 min-h-[48px] w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-4 py-2.5 text-center text-sm text-slate-700 dark:text-slate-300">
            {effectiveState === 'listening'
              ? interimTranscript || 'Listening... speak clearly into your microphone.'
              : effectiveState === 'thinking'
              ? `${settings.assistantName} is formulating a response...`
              : effectiveState === 'speaking'
              ? isPaused
                ? 'Speech paused.'
                : 'Speaking response aloud. Click Stop to interrupt.'
              : 'Press Listen for turn-based voice interaction.'}
          </div>

          {/* Voice Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {effectiveState === 'listening' ? (
              <button
                type="button"
                onClick={onStopListening}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-500 transition-colors"
              >
                <MicOff className="h-4 w-4" />
                <span>Stop Listening</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartListening}
                disabled={!capabilities.recognitionSupported || isGenerating}
                className="inline-flex items-center gap-2 rounded-xl hud-accent-bg px-5 py-2.5 text-sm font-medium text-slate-950 hover:opacity-90 disabled:opacity-45 transition-opacity"
              >
                <Mic className="h-4 w-4" />
                <span>Listen</span>
              </button>
            )}

            {isGenerating && (
              <button
                type="button"
                onClick={onStopGenerating}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
              >
                <Square className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            )}

            {effectiveState === 'speaking' && (
              <>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={onResumeSpeaking}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Play className="h-4 w-4" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPauseSpeaking}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Pause className="h-4 w-4" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                >
                  <VolumeX className="h-4 w-4" />
                  <span>Stop Speaking</span>
                </button>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Flow: Listen → Transcribe → Think → Respond → Speak. Turn-based browser speech recognition (no background wake-word).
          </p>
        </div>

        {/* Right: Voice Config & Live Transcript Log */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* Voice Synthesis Quick Controls */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Speech Voice
              </label>
              <select
                value={settings.voiceUri}
                onChange={(e) => onUpdateSettings({ voiceUri: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">System Default</option>
                {voices.map((v, idx) => (
                  <option key={`${v.voiceURI}::${v.name}::${v.lang}::${idx}`} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
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
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <label className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                <span>Pitch</span>
                <span className="font-mono tabular-nums">{settings.voicePitch.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.1"
                value={settings.voicePitch}
                onChange={(e) => onUpdateSettings({ voicePitch: Number(e.target.value) })}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Voice Conversation Transcript */}
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B101B]/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Voice & Session Exchange
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {recentTurns.length} messages
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1">
              {recentTurns.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
                  Tap Listen or enter a message below to start a spoken exchange with {settings.assistantName}.
                </div>
              ) : (
                recentTurns.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl border p-3 ${
                      msg.role === 'user'
                        ? 'border-cyan-500/25 bg-cyan-500/5 ml-6'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 mr-6'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {msg.role === 'user' ? 'You' : settings.assistantName}
                      </span>
                      {msg.role === 'assistant' && msg.content && capabilities.synthesisSupported && (
                        <button
                          type="button"
                          onClick={() => onSpeakMessage(msg.content)}
                          className="inline-flex items-center gap-1 text-xs hud-accent-text hover:underline"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Speak</span>
                        </button>
                      )}
                    </div>
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content || '...'} fontSize={settings.chatFontSize} />
                    ) : (
                      <p className="text-sm text-slate-800 dark:text-slate-200">{msg.content}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Typed fallback / quick voice prompt */}
            <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={`Type a message for ${settings.assistantName} to answer & speak...`}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualInput.trim() || isGenerating}
                className="inline-flex items-center gap-1.5 rounded-xl hud-accent-bg px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
