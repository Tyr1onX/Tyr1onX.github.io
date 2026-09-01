import { ThemeToggle } from "../../components/toggles";

export function ThemeToggleDemo() {
  return (
    <div className="relative flex min-h-96 w-full items-center justify-center bg-white p-6">
      <div className="absolute inset-0 bg-[radial-gradient(#00000021_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="relative"><ThemeToggle /></div>
    </div>
  );
}
