"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export type CardStackItem = {
  id: string | number;
  title: string;
  description?: string;
  imageSrc?: string;
  href?: string;
  tag?: string;
};

export type CardStackProps<T extends CardStackItem> = {
  items: T[];
  initialIndex?: number;
  maxVisible?: number;
  cardWidth?: number;
  cardHeight?: number;
  overlap?: number;
  spreadDeg?: number;
  perspectivePx?: number;
  depthPx?: number;
  tiltXDeg?: number;
  activeLiftPx?: number;
  activeScale?: number;
  inactiveScale?: number;
  springStiffness?: number;
  springDamping?: number;
  loop?: boolean;
  autoAdvance?: boolean;
  intervalMs?: number;
  pauseOnHover?: boolean;
  showDots?: boolean;
  className?: string;
  onChangeIndex?: (index: number, item: T) => void;
  renderCard?: (item: T, state: { active: boolean }) => React.ReactNode;
};

function wrapIndex(n: number, len: number) {
  if (len <= 0) return 0;
  return ((n % len) + len) % len;
}

function signedOffset(i: number, active: number, len: number, loop: boolean) {
  const raw = i - active;
  if (!loop || len <= 1) return raw;
  const alt = raw > 0 ? raw - len : raw + len;
  return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

/** Ruixen Card Stack, adapted only to replace Next.js Link with a normal anchor. */
export function CardStack<T extends CardStackItem>({
  items,
  initialIndex = 0,
  maxVisible = 7,
  cardWidth = 520,
  cardHeight = 320,
  overlap = 0.48,
  spreadDeg = 48,
  perspectivePx = 1100,
  depthPx = 140,
  tiltXDeg = 12,
  activeLiftPx = 22,
  activeScale = 1.03,
  inactiveScale = 0.94,
  springStiffness = 280,
  springDamping = 28,
  loop = true,
  autoAdvance = false,
  intervalMs = 2800,
  pauseOnHover = true,
  showDots = true,
  className,
  onChangeIndex,
  renderCard,
}: CardStackProps<T>) {
  const reduceMotion = useReducedMotion();
  const len = items.length;
  const [active, setActive] = React.useState(() => wrapIndex(initialIndex, len));
  const [hovering, setHovering] = React.useState(false);

  React.useEffect(() => setActive((value) => wrapIndex(value, len)), [len]);
  React.useEffect(() => {
    if (len) onChangeIndex?.(active, items[active]!);
  }, [active, items, len, onChangeIndex]);

  const maxOffset = Math.max(0, Math.floor(maxVisible / 2));
  const cardSpacing = Math.max(10, Math.round(cardWidth * (1 - overlap)));
  const stepDeg = maxOffset > 0 ? spreadDeg / maxOffset : 0;
  const canGoPrev = loop || active > 0;
  const canGoNext = loop || active < len - 1;

  const prev = React.useCallback(() => {
    if (len && canGoPrev) setActive((value) => wrapIndex(value - 1, len));
  }, [canGoPrev, len]);
  const next = React.useCallback(() => {
    if (len && canGoNext) setActive((value) => wrapIndex(value + 1, len));
  }, [canGoNext, len]);

  React.useEffect(() => {
    if (!autoAdvance || reduceMotion || !len || (pauseOnHover && hovering)) return;
    const id = window.setInterval(() => {
      if (loop || active < len - 1) next();
    }, Math.max(700, intervalMs));
    return () => window.clearInterval(id);
  }, [active, autoAdvance, hovering, intervalMs, len, loop, next, pauseOnHover, reduceMotion]);

  if (!len) return null;
  const activeItem = items[active]!;

  return (
    <div className={cn("w-full", className)} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div
        className="relative w-full outline-none"
        style={{ height: Math.max(380, cardHeight + 80) }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") prev();
          if (event.key === "ArrowRight") next();
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-48 w-[70%] rounded-full bg-black/5 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-0 flex items-end justify-center" style={{ perspective: `${perspectivePx}px` }}>
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const off = signedOffset(i, active, len, loop);
              const abs = Math.abs(off);
              if (abs > maxOffset) return null;
              const rotateZ = off * stepDeg;
              const x = off * cardSpacing;
              const y = abs * 10;
              const z = -abs * depthPx;
              const isActive = off === 0;
              const scale = isActive ? activeScale : inactiveScale;
              const lift = isActive ? -activeLiftPx : 0;
              const rotateX = isActive ? 0 : tiltXDeg;
              const dragProps = isActive
                ? {
                    drag: "x" as const,
                    dragConstraints: { left: 0, right: 0 },
                    dragElastic: 0.18,
                    onDragEnd: (_event: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
                      if (reduceMotion) return;
                      const threshold = Math.min(160, cardWidth * 0.22);
                      if (info.offset.x > threshold || info.velocity.x > 650) prev();
                      else if (info.offset.x < -threshold || info.velocity.x < -650) next();
                    },
                  }
                : {};

              return (
                <motion.div
                  key={item.id}
                  className={cn(
                    "absolute bottom-0 select-none overflow-hidden rounded-2xl border-4 border-black/10 shadow-xl will-change-transform",
                    isActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                  )}
                  style={{ width: cardWidth, height: cardHeight, zIndex: 100 - abs, transformStyle: "preserve-3d" }}
                  initial={reduceMotion ? false : { opacity: 0, y: y + 40, x, rotateZ, rotateX, scale }}
                  animate={{ opacity: 1, x, y: y + lift, rotateZ, rotateX, scale }}
                  transition={{ type: "spring", stiffness: springStiffness, damping: springDamping }}
                  onClick={() => setActive(i)}
                  {...dragProps}
                >
                  <div className="h-full w-full" style={{ transform: `translateZ(${z}px)`, transformStyle: "preserve-3d" }}>
                    {renderCard ? <>{renderCard(item, { active: isActive })}</> : <DefaultFanCard item={item} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {showDots ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            {items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(idx)}
                className={cn("h-2 w-2 rounded-full transition", idx === active ? "bg-neutral-900" : "bg-neutral-300 hover:bg-neutral-500")}
                aria-label={`Go to ${item.title}`}
              />
            ))}
          </div>
          {activeItem.href ? <a href={activeItem.href} target="_blank" rel="noreferrer" className="text-xs text-neutral-500">↗</a> : null}
        </div>
      ) : null}
    </div>
  );
}

function DefaultFanCard({ item }: { item: CardStackItem }) {
  return (
    <div className="relative h-full w-full bg-neutral-900">
      {item.imageSrc ? <img src={item.imageSrc} alt={item.title} className="absolute inset-0 h-full w-full object-cover" draggable={false} /> : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
        {item.tag ? <span className="mb-2 text-[10px] uppercase tracking-[.18em] text-white/55">{item.tag}</span> : null}
        <div className="truncate text-lg font-semibold">{item.title}</div>
        {item.description ? <div className="mt-1 line-clamp-2 text-sm text-white/70">{item.description}</div> : null}
      </div>
    </div>
  );
}
