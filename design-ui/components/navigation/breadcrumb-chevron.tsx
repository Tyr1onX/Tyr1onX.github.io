import { Component as ComponentIcon, Home, ChevronRight } from "lucide-react";
import { cn } from "../_utils/cn";

export interface BreadcrumbChevronProps { className?: string }

export function BreadcrumbChevron({ className }: BreadcrumbChevronProps) {
  const linkClass = "inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <nav aria-label="Breadcrumb" className={cn("max-w-full", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <li><a href="#" className={linkClass}><Home size={15} strokeWidth={2} aria-hidden="true" />Home</a></li>
        <li aria-hidden="true" className="text-muted-foreground"><ChevronRight size={14} /></li>
        <li><a href="#" className={linkClass}><ComponentIcon size={15} strokeWidth={2} aria-hidden="true" />Components</a></li>
        <li aria-hidden="true" className="text-muted-foreground"><ChevronRight size={14} /></li>
        <li><span aria-current="page" className="px-1.5 py-1 font-medium text-foreground">Breadcrumb</span></li>
      </ol>
    </nav>
  );
}
