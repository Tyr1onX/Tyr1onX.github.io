import type { ComponentType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../_utils/cn";

const badgeStyles = cva("inline-flex overflow-hidden rounded-full border text-xs font-medium shadow-sm", {
  variants: {
    status: {
      success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
      error: "border-red-500/20 bg-red-500/10 text-red-700",
      neutral: "border-border bg-muted text-foreground",
    },
  },
  defaultVariants: { status: "success" },
});

type IconLike = ComponentType<{ className?: string }>;
export interface StatusBadgeProps extends VariantProps<typeof badgeStyles> {
  leftIcon?: IconLike;
  rightIcon?: IconLike;
  leftLabel: string;
  rightLabel?: string;
  className?: string;
}

export function StatusBadge({ leftIcon: LeftIcon, rightIcon: RightIcon, leftLabel, rightLabel, status, className }: StatusBadgeProps) {
  return (
    <span className={cn(badgeStyles({ status }), className)}>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5">
        {LeftIcon ? <LeftIcon className="size-3.5" /> : null}<span>{leftLabel}</span>
      </span>
      {rightLabel ? <span className="inline-flex items-center gap-1.5 border-l border-current/15 bg-background/45 px-2.5 py-1.5">{RightIcon ? <RightIcon className="size-3.5" /> : null}<span>{rightLabel}</span></span> : null}
    </span>
  );
}
