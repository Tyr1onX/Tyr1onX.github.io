import type { ReactNode } from "react";
import { cn } from "../_utils/cn";

export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipButtonVariant = "default" | "outline" | "destructive";

export interface TooltipIconButtonProps {
  tooltip: string;
  side?: TooltipSide;
  variant?: TooltipButtonVariant;
  className?: string;
  children: ReactNode;
}

export function TooltipIconButton({ tooltip, side = "bottom", variant = "outline", className, children }: TooltipIconButtonProps) {
  const variantClass = variant === "default" ? "border-primary bg-primary text-primary-foreground" : variant === "destructive" ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-border bg-background text-foreground";
  return (
    <button type="button" aria-label={tooltip} className={cn("group relative inline-flex size-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", variantClass, className)}>
      {children}
      <span role="tooltip" data-side={side} className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 data-[side=top]:bottom-[calc(100%+7px)] data-[side=bottom]:top-[calc(100%+7px)] data-[side=left]:right-[calc(100%+7px)] data-[side=right]:left-[calc(100%+7px)] data-[side=top]:translate-y-1 data-[side=bottom]:-translate-y-1 data-[side=left]:translate-x-1 data-[side=right]:-translate-x-1 group-hover:translate-x-0 group-hover:translate-y-0 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0">
        {tooltip}
      </span>
    </button>
  );
}
