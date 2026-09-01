import { BookOpen, Home, Layers3, Settings, Volume2 } from "lucide-react";
import { GooeyDock } from "../../components/docks/gooey-dock";

export function GooeyDockDemo() {
  const items = [
    { icon: <Home className="size-4" />, label: "Home", active: true },
    { icon: <Layers3 className="size-4" />, label: "Board" },
    { icon: <BookOpen className="size-4" />, label: "Rules" },
    { icon: <Volume2 className="size-4" />, label: "Sound" },
    { icon: <Settings className="size-4" />, label: "Settings" },
  ];

  return (
    <div className="flex h-[276px] items-center justify-center bg-[#f6f6f6]">
      <GooeyDock items={items} sound={false} />
    </div>
  );
}
