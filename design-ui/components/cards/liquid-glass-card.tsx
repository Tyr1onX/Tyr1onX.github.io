import React, { type CSSProperties, type ReactNode } from "react";

export interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
  accent?: string;
}

const liquidCardCss = `
.ui-liquid-card{position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:24px;background:rgba(255,255,255,.08);box-shadow:inset 1px 1px 1px rgba(255,255,255,.32),inset -1px -1px 1px rgba(255,255,255,.08),0 18px 48px rgba(0,0,0,.24);backdrop-filter:blur(12px) saturate(135%)}
.ui-liquid-card-refraction{position:absolute;inset:-8%;border-radius:inherit;background:radial-gradient(circle at 18% 12%,rgba(255,255,255,.34),transparent 24%),radial-gradient(circle at 80% 90%,color-mix(in srgb,var(--liquid-card-accent) 25%,transparent),transparent 32%);filter:url(#ui-liquid-card-distortion);opacity:.8;pointer-events:none;z-index:0}
.ui-liquid-card-shine{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.19),transparent 28%,transparent 70%,rgba(255,255,255,.06));pointer-events:none;z-index:1}
.ui-liquid-card-content{position:relative;z-index:2}
.ui-liquid-card-filter{position:absolute;pointer-events:none}
`;

/** Lightweight liquid-glass card for isolated previews and reusable panels. */
export function LiquidGlassCard({ children, className = "", accent = "#ff4667" }: LiquidGlassCardProps) {
  return (
    <div className={`ui-liquid-card ${className}`} style={{ "--liquid-card-accent": accent } as CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: liquidCardCss }} />
      <svg aria-hidden="true" className="ui-liquid-card-filter" width="0" height="0">
        <filter id="ui-liquid-card-distortion" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.018" numOctaves="1" seed="11" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" scale="18" xChannelSelector="R" yChannelSelector="B" />
        </filter>
      </svg>
      <div className="ui-liquid-card-refraction" aria-hidden="true" />
      <div className="ui-liquid-card-shine" aria-hidden="true" />
      <div className="ui-liquid-card-content">{children}</div>
    </div>
  );
}
