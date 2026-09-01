import { MorphingSquare } from "../../components/loaders/morphing-square";

export function MorphingSquareDemo() {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center px-6 py-16">
      <MorphingSquare message="Loading..." />
    </div>
  );
}
