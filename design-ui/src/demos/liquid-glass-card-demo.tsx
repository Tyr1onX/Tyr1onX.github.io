import { LiquidGlassCard } from "../../components/cards/liquid-glass-card";

export function LiquidGlassCardDemo() {
  return (
    <div className="flex min-h-[500px] items-center justify-center bg-white p-6">
      <LiquidGlassCard className="w-full min-w-[350px] max-w-[560px] p-2" accent="#f0a2cd">
        <div className="relative h-[420px] overflow-hidden rounded-sm bg-[radial-gradient(circle_at_20%_16%,#ffb82e_0%,#ff8f30_22%,transparent_48%),radial-gradient(circle_at_82%_24%,#ed78cc_0%,#e65187_27%,transparent_52%),radial-gradient(circle_at_25%_82%,#b2c765_0%,#519a9d_34%,transparent_58%),linear-gradient(145deg,#ef8532,#b53e6b_48%,#215f69)]">
          <div className="absolute left-1/2 top-36 z-10 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-md border-4 border-white bg-white p-4 text-zinc-900 shadow-xl transition-all duration-500 hover:scale-105">
            <div className="text-center text-[8px] font-semibold">Monthly Club</div>
            <div className="mt-1 text-center text-[5px] text-zinc-400">Human or cosmic anytime.</div>
            <div className="mt-3 text-center text-2xl font-bold tracking-[-.06em]">$99<sup className="text-[9px]">9</sup></div>
            <div className="mx-auto mt-2 h-4 w-14 rounded-full bg-zinc-950" />
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-zinc-100 pt-3">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-1 rounded-full bg-zinc-200" />)}
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1 rounded-md border border-zinc-100 p-2">
              {Array.from({ length: 21 }).map((_, index) => <span key={index} className={index % 5 === 0 ? "size-2 rounded-full bg-zinc-950" : "size-2 rounded-full bg-zinc-100"} />)}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full rounded-b-md bg-gradient-to-t from-black/85 via-black/45 to-transparent p-8 pt-24 text-white">
            <h1 className="text-2xl">Subscribe</h1>
            <p className="mt-2 max-w-[320px] text-sm leading-5 text-white/80">Subscribe to a plan, get access to Dashboard, and start listing your requests.</p>
            <button type="button" className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950/90 px-4 text-sm font-medium text-white shadow-lg">Learn More</button>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
