import { CardStack } from "../../components/cards/card-stack";

const cards = [
  { id: 1, title: "Move +2", description: "Advance two spaces.", tag: "MOVE" },
  { id: 2, title: "Draw Again", description: "Take another event.", tag: "EVENT" },
  { id: 3, title: "Swap", description: "Exchange positions.", tag: "TWIST" },
  { id: 4, title: "Shield", description: "Block one effect.", tag: "BUFF" },
  { id: 5, title: "Move -1", description: "Step back one space.", tag: "MOVE" },
];

export function CardStackDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center overflow-hidden bg-[#f6f6f6]">
      <div className="w-[390px] scale-[.72]">
        <CardStack
          items={cards}
          cardWidth={175}
          cardHeight={220}
          maxVisible={5}
          overlap={0.68}
          spreadDeg={34}
          depthPx={60}
          tiltXDeg={7}
          activeLiftPx={12}
          showDots={false}
          renderCard={(item, { active }) => (
            <div className={`relative h-full w-full overflow-hidden rounded-xl border ${active ? "border-rose-400/55" : "border-white/10"} bg-[#111] text-white`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(190,34,67,.42),transparent_48%)]" />
              <div className="relative flex h-full flex-col justify-between p-5">
                <span className="text-[9px] font-bold tracking-[.2em] text-rose-300/80">{item.tag}</span>
                <div>
                  <strong className="text-xl tracking-[-.04em]">{item.title}</strong>
                  <p className="mt-2 text-[10px] leading-relaxed text-white/45">{item.description}</p>
                </div>
                <span className="text-[8px] tracking-[.15em] text-white/25">REDPALM / EVENT</span>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
