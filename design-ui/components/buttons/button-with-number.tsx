import type { ButtonHTMLAttributes } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "../_utils/cn";

export interface ButtonWithNumberProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  count?: number;
}

export function ButtonWithNumber({ label = "Messages", count = 18, className, ...props }: ButtonWithNumberProps) {
  return (
    <button type="button" className={cn("inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25", className)} {...props}>
      <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>{label}</span>
      <span className="min-w-5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}
