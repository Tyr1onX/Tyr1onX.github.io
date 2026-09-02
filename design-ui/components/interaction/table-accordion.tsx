import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../_utils/cn";

export interface TableAccordionItem { id: string; title: string; content: string }
export interface TableAccordionProps { items?: TableAccordionItem[]; defaultValue?: string; className?: string }

const defaultItems: TableAccordionItem[] = [
  { id: "1", title: "What makes Origin UI different?", content: "Origin UI focuses on developer experience and performance. Built with TypeScript, it offers excellent type safety, follows accessibility standards, and provides comprehensive documentation with regular updates." },
  { id: "2", title: "How can I customize the components?", content: "Use our CSS variables for global styling, or className and style props for component-specific changes. We support CSS modules, Tailwind, and dark mode out of the box." },
  { id: "3", title: "Is Origin UI optimized for performance?", content: "Yes, with tree-shaking, code splitting, and minimal runtime overhead. Most components are under 5KB gzipped." },
  { id: "4", title: "How accessible are the components?", content: "All components follow WAI-ARIA standards, featuring proper ARIA attributes, keyboard navigation, and screen reader support. Regular testing ensures compatibility with NVDA, VoiceOver, and JAWS." },
];

export function TableAccordion({ items = defaultItems, defaultValue = "3", className }: TableAccordionProps) {
  return (
    <AccordionPrimitive.Root type="single" collapsible defaultValue={defaultValue} className={cn("w-full -space-y-px", className)}>
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.id} value={item.id} className="border border-border bg-background px-4 py-1 first:rounded-t-lg last:rounded-b-lg">
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="group flex flex-1 items-center justify-between gap-4 py-2 text-left text-[15px] leading-6 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-primary/25">
              {item.title}<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-[accordion-up_160ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out]">
            <div className="pb-2 leading-6">{item.content}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}
