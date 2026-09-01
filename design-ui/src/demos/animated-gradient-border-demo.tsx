import { AnimatedGradientBorder } from "../../components/borders/animated-gradient-border";

export function AnimatedGradientBorderDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6]">
      <AnimatedGradientBorder
        animationSpeed={3.8}
        borderRadius={22}
        backgroundColor="#111014"
        gradientColors={{ primary: "#35131b", secondary: "#e33b5d", accent: "#ffd0d9" }}
      >
        <div className="w-[250px] p-5 text-white">
          <div className="text-[9px] font-bold tracking-[.2em] text-rose-300">CURRENT TURN</div>
          <div className="mt-6 flex items-center justify-between"><strong className="text-xl tracking-[-.04em]">Player One</strong><span className="text-2xl">●</span></div>
          <div className="mt-2 text-[10px] text-white/40">Animated focus border for active state.</div>
        </div>
      </AnimatedGradientBorder>
    </div>
  );
}
