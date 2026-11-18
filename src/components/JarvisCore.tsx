import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { AnimationLevel, CoreState } from '../types/jarvis';

interface JarvisCoreProps {
  state: CoreState;
  size?: 'sm' | 'md' | 'lg';
  audioLevel?: number; // 0..1 reactive input/output amplitude
  animationLevel?: AnimationLevel;
  assistantName?: string;
  onClick?: () => void;
}

const STATE_LABELS: Record<CoreState, { label: string; sub: string; toneClass: string }> = {
  idle: {
    label: 'Standby',
    sub: 'Ready for command',
    toneClass: 'text-cyan-600 dark:text-cyan-300',
  },
  listening: {
    label: 'Listening',
    sub: 'Capturing voice input',
    toneClass: 'text-sky-600 dark:text-sky-300',
  },
  thinking: {
    label: 'Processing',
    sub: 'Synthesizing response',
    toneClass: 'text-amber-600 dark:text-amber-300',
  },
  speaking: {
    label: 'Speaking',
    sub: 'Voice output active',
    toneClass: 'text-emerald-600 dark:text-emerald-300',
  },
  error: {
    label: 'Attention',
    sub: 'Check diagnostics',
    toneClass: 'text-rose-600 dark:text-rose-400',
  },
};

const SIZE_MAP = {
  sm: 120,
  md: 210,
  lg: 280,
};

