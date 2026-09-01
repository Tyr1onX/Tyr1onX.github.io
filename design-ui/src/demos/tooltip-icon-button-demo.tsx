import { Bell, Heart, Info, Settings } from "lucide-react";
import { TooltipIconButton } from "../../components/interaction/tooltip-icon-button";

export function TooltipIconButtonDemo() {
  return <div className="flex min-h-[300px] items-center justify-center gap-4 p-8"><TooltipIconButton tooltip="Notifications" side="top"><Bell className="size-4" /></TooltipIconButton><TooltipIconButton tooltip="Settings" side="right"><Settings className="size-4" /></TooltipIconButton><TooltipIconButton tooltip="Favorites" side="bottom"><Heart className="size-4" /></TooltipIconButton><TooltipIconButton tooltip="Information" side="left"><Info className="size-4" /></TooltipIconButton></div>;
}
