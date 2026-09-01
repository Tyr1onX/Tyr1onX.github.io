import { PlayingCard } from "../../components/cards/playing-card";

export function PlayingCardDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6]">
      <div className="scale-[.78]">
        <PlayingCard
          eyebrow="REDPALM / EVENT"
          title="Crimson Draw"
          description="A compact game-event card with a layered hover reveal."
          symbol="✦"
          footer={<div className="flex justify-between"><span>EVENT 07</span><span>DRAW →</span></div>}
        />
      </div>
    </div>
  );
}
