import { HandwritingText } from "../../components/text/handwriting-text";

export function HandwritingTextDemo() {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-10 bg-[#fafafa] px-6 text-zinc-900 dark:bg-[#18181b] dark:text-zinc-50">
      <h1 className="max-w-2xl text-center text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Know where the crowd
        <br />
        is going to break
        <br />
        <HandwritingText words={["live.", "predictive.", "measurable.", "on every phone."]} className="text-emerald-700 dark:text-emerald-400" height="1.15em" />
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Each word is traced letter by letter, then inked in.</p>
    </div>
  );
}
