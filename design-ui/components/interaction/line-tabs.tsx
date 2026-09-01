import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../_utils/cn";

export interface LineTabItem { value: string; label: string; content: string }
export interface LineTabsProps { items?: LineTabItem[]; defaultValue?: string; className?: string }

const defaultItems: LineTabItem[] = [
  { value: "tab-1", label: "Overview", content: "A restrained underline keeps navigation clear without adding visual weight." },
  { value: "tab-2", label: "Details", content: "The active state is carried by a thin line and typography rather than a filled pill." },
  { value: "tab-3", label: "Notes", content: "Radix handles keyboard navigation while the surface remains visually minimal." },
];

export function LineTabs({ items = defaultItems, defaultValue = items[0]?.value, className }: LineTabsProps) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} className={cn("w-full max-w-md", className)}>
      <TabsPrimitive.List className="flex h-auto gap-2 border-b border-border bg-transparent px-0 py-1" aria-label="Section tabs">
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className="relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors after:absolute after:inset-x-2 after:-bottom-[5px] after:h-0.5 after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25 data-[state=active]:text-foreground data-[state=active]:after:scale-x-100">
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => <TabsPrimitive.Content key={item.value} value={item.value} className="px-3 py-5 text-sm leading-6 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/25">{item.content}</TabsPrimitive.Content>)}
    </TabsPrimitive.Root>
  );
}
