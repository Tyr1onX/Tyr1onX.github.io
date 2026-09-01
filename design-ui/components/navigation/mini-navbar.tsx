import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "../_utils/cn";

export interface MiniNavbarProps {
  brand?: string;
  links?: Array<{ label: string; href: string }>;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function MiniNavbar({
  brand = "MINI",
  links = [{ label: "Work", href: "#" }, { label: "About", href: "#" }, { label: "Notes", href: "#" }],
  actionLabel = "Contact",
  actionHref = "#",
  className,
}: MiniNavbarProps) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={cn("relative mx-auto w-full max-w-3xl", className)} aria-label="Mini navigation">
      <div className="flex min-h-14 items-center justify-between rounded-full border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-md">
        <a href="#" className="flex items-center gap-2 rounded-full px-2 text-sm font-semibold tracking-[0.12em]">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />{brand}
        </a>
        <div className="hidden items-center gap-1 sm:flex">
          {links.map((link) => <a key={link.label} href={link.href} className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{link.label}</a>)}
        </div>
        <a href={actionHref} className="hidden rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground sm:inline-flex">{actionLabel}</a>
        <button type="button" className="inline-flex size-9 items-center justify-center rounded-full border border-border sm:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}>{open ? <X size={16} /> : <Menu size={16} />}</button>
      </div>
      <div className={cn("absolute inset-x-0 top-[calc(100%+8px)] z-10 grid overflow-hidden rounded-2xl border border-border bg-background shadow-lg transition-all sm:hidden", open ? "max-h-64 p-2 opacity-100" : "pointer-events-none max-h-0 border-transparent p-0 opacity-0")}>
        {links.map((link) => <a key={link.label} href={link.href} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{link.label}</a>)}
        <a href={actionHref} className="mt-1 rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground">{actionLabel}</a>
      </div>
    </nav>
  );
}
