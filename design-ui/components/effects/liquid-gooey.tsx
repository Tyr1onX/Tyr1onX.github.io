"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Liquid } from "liquid-gooey";

type LiquidGooeyAction = {
  label: string;
  icon: ReactNode;
  x: number;
  y: number;
};

type LiquidGooeyMenuProps = {
  fill?: string;
  shadow?: string;
  className?: string;
};

const actions: LiquidGooeyAction[] = [
  {
    label: "New card",
    x: -58,
    y: -36,
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="3" />
        <path d="M10 6.5v7M6.5 10h7" />
      </svg>
    ),
  },
  {
    label: "Roll dice",
    x: 0,
    y: -70,
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="3" />
        <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="13" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Player action",
    x: 58,
    y: -36,
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="7" r="3" />
        <path d="M4.5 16c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      </svg>
    ),
  },
];

const slotStyle: CSSProperties = {
  position: "absolute",
  left: 68,
  top: 70,
  width: 48,
  height: 48,
};

const buttonStyle: CSSProperties = {
  width: 48,
  height: 48,
  border: 0,
  borderRadius: "999px",
  background: "transparent",
  color: "white",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
  outlineOffset: 3,
};

export function LiquidGooeyMenu({
  fill = "#ef4444",
  shadow = "0 10px 28px rgba(127, 29, 29, .24)",
  className,
}: LiquidGooeyMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className} style={{ width: 184, height: 132, position: "relative" }}>
      <Liquid
        blur={10}
        contrast={18}
        fill={fill}
        shadow={shadow}
        style={{ width: 184, height: 132, position: "relative" }}
      >
        {actions.map((action, index) => (
          <Liquid.Item
            key={action.label}
            x={open ? action.x : 0}
            y={open ? action.y : 0}
            transition="bouncy"
            delay={open ? index * 45 : 0}
            style={slotStyle}
          >
            <button
              type="button"
              style={{
                ...buttonStyle,
                opacity: open ? 1 : 0,
                transition: "opacity 160ms ease",
                transitionDelay: open ? `${110 + index * 45}ms` : "0ms",
              }}
              aria-label={action.label}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              {action.icon}
            </button>
          </Liquid.Item>
        ))}

        <Liquid.Item style={slotStyle}>
          <button
            type="button"
            style={buttonStyle}
            aria-expanded={open}
            aria-label={open ? "Close liquid menu" : "Open liquid menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                transform: open ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 4v12M4 10h12" />
              </svg>
            </span>
          </button>
        </Liquid.Item>
      </Liquid>
    </div>
  );
}
