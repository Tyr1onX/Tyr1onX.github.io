import { LiquidGlassCard } from "../../components/cards/liquid-glass-card";

export function LiquidGlassCardDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_28%_20%,#7b1d35_0%,#24141a_28%,#0b0b0d_70%)]">
      <LiquidGlassCard className="w-[255px]" accent="#ff4667">
        <div className="p-5 text-white">
          <div className="text-[9px] font-bold tracking-[.2em] text-white/50">REDPALM CONTROL</div>
          <div className="mt-5 flex items-end justify-between">
            <div><div className="text-2xl font-semibold tracking-[-.05em]">Your turn</div><div className="mt-1 text-[10px] text-white/45">Roll when ready.</div></div>
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">⚄</div>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
