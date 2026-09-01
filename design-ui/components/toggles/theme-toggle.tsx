"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { cn } from "../_utils/cn";

export interface ThemeToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

/**
 * Visual structure restored from the public 21st/Ayushmaan mirror.
 * Theme state stays local/controlled here so one gallery tile cannot toggle
 * the document root theme for every other preview on the page.
 */
export function ThemeToggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
}: ThemeToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isDark = checked ?? internal;

  const toggle = () => {
    const next = !isDark;
    if (checked === undefined) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-16 cursor-pointer rounded-full border border-secondary p-1 transition-all duration-300",
        isDark ? "bg-zinc-950" : "bg-white",
        className,
      )}
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="flex w-full items-center justify-between">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-300",
            isDark
              ? "translate-x-0 bg-zinc-800"
              : "translate-x-8 bg-gray-200",
          )}
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-white" strokeWidth={1.5} />
          ) : (
            <Sun className="h-4 w-4 text-gray-700" strokeWidth={1.5} />
          )}
        </span>

        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-300",
            isDark ? "bg-transparent" : "-translate-x-8",
          )}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          ) : (
            <Moon className="h-4 w-4 text-black" strokeWidth={1.5} />
          )}
        </span>
      </span>
    </button>
  );
}
