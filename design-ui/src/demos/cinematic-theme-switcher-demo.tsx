import { useState } from "react";
import { CinematicThemeSwitcher } from "../../components/toggles";

export function CinematicThemeSwitcherDemo() {
  const [dark, setDark] = useState(false);

  return (
    <div className={`flex min-h-96 w-full items-center justify-center p-6 transition-colors duration-700 ease-in-out ${dark ? "bg-[#1d1e1f]" : "bg-white"}`}>
      <CinematicThemeSwitcher checked={dark} onCheckedChange={setDark} />
    </div>
  );
}
