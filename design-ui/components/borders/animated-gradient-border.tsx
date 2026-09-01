import React, { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export type GradientBorderAnimationMode = "auto-rotate" | "rotate-on-hover" | "stop-rotate-on-hover";

export interface AnimatedGradientBorderProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  className?: string;
  animationMode?: GradientBorderAnimationMode;
  animationSpeed?: number;
  gradientColors?: { primary: string; secondary: string; accent: string };
  backgroundColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  style?: CSSProperties;
}

const defaultGradientColors = { primary: "#584827", secondary: "#c7a03c", accent: "#f9de90" };
const borderCss = `
@property --gradient-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes ui-gradient-border-spin{to{--gradient-angle:360deg}}
.gradient-border-auto{animation:ui-gradient-border-spin var(--animation-duration,5s) linear infinite}
.gradient-border-hover:hover{animation:ui-gradient-border-spin var(--animation-duration,5s) linear infinite}
.gradient-border-stop-hover{animation:ui-gradient-border-spin var(--animation-duration,5s) linear infinite}
.gradient-border-stop-hover:hover{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){.gradient-border-auto,.gradient-border-hover:hover,.gradient-border-stop-hover{animation:none}}
`;

/** EaseMize animated conic-gradient border, source-faithful with TS cleanup. */
export function AnimatedGradientBorder({
  children,
  className = "",
  animationMode = "auto-rotate",
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = "#2d230f",
  borderWidth = 2,
  borderRadius = 20,
  style = {},
  ...props
}: AnimatedGradientBorderProps) {
  const animationClass = animationMode === "auto-rotate" ? "gradient-border-auto" : animationMode === "rotate-on-hover" ? "gradient-border-hover" : "gradient-border-stop-hover";
  const combinedStyle = {
    "--animation-duration": `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `linear-gradient(${backgroundColor}, ${backgroundColor}), conic-gradient(from var(--gradient-angle, 0deg), ${gradientColors.primary} 0%, ${gradientColors.secondary} 27%, ${gradientColors.accent} 30%, ${gradientColors.secondary} 33%, ${gradientColors.primary} 40%, ${gradientColors.primary} 50%, ${gradientColors.secondary} 77%, ${gradientColors.accent} 80%, ${gradientColors.secondary} 83%, ${gradientColors.primary} 90%)`,
    backgroundClip: "padding-box, border-box",
    backgroundOrigin: "padding-box, border-box",
    ...style,
  } as CSSProperties;

  return (
    <div className={`gradient-border-component ${animationClass} ${className}`} style={combinedStyle} {...props}>
      <style dangerouslySetInnerHTML={{ __html: borderCss }} />
      {children}
    </div>
  );
}
