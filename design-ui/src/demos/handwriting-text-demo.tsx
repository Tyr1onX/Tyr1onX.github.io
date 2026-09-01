import { HandwritingText } from "../../components/text/handwriting-text";

export function HandwritingTextDemo() {
  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6] px-6">
      <div className="max-w-[430px] text-center">
        <div className="text-[10px] font-semibold tracking-[.2em] text-black/35">HANDWRITING TEXT</div>
        <h2 className="mt-4 text-[34px] font-bold leading-[1.05] tracking-[-.045em] text-zinc-950">
          Make the interface feel
          <br />
          <HandwritingText
            words={["personal.", "alive.", "memorable.", "like yours."]}
            className="text-emerald-700"
            height="1.12em"
          />
        </h2>
        <p className="mt-5 text-[11px] text-black/45">Trace first, then let the ink settle.</p>
      </div>
    </div>
  );
}
