import React, { useEffect, useState } from "react";
import { FaCampground, FaFire, FaHiking, FaHotTub, FaTint } from "react-icons/fa";

const options = [
  {
    title: "Luxury Tent",
    description: "Cozy glamping under the stars",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
    icon: FaCampground,
  },
  {
    title: "Campfire Feast",
    description: "Gourmet s'mores & stories",
    image: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80",
    icon: FaFire,
  },
  {
    title: "Lakeside Retreat",
    description: "Private dock & canoe rides",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    icon: FaTint,
  },
  {
    title: "Mountain Spa",
    description: "Outdoor sauna & hot tub",
    image: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80",
    icon: FaHotTub,
  },
  {
    title: "Guided Adventure",
    description: "Expert-led nature tours",
    image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80",
    icon: FaHiking,
  },
] as const;

export interface InteractiveSelectorProps {
  className?: string;
  minHeight?: number | string;
}

/**
 * Source-faithful Vite adaptation of minhxthanh's 21st.dev Interactive Selector.
 * The public 21st render snapshot and mirrored component source are used as the
 * fidelity reference. The only structural adaptation is replacing styled-jsx
 * with a normal scoped style tag and allowing the demo viewport height to be set.
 */
export function InteractiveSelector({ className = "", minHeight = "100vh" }: InteractiveSelectorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animatedOptions, setAnimatedOptions] = useState<number[]>([]);

  useEffect(() => {
    const timers = options.map((_, index) =>
      window.setTimeout(() => {
        setAnimatedOptions((current) => (current.includes(index) ? current : [...current, index]));
      }, 180 * index),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <div
      className={`interactive-selector-root relative flex flex-col items-center justify-center bg-[#222] font-sans text-white ${className}`}
      style={{ minHeight }}
    >
      <div className="w-full max-w-2xl px-6 mt-8 mb-2 text-center">
        <h1 className="interactive-selector-fade-top interactive-selector-delay-300 text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight drop-shadow-lg">
          Escape in Style
        </h1>
        <p className="interactive-selector-fade-top interactive-selector-delay-600 text-lg md:text-xl text-gray-300 font-medium max-w-xl mx-auto">
          Discover luxurious camping experiences in nature’s most breathtaking spots.
        </p>
      </div>

      <div className="h-12" />

      <div className="options flex w-full max-w-[900px] min-w-[600px] h-[400px] mx-0 items-stretch overflow-hidden relative">
        {options.map((option, index) => {
          const active = activeIndex === index;
          const animated = animatedOptions.includes(index);
          const Icon = option.icon;

          return (
            <div
              key={option.title}
              className={`option relative flex flex-col justify-end overflow-hidden transition-all duration-700 ease-in-out ${active ? "active" : ""}`}
              style={{
                backgroundImage: `url('${option.image}')`,
                backgroundSize: active ? "auto 100%" : "auto 120%",
                backgroundPosition: "center",
                backfaceVisibility: "hidden",
                opacity: animated ? 1 : 0,
                transform: animated ? "translateX(0)" : "translateX(-60px)",
                minWidth: "60px",
                minHeight: "100px",
                margin: 0,
                borderRadius: 0,
                borderWidth: "2px",
                borderStyle: "solid",
                borderColor: active ? "#fff" : "#292929",
                cursor: "pointer",
                backgroundColor: "#18181b",
                boxShadow: active ? "0 20px 60px rgba(0,0,0,0.50)" : "0 10px 30px rgba(0,0,0,0.30)",
                flex: active ? "7 1 0%" : "1 1 0%",
                zIndex: active ? 10 : 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                position: "relative",
                overflow: "hidden",
                willChange: "flex-grow, box-shadow, background-size, background-position",
              }}
              onClick={() => setActiveIndex(index)}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveIndex(index);
                }
              }}
            >
              <div
                className="shadow absolute left-0 right-0 pointer-events-none transition-all duration-700 ease-in-out"
                style={{
                  bottom: active ? "0" : "-40px",
                  height: "120px",
                  boxShadow: active
                    ? "inset 0 -120px 120px -120px #000, inset 0 -120px 120px -80px #000"
                    : "inset 0 -120px 0px -120px #000, inset 0 -120px 0px -80px #000",
                }}
              />

              <div className="label absolute left-0 right-0 bottom-5 flex items-center justify-start h-12 z-2 pointer-events-none px-4 gap-3 w-full">
                <div className="icon min-w-[44px] max-w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[rgba(32,32,32,0.85)] backdrop-blur-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.18)] border-2 border-[#444] flex-shrink-0 flex-grow-0 transition-all duration-200">
                  <Icon size={24} className="text-white" />
                </div>
                <div className="info text-white whitespace-pre relative">
                  <div
                    className="main font-bold text-lg transition-all duration-700 ease-in-out"
                    style={{ opacity: active ? 1 : 0, transform: active ? "translateX(0)" : "translateX(25px)" }}
                  >
                    {option.title}
                  </div>
                  <div
                    className="sub text-base text-gray-300 transition-all duration-700 ease-in-out"
                    style={{ opacity: active ? 1 : 0, transform: active ? "translateX(0)" : "translateX(25px)" }}
                  >
                    {option.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes interactive-selector-fade-top {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .interactive-selector-fade-top {
          opacity: 0;
          transform: translateY(-20px);
          animation: interactive-selector-fade-top .8s ease-in-out forwards;
        }
        .interactive-selector-delay-300 { animation-delay: .3s; }
        .interactive-selector-delay-600 { animation-delay: .6s; }
        @media (prefers-reduced-motion: reduce) {
          .interactive-selector-fade-top { opacity: 1; transform: none; animation: none; }
        }
      `}</style>
    </div>
  );
}

export default InteractiveSelector;
