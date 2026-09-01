import { FlippingCard } from "../../components/cards/flipping-card";

export function FlippingCardDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6]">
      <div className="scale-[.63]">
        <FlippingCard
          width={290}
          height={360}
          className="border-white/10 bg-[#111]"
          frontContent={
            <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-[#111] text-white">
              <div className="absolute inset-4 rounded-[16px] border border-rose-500/20" />
              <span className="text-[11px] font-bold tracking-[.28em] text-white/35">REDPALM</span>
              <strong className="mt-5 text-7xl font-light text-rose-400">?</strong>
              <span className="mt-5 text-[10px] tracking-[.22em] text-white/35">HOVER TO REVEAL</span>
            </div>
          }
          backContent={
            <div className="flex h-full flex-col justify-between rounded-[inherit] bg-[radial-gradient(circle_at_top,#471722,#111_55%)] p-7 text-white">
              <div className="text-[10px] font-bold tracking-[.2em] text-rose-300">EVENT 07</div>
              <div>
                <div className="text-3xl font-semibold tracking-[-.05em]">Move +3</div>
                <p className="mt-3 text-sm leading-relaxed text-white/55">A reveal state suitable for turn-based event cards.</p>
              </div>
              <div className="text-[10px] tracking-[.15em] text-white/30">RESOLVE →</div>
            </div>
          }
        />
      </div>
    </div>
  );
}