export function JarvisCore({
  state,
  size = 'lg',
  audioLevel = 0,
  animationLevel = 'full',
  assistantName = 'JARVIS',
  onClick,
}: JarvisCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CoreState>(state);
  const levelRef = useRef<number>(audioLevel);
  const animRef = useRef<AnimationLevel>(animationLevel);

  stateRef.current = state;
  levelRef.current = audioLevel;
  animRef.current = animationLevel;

  const px = SIZE_MAP[size];
  const meta = STATE_LABELS[state];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = px / 2;
    const cy = px / 2;
    const baseRadius = px * 0.29;

    const particleCount = size === 'lg' ? 38 : size === 'md' ? 24 : 14;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      angle: (Math.PI * 2 * i) / particleCount,
      radiusOffset: (Math.random() - 0.5) * (px * 0.14),
      speed: (0.003 + Math.random() * 0.005) * (i % 2 === 0 ? 1 : -1),
      size: 1 + Math.random() * 1.6,
      alpha: 0.35 + Math.random() * 0.55,
    }));

    let rafId = 0;
    let phase = 0;

    const getStrokeColor = (curState: CoreState): string => {
      if (curState === 'error') return '239, 68, 68';
      if (curState === 'thinking') return '245, 158, 11';
      if (curState === 'speaking') return '16, 185, 129';
      if (curState === 'listening') return '56, 189, 248';
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--jarvis-accent-rgb')
        .trim();
      return raw || '6, 182, 212';
    };

    const draw = () => {
      ctx.clearRect(0, 0, px, px);
      const curState = stateRef.current;
      const curAnim = animRef.current;
      const reduced =
        curAnim === 'reduced' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const rgb = getStrokeColor(curState);
      const lvl = Math.min(1, Math.max(0, levelRef.current));

      const speedMult =
        curState === 'thinking'
          ? 2.2
          : curState === 'speaking'
          ? 1.7
          : curState === 'listening'
          ? 1.4
          : 0.7;

      if (!reduced) {
        phase += 0.025 * speedMult;
      }

      // Radial core glow
      const glowRadius = baseRadius * (1.35 + lvl * 0.45);
      const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, glowRadius);
      grad.addColorStop(0, `rgba(${rgb}, ${0.28 + lvl * 0.25})`);
      grad.addColorStop(0.6, `rgba(${rgb}, 0.08)`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Circular sound/activity waveform ring
      const bars = size === 'lg' ? 64 : size === 'md' ? 48 : 32;
      ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
      ctx.lineWidth = size === 'sm' ? 1.4 : 2;

      for (let i = 0; i < bars; i++) {
        const angle = (Math.PI * 2 * i) / bars;
        let amp = 0;
        if (curState === 'speaking' || curState === 'listening') {
          const wave = Math.sin(angle * 6 + phase * 3) * 0.5 + 0.5;
          const secondary = Math.cos(angle * 4 - phase * 2) * 0.5 + 0.5;
          amp = (3 + lvl * (px * 0.075)) * (0.45 + 0.55 * wave * secondary);
        } else if (curState === 'thinking') {
          amp = (3 + Math.sin(angle * 8 + phase * 4) * 5) * (reduced ? 0.4 : 1);
        } else if (curState === 'error') {
          amp = 3 + Math.abs(Math.sin(phase * 3)) * 4;
        } else {
          amp = 2 + Math.sin(angle * 3 + phase) * 2.2;
        }

        const innerR = baseRadius * 0.88;
        const outerR = innerR + amp;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.stroke();
      }

      // Orbiting reactive particles (if animationLevel !== 'reduced')
      if (curAnim === 'full' && !reduced) {
        for (const p of particles) {
          p.angle += p.speed * speedMult;
          const r = baseRadius * 1.24 + p.radiusOffset + lvl * 10;
          const x = cx + Math.cos(p.angle) * r;
          const y = cy + Math.sin(p.angle) * r;
          ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduced) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [px, size, state, animationLevel]);

  const isReduced = animationLevel === 'reduced';

  const ringStroke =
    state === 'error'
      ? 'stroke-rose-500/60'
      : state === 'thinking'
      ? 'stroke-amber-400/65'
      : state === 'speaking'
      ? 'stroke-emerald-400/65'
      : 'stroke-cyan-400/55';

  return (
    <div className="flex flex-col items-center select-none">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${assistantName} Core — Status: ${meta.label}`}
        className={`relative flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 ${
          onClick ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ width: px, height: px }}
      >
        {/* Outer rotating precision telemetry ring */}
        <svg
          viewBox="0 0 200 200"
          className={`absolute inset-0 h-full w-full ${
            isReduced ? '' : state === 'thinking' ? 'animate-[spin_7s_linear_infinite]' : 'animate-spin-slow'
          }`}
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            className="stroke-slate-300/60 dark:stroke-slate-700/80"
            strokeWidth="1"
            strokeDasharray="3 6"
          />
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            className={ringStroke}
            strokeWidth="2"
            strokeDasharray="44 18 14 26"
            strokeLinecap="round"
          />
        </svg>

        {/* Counter-rotating inner HUD ring */}
        <svg
          viewBox="0 0 200 200"
          className={`absolute inset-0 h-full w-full ${
            isReduced
              ? ''
              : state === 'thinking'
              ? 'animate-[spin_5s_linear_infinite_reverse]'
              : 'animate-spin-reverse-slow'
          }`}
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            className={ringStroke}
            strokeWidth="1.5"
            strokeDasharray="24 12 8 16"
          />
          <circle
            cx="100"
            cy="100"
            r="58"
            fill="none"
            className="stroke-slate-300/40 dark:stroke-slate-600/60"
            strokeWidth="1"
          />
        </svg>

        {/* Canvas waveform & particles */}
        <canvas
          ref={canvasRef}
          width={px}
          height={px}
          className="relative z-10 pointer-events-none"
        />

        {/* Center Arc Core Emblem */}
        <motion.div
          animate={
            isReduced
              ? { scale: 1 }
              : state === 'thinking'
              ? { scale: [0.96, 1.05, 0.96] }
              : state === 'speaking' || state === 'listening'
              ? { scale: 1 + audioLevel * 0.08 }
              : { scale: [0.985, 1.015, 0.985] }
          }
          transition={{
            duration: state === 'thinking' ? 1.1 : 2.8,
            repeat: state === 'speaking' || state === 'listening' ? 0 : Infinity,
            ease: 'easeInOut',
          }}
          className="absolute z-20 flex flex-col items-center justify-center rounded-full border border-cyan-500/35 bg-white/85 dark:bg-[#08101C]/90 backdrop-blur-md shadow-inner"
          style={{
            width: px * 0.34,
            height: px * 0.34,
          }}
        >
          <span
            className={`font-display font-semibold tracking-[0.18em] ${
              size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'
            } text-slate-900 dark:text-slate-100`}
          >
            {assistantName.slice(0, 8)}
          </span>
          {size !== 'sm' && (
            <span className={`mt-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.toneClass}`}>
              {meta.label}
            </span>
          )}
        </motion.div>
      </button>

      {size !== 'sm' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className={`font-medium ${meta.toneClass}`}>{meta.label}</span>
          <span aria-hidden="true">·</span>
          <span>{meta.sub}</span>
        </div>
      )}
    </div>
  );
}
