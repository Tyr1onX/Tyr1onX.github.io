import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../_utils/cn";

export interface LineTabItem { value: string; label: string; content: string }
export interface LineTabsProps { items?: LineTabItem[]; defaultValue?: string; className?: string }

const defaultItems: LineTabItem[] = [
  { value: "tab-1", label: "Tab 1", content: "Content for Tab 1" },
  { value: "tab-2", label: "Tab 2", content: "Content for Tab 2" },
  { value: "tab-3", label: "Tab 3", content: "Content for Tab 3" },
];

export function LineTabs({ items = defaultItems, defaultValue = items[0]?.value, className }: LineTabsProps) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} className={cn("w-full max-w-md", className)}>
      <TabsPrimitive.List className="h-auto rounded-none border-b border-border bg-transparent p-0" aria-label="Section tabs">
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className="relative rounded-none px-3 py-2 text-sm font-medium text-muted-foreground shadow-none outline-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-primary after:transition-transform focus-visible:ring-2 focus-visible:ring-primary/25 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:scale-x-100">
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => <TabsPrimitive.Content key={item.value} value={item.value} className="p-4 text-center text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/25">{item.content}</TabsPrimitive.Content>)}
    </TabsPrimitive.Root>
  );
}
