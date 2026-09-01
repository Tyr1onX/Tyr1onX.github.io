"use client";

import React, { type ReactNode, useMemo, useState } from "react";
import { Bell, CircleDot, Dices, Timer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type DynamicIslandView = "idle" | "turn" | "dice" | "event";

export interface DynamicIslandProps {
  view?: DynamicIslandView;
  onViewChange?: (view: DynamicIslandView) => void;
  idleContent?: ReactNode;
  turnContent?: ReactNode;
  diceContent?: ReactNode;
  eventContent?: ReactNode;
  className?: string;
  showControls?: boolean;
}

const defaultContent: Record<DynamicIslandView, ReactNode> = {
  idle: <div className="flex items-center gap-2 px-4 py-2 text-xs text-white/75"><CircleDot className="size-3.5" /> Ready</div>,
  turn: <div className="flex w-48 items-center gap-2 px-4 py-2 text-sm font-medium text-white"><Timer className="size-4 text-rose-400" /> Player 1 turn</div>,
  dice: <div className="flex w-48 items-center gap-2 px-4 py-2 text-sm font-medium text-white"><Dices className="size-4 text-rose-400" /> Rolled 5</div>,
  event: <div className="flex w-52 items-center gap-2 px-4 py-2 text-sm font-medium text-white"><Bell className="size-4 text-amber-300" /> Event card drawn</div>,
};

/**
 * Adapted from Erik's 21st.dev Dynamic Island: the spring-layout morph and
 * blur/scale content transition are preserved, while the demo contents are
 * generalized into reusable slots.
 */
export function DynamicIsland({
  view: controlledView,
  onViewChange,
  idleContent,
  turnContent,
  diceContent,
  eventContent,
  className = "",
  showControls = true,
}: DynamicIslandProps) {
  const [internalView, setInternalView] = useState<DynamicIslandView>("idle");
  const view = controlledView ?? internalView;

  const content = useMemo(() => {
    if (view === "turn") return turnContent ?? defaultContent.turn;
    if (view === "dice") return diceContent ?? defaultContent.dice;
    if (view === "event") return eventContent ?? defaultContent.event;
    return idleContent ?? defaultContent.idle;
  }, [diceContent, eventContent, idleContent, turnContent, view]);

  const changeView = (next: DynamicIslandView) => {
    if (next === view) return;
    if (controlledView === undefined) setInternalView(next);
    onViewChange?.(next);
  };

  return (
    <div className={`relative flex h-[168px] w-full flex-col items-center justify-center ${className}`}>
      <motion.div
        layout
        transition={{ type: "spring", bounce: view === "idle" ? 0.5 : 0.32 }}
        className="relative z-10 w-fit min-w-[100px] overflow-hidden rounded-full border border-white/10 bg-black shadow-[0_16px_45px_rgba(0,0,0,.28)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, scale: 0.86, filter: "blur(5px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.82, filter: "blur(5px)" }}
            transition={{ duration: 0.2 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {showControls ? (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
          {(["idle", "turn", "dice", "event"] as DynamicIslandView[]).map((key) => (
            <button
              type="button"
              key={key}
              aria-label={key}
              onClick={() => changeView(key)}
              className={`size-7 rounded-full text-[9px] transition ${view === key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
            >
              {key === "idle" ? "●" : key === "turn" ? "1" : key === "dice" ? "⚄" : "!"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
