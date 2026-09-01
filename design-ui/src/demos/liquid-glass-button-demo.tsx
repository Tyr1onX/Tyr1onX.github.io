import { LiquidButton } from "../../components/buttons";

export function LiquidGlassButtonDemo() {
  return (
    <div className="flex h-[384px] w-full items-center justify-center bg-white p-6">
      <div className="relative h-[200px] w-full max-w-[800px]">
        <LiquidButton className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          Liquid Glass
        </LiquidButton>
      </div>
    </div>
  );
}
