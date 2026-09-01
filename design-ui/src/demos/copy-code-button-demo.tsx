import { CopyCodeButton } from "../../components/interaction/copy-code-button";

export function CopyCodeButtonDemo() {
  return <div className="flex min-h-[300px] items-center justify-center p-8"><CopyCodeButton className="w-full max-w-md" language="tsx" code={'const Button = () => (\n  <button className="quiet-action">\n    Save changes\n  </button>\n);'} /></div>;
}
