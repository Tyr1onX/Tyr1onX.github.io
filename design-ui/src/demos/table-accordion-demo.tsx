import { TableAccordion } from "../../components/interaction/table-accordion";

export function TableAccordionDemo() {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-8">
      <div className="w-full max-w-[500px] space-y-4">
        <h2 className="text-xl font-bold">Table w/ chevron</h2>
        <TableAccordion />
      </div>
    </div>
  );
}
