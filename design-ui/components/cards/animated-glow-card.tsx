import React, { type CSSProperties, type ReactNode } from "react";

export interface AnimatedGlowCardProps {
  children: ReactNode;
  active?: boolean;
  className?: string;
  glowColor?: string;
}

const glowCss = `
.ui-glow-card{position:relative;padding:1px;border-radius:22px;overflow:hidden;background:rgba(255,255,255,.09);isolation:isolate}
.ui-glow-card::before{content:"";position:absolute;inset:-55%;background:conic-gradient(from 0deg,transparent 0 68%,var(--glow-card-color) 78%,rgba(255,255,255,.9) 83%,var(--glow-card-color) 88%,transparent 100%);opacity:.12;animation:ui-glow-spin 5s linear infinite;z-index:-2}
.ui-glow-card-active::before{opacity:.85}
.ui-glow-card-orbit{position:absolute;inset:-1px;border-radius:inherit;box-shadow:0 0 26px color-mix(in srgb,var(--glow-card-color) 24%,transparent),inset 0 0 18px color-mix(in srgb,var(--glow-card-color) 8%,transparent);pointer-events:none;z-index:2}
.ui-glow-card-inner{position:relative;border-radius:21px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),#0d0d10;z-index:1}
@keyframes ui-glow-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.ui-glow-card::before{animation:none}}
`;

/** Self-contained adaptation of EaseMize's animated glow-card treatment. */
export function AnimatedGlowCard({
  children,
  active = true,
  className = "",
  glowColor = "#ef3559",
}: AnimatedGlowCardProps) {
  const style = { "--glow-card-color": glowColor } as CSSProperties;

  return (
    <div className={`ui-glow-card ${active ? "ui-glow-card-active" : ""} ${className}`} style={style}>
      <style dangerouslySetInnerHTML={{ __html: glowCss }} />
      <span className="ui-glow-card-orbit" aria-hidden="true" />
      <div className="ui-glow-card-inner">{children}</div>
    </div>
  );
}
