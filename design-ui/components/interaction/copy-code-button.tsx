import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../_utils/cn";

export interface CopyCodeButtonProps {
  code: string;
  language?: string;
  className?: string;
}

export function CopyCodeButton({ code, language = "tsx", className }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); }
    catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-background", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-mono">{language}</span>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground" aria-label="Copy code">
          <span className="relative size-3.5">{copied ? <Check className="absolute inset-0 size-3.5" /> : <Copy className="absolute inset-0 size-3.5" />}</span>
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre tabIndex={0} className="max-w-full overflow-x-auto p-4 text-left text-xs leading-6"><code>{code}</code></pre>
    </div>
  );
}
