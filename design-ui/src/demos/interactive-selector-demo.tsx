import { InteractiveSelector } from "../../components/selectors";
import "./interactive-selector-demo.css";

export function InteractiveSelectorDemo() {
  return (
    <div className="interactive-selector-demo-shell">
      <div className="interactive-selector-demo-canvas">
        <InteractiveSelector minHeight={650} />
      </div>
    </div>
  );
}
