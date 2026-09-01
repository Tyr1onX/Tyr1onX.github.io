import { DynamicIsland } from "../../components/status/dynamic-island";

export function DynamicIslandDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6]">
      <div className="w-[360px]">
        <DynamicIsland
          idleContent={<div className="flex items-center gap-2 px-4 py-2 text-xs text-white/65"><span className="size-1.5 rounded-full bg-rose-400" /> RedPalm ready</div>}
          turnContent={<div className="flex w-48 items-center gap-2 px-4 py-2 text-sm font-medium text-white"><span className="size-2 rounded-full bg-rose-400 shadow-[0_0_12px_#fb7185]" /> Player 1 turn</div>}
          diceContent={<div className="flex w-44 items-center justify-between px-4 py-2 text-sm text-white"><span>Dice result</span><strong className="text-rose-300">⚄ 5</strong></div>}
          eventContent={<div className="flex w-52 items-center justify-between px-4 py-2 text-sm text-white"><span>Event drawn</span><span className="text-amber-300">✦</span></div>}
        />
      </div>
    </div>
  );
}
