import React, { useState } from "react";

export interface PlayingCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  symbol?: React.ReactNode;
  footer?: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}

/**
 * Lightweight Vite-friendly adaptation of the 21st.dev Playing Card concept.
 * The upstream version uses Next.js + react-three-fiber for its reveal shader;
 * this variant keeps the layered card, inscription and hover reveal while
 * remaining dependency-free inside the gallery.
 */
export function PlayingCard({
  eyebrow = "PLAYING CARD",
  title,
  description,
  symbol = "✦",
  footer,
  accent = "#d92b45",
  onClick,
}: PlayingCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative block aspect-[9/14] w-[190px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0d0f] p-0 text-left text-white shadow-[0_24px_60px_rgba(0,0,0,.28)] transition-transform duration-500 hover:-translate-y-2 hover:rotate-[-1deg]"
      style={{ outline: `1px solid ${hovered ? accent : "rgba(255,255,255,.08)"}` }}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 20%, ${accent}55 0, transparent 34%), radial-gradient(circle at 15% 80%, ${accent}22 0, transparent 28%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[.14]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,.75) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
          maskImage: "linear-gradient(to bottom, black, transparent 62%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col p-5">
        <div className="flex items-center justify-between text-[9px] font-bold tracking-[.18em] text-white/45">
          <span>{eyebrow}</span>
          <span style={{ color: accent }}>{symbol}</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          <div
            className="flex size-[96px] items-center justify-center rounded-full border text-[42px] transition-all duration-500 group-hover:scale-110"
            style={{
              borderColor: `${accent}66`,
              color: hovered ? accent : "rgba(255,255,255,.82)",
              boxShadow: hovered ? `0 0 42px ${accent}33, inset 0 0 24px ${accent}18` : "none",
            }}
          >
            {symbol}
          </div>
        </div>

        <div>
          <h3 className="m-0 text-[21px] font-semibold leading-none tracking-[-.04em]">{title}</h3>
          {description ? <p className="mt-2 mb-0 text-[10px] leading-relaxed text-white/48">{description}</p> : null}
        </div>
        {footer ? <div className="mt-4 border-t border-white/10 pt-3 text-[9px] text-white/45">{footer}</div> : null}
      </div>
    </button>
  );
}
