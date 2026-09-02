import type { ComponentType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../_utils/cn";

const badgeStyles = cva("inline-flex items-center gap-x-2.5 rounded-full bg-background px-2.5 py-1.5 text-xs ring-1 ring-inset ring-border", {
  variants: { status: { success: "", error: "", neutral: "" } },
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
  const iconTone = status === "error" ? "text-red-600 dark:text-red-500" : status === "neutral" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-500";
  return (
    <span className={cn(badgeStyles({ status }), className)}>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        {LeftIcon ? <LeftIcon className={cn("-ml-0.5 size-4 shrink-0", iconTone)} /> : null}
        {leftLabel}
      </span>
      {rightLabel ? <>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {RightIcon ? <RightIcon className="-ml-0.5 size-4 shrink-0" /> : null}
          {rightLabel}
        </span>
      </> : null}
    </span>
  );
}
