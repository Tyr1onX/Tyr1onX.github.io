import { AnimatedGlowCard } from "../../components/cards/animated-glow-card";

export function AnimatedGlowCardDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#08080a]">
      <AnimatedGlowCard className="w-[250px]" glowColor="#ef3559">
        <div className="p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-[.2em] text-rose-300">ACTIVE PLAYER</span>
            <span className="size-2 rounded-full bg-rose-400 shadow-[0_0_12px_#fb7185]" />
          </div>
          <div className="mt-7 text-2xl font-semibold tracking-[-.04em]">Player One</div>
          <div className="mt-2 flex gap-4 text-[10px] text-white/45"><span>SPACE 18</span><span>EVENT ×2</span></div>
        </div>
      </AnimatedGlowCard>
    </div>
  );
}
