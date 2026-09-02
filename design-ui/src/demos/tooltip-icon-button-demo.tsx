import { Bell, Heart, Info, Settings } from "lucide-react";
import { TooltipIconButton } from "../../components/interaction/tooltip-icon-button";

export function TooltipIconButtonDemo() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-8 p-8">
      <div className="flex gap-4">
        <TooltipIconButton tooltip="Notifications" side="top"><Bell className="h-4 w-4" /></TooltipIconButton>
        <TooltipIconButton tooltip="Settings" side="right"><Settings className="h-4 w-4" /></TooltipIconButton>
        <TooltipIconButton tooltip="Favorites" side="bottom"><Heart className="h-4 w-4" /></TooltipIconButton>
        <TooltipIconButton tooltip="Information" side="left"><Info className="h-4 w-4" /></TooltipIconButton>
      </div>
      <div className="flex gap-4">
        <TooltipIconButton tooltip="Primary Button" variant="default" className="bg-primary"><Bell className="h-4 w-4" /></TooltipIconButton>
        <TooltipIconButton tooltip="Destructive Button" variant="destructive"><Heart className="h-4 w-4" /></TooltipIconButton>
        <TooltipIconButton tooltip="Outline Button" variant="outline"><Settings className="h-4 w-4" /></TooltipIconButton>
      </div>
    </div>
  );
}
