"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";

import { cn } from "../_utils/cn";

export interface ProgressiveFluxPhase {
  at: number;
  label: string;
}

export interface ProgressiveFluxLoaderProps {
  value?: number;
  phases?: ProgressiveFluxPhase[];
  duration?: number;
  loop?: boolean;
  showLabel?: boolean;
  gradient?: string;
  onComplete?: () => void;
  className?: string;
  barClassName?: string;
  textClassName?: string;
}

const DEFAULT_PHASES: ProgressiveFluxPhase[] = [
  { at: 0, label: "starting up" },
  { at: 25, label: "loading assets" },
  { at: 55, label: "preparing magic" },
  { at: 80, label: "almost there" },
  { at: 100, label: "all done" },
];

const FLUX_FROM = "var(--flux-from, #1d6ffb)";
const FLUX_TO = "var(--flux-to, #74e1ff)";
const FLUX_MID = `color-mix(in oklab, ${FLUX_FROM}, ${FLUX_TO})`;
const DEFAULT_GRADIENT = `linear-gradient(90deg, ${FLUX_FROM} 0%, ${FLUX_MID} 35%, ${FLUX_TO} 55%, ${FLUX_MID} 78%, ${FLUX_FROM} 100%)`;
const BAR_SHADOW = `0 0 18px color-mix(in oklab, ${FLUX_FROM} 55%, transparent), 0 0 32px color-mix(in oklab, ${FLUX_TO} 40%, transparent), inset 0 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 3px rgba(0, 40, 120, 0.35)`;
const SHEEN_GRADIENT = "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.55) 50%, transparent 100%)";

const Z_TRANSITION: Transition = { duration: 0.9, ease: [0.22, 1, 0.36, 1] };
const LETTER_TRANSITION: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

function pickLabel(value: number, sortedPhases: ProgressiveFluxPhase[]) {
  let active = sortedPhases[0]?.label ?? "";
  for (const phase of sortedPhases) {
    if (value >= phase.at) active = phase.label;
  }
  return active;
}

interface FluxLabelProps {
  label: string;
  reduced: boolean;
  className?: string;
}

function FluxLabel({ label, reduced, className }: FluxLabelProps) {
  const base = cn(
    "absolute inset-0 flex items-center justify-center text-center text-3xl font-semibold tracking-tight text-[#737373] sm:text-4xl",
    className,
  );

  if (reduced) {
    return (
      <div aria-hidden className={base}>
        {label}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={label}
        aria-hidden
        className={base}
        style={{ transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, z: -380, scale: 0.65, filter: "blur(14px)" }}
        animate={{
          opacity: [0, 1, 1, 1],
          z: [-380, 60, -8, 0],
          scale: [0.65, 1.08, 0.985, 1],
          filter: ["blur(14px)", "blur(0px)", "blur(0px)", "blur(0px)"],
        }}
        exit={{
          opacity: 0,
          z: 220,
          scale: 1.35,
          filter: "blur(10px)",
          transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] },
        }}
        transition={Z_TRANSITION}
      >
        <span className="inline-flex">
          {label.split("").map((char, index) => (
            <motion.span
              key={`${label}-${index}`}
              className="inline-block"
              initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...LETTER_TRANSITION, delay: 0.18 + index * 0.035 }}
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export function ProgressiveFluxLoader({
  value,
  phases = DEFAULT_PHASES,
  duration = 12,
  loop = true,
  showLabel = true,
  gradient = DEFAULT_GRADIENT,
  onComplete,
  className,
  barClassName,
  textClassName,
}: ProgressiveFluxLoaderProps) {
  const reduced = !!useReducedMotion();
  const isControlled = typeof value === "number";
  const [internal, setInternal] = React.useState(0);
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (isControlled) return;
    let raf = 0;
    let timer = 0;
    let start: number | null = null;
    const totalMs = Math.max(500, duration * 1000);

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const pct = Math.min(100, ((ts - start) / totalMs) * 100);
      setInternal(pct);
      if (pct >= 100) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
        if (loop) {
          start = null;
          completedRef.current = false;
          timer = window.setTimeout(() => {
            setInternal(0);
            raf = requestAnimationFrame(tick);
          }, 700);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [isControlled, duration, loop]);

  const raw = isControlled ? value! : internal;
  const current = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;

  React.useEffect(() => {
    if (!isControlled) return;
    if (current >= 100 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    } else if (current < 100) {
      completedRef.current = false;
    }
  }, [isControlled, current]);

  const sortedPhases = React.useMemo(
    () => [...phases].sort((a, b) => a.at - b.at),
    [phases],
  );
  const label = React.useMemo(
    () => pickLabel(current, sortedPhases),
    [current, sortedPhases],
  );
  const rounded = Math.round(current);

  return (
    <div className={cn("mx-auto flex w-full max-w-md flex-col items-center gap-8", className)}>
      {showLabel && (
        <div className="relative h-16 w-full select-none" style={reduced ? undefined : { perspective: "1000px" }}>
          <FluxLabel label={label} reduced={reduced} className={textClassName} />
        </div>
      )}

      <div
        className={cn(
          "relative h-5 w-full overflow-hidden rounded-full bg-[#f5f5f5] shadow-[inset_0_2px_3px_rgba(0,0,0,0.09),inset_0_-1px_2px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_2px_3px_rgba(0,0,0,0.45),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
          barClassName,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={label ? `${rounded}% – ${label}` : `${rounded}%`}
        aria-label="Loading"
      >
        <motion.div
          className="relative h-full rounded-full"
          style={{ background: gradient, boxShadow: BAR_SHADOW }}
          initial={false}
          animate={{ width: `${current}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {!reduced && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full"
              style={{ background: SHEEN_GRADIENT, mixBlendMode: "screen" }}
              animate={{ x: ["-110%", "210%"] }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default ProgressiveFluxLoader;
