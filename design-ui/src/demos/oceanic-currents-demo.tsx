import { OceanicCurrents } from "../../components/effects/oceanic-currents";

export function OceanicCurrentsDemo() {
  return (
    <div className="oceanic-demo-stage">
      <OceanicCurrents className="oceanic-demo-surface" speed={0.9} />
      <div className="oceanic-demo-overlay">
        <span>WEBGL / SMOKE FIELD</span>
        <h3>Oceanic Currents</h3>
        <p>Deep blue flow, luminous cyan foam, and drifting smoke-like motion.</p>
      </div>
    </div>
  );
}
