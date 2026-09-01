import { AuroraBackground } from "../../components/effects/aurora-background";

export function AuroraBackgroundDemo() {
  return (
    <div className="aurora-demo-stage">
      <AuroraBackground
        className="aurora-demo-surface"
        style={{ height: "100%", minHeight: "384px" }}
      >
        <div className="aurora-demo-copy">
          <span>AURORA BACKGROUND</span>
          <h3>Soft northern lights for a quiet hero.</h3>
          <p>Animated layered gradients with the original Aceternity masking treatment.</p>
          <button type="button">Explore effect</button>
        </div>
      </AuroraBackground>
    </div>
  );
}
