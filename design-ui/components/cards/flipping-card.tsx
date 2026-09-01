import React from "react";
import { cn } from "../_utils/cn";

export interface FlippingCardProps {
  className?: string;
  height?: number;
  width?: number;
  frontContent?: React.ReactNode;
  backContent?: React.ReactNode;
}

export function FlippingCard({
  className,
  frontContent,
  backContent,
  height = 300,
  width = 350,
}: FlippingCardProps) {
  return (
    <div
      className="group/flipping-card [perspective:1000px]"
      style={{ "--height": `${height}px`, "--width": `${width}px` } as React.CSSProperties}
    >
      <div
        className={cn(
          "relative h-[var(--height)] w-[var(--width)] rounded-xl border border-neutral-200 bg-white shadow-lg transition-all duration-700 [transform-style:preserve-3d] group-hover/flipping-card:[transform:rotateY(180deg)]",
          className,
        )}
      >
        <div className="absolute inset-0 h-full w-full rounded-[inherit] bg-white text-neutral-950 [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(0deg)]">
          <div className="h-full w-full [transform:translateZ(70px)_scale(.93)]">{frontContent}</div>
        </div>
        <div className="absolute inset-0 h-full w-full rounded-[inherit] bg-neutral-950 text-white [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="h-full w-full [transform:translateZ(70px)_scale(.93)]">{backContent}</div>
        </div>
      </div>
    </div>
  );
}
