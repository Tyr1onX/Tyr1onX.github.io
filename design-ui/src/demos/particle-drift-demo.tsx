import { ParticleDrift } from "../../components/effects";

export function ParticleDriftDemo() {
  return (
    <div
      style={{
        minHeight: 384,
        borderRadius: 13,
        position: "relative",
        overflow: "hidden",
        background: "#030509",
      }}
    >
      <ParticleDrift style={{ position: "absolute", inset: 0 }} />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg,rgba(3,5,9,.94) 0%,rgba(3,5,9,.60) 34%,transparent 70%), linear-gradient(0deg,rgba(3,5,9,.75),transparent 42%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          zIndex: 2,
          left: 28,
          bottom: 28,
          width: "min(320px, calc(100% - 56px))",
          color: "#fff",
          pointerEvents: "none",
        }}
      >
        <span style={{ display: "block", marginBottom: 10, color: "#60A5FA", fontSize: 10, fontWeight: 850, letterSpacing: ".16em" }}>
          ZENITH COMPUTE
        </span>
        <strong style={{ display: "block", fontSize: 28, lineHeight: 1.02, letterSpacing: "-.045em", fontWeight: 520 }}>
          Particle Drift
        </strong>
        <p style={{ margin: "10px 0 0", color: "#9CA3AF", fontSize: 12, lineHeight: 1.55 }}>
          ASCII nodes drift through rising beams and connect to the pointer when it enters the field.
        </p>
      </div>
    </div>
  );
}
