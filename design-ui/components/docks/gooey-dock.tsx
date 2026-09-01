"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

export interface DockItem {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface GooeyDockProps {
  items: DockItem[];
  sound?: boolean;
}

const BASE = 40;
const PEAK = 58;
const LIFT = 14;
const RADIUS = 150;
const SPRING = { mass: 0.1, stiffness: 200, damping: 14 };

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;

function audioCtx() {
  if (!ctx) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function ensureBuffer(ac: AudioContext) {
  if (buffer && buffer.sampleRate === ac.sampleRate) return buffer;
  const len = Math.floor(ac.sampleRate * 0.003);
  const next = ac.createBuffer(1, len, ac.sampleRate);
  const channel = next.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    const t = i / len;
    channel[i] = (Math.random() * 2 - 1) * (1 - t) ** 4;
  }
  buffer = next;
  return next;
}

function playTick(last: React.MutableRefObject<number>) {
  const now = performance.now();
  if (now - last.current < 80) return;
  last.current = now;
  try {
    const ac = audioCtx();
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    source.buffer = ensureBuffer(ac);
    source.playbackRate.value = 1.2;
    gain.gain.value = 0.035;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch {
    // Audio is an enhancement only.
  }
}

function cosineScale(distance: number) {
  const absolute = Math.abs(distance);
  if (absolute > RADIUS) return 0;
  return (1 + Math.cos((absolute / RADIUS) * Math.PI)) / 2;
}

const DOCK_CSS = `.gd{--gd-ink:0,0,0}.dark .gd,[data-theme="dark"] .gd{--gd-ink:255,255,255}`;

function DockIcon({
  icon,
  label,
  active,
  onClick,
  mouseX,
  sound,
  lastSound,
}: DockItem & {
  mouseX: MotionValue<number>;
  sound: boolean;
  lastSound: React.MutableRefObject<number>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const distance = useTransform(mouseX, (value) => {
    const element = ref.current;
    if (!element) return Infinity;
    const rect = element.getBoundingClientRect();
    return value - rect.left - rect.width / 2;
  });
  const size = useSpring(useTransform(distance, (d) => BASE + (PEAK - BASE) * cosineScale(d)), SPRING);
  const y = useSpring(useTransform(distance, (d) => -LIFT * cosineScale(d)), SPRING);
  const bgOpacity = useSpring(useTransform(distance, (d) => cosineScale(d) * 0.08), SPRING);
  const iconScale = useSpring(useTransform(size, [BASE, PEAK], [1, 1.2]), SPRING);

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size,
        y,
        borderRadius: 12,
        cursor: "pointer",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        backgroundColor: useTransform(bgOpacity, (value) => `rgba(var(--gd-ink),${value})`),
      }}
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        if (sound) playTick(lastSound);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(var(--gd-ink),0.6)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {label}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.div
        style={{
          scale: iconScale,
          color: `rgba(var(--gd-ink),${hovered ? 0.8 : 0.45})`,
          transition: "color 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </motion.div>
      {active ? <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "rgba(var(--gd-ink),0.35)" }} /> : null}
    </motion.div>
  );
}

/** Source-faithful Ruixen UI proximity magnification dock. */
export function GooeyDock({ items, sound = true }: GooeyDockProps) {
  const mouseX = useMotionValue(Infinity);
  const lastSound = useRef(0);

  return (
    <div
      className="gd"
      onMouseMove={(event) => mouseX.set(event.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "8px 12px 10px", borderRadius: 18, border: "1px solid rgba(var(--gd-ink),0.06)", background: "rgba(var(--gd-ink),0.02)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: DOCK_CSS }} />
      {items.map((item, index) => <DockIcon key={`${item.label}-${index}`} {...item} mouseX={mouseX} sound={sound} lastSound={lastSound} />)}
    </div>
  );
}

export default GooeyDock;
