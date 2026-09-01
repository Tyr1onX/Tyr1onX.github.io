import { TactileButton } from "../../components/buttons";

export function TactileButtonDemo() {
  return (
    <div
      style={{
        minHeight: 384,
        borderRadius: 13,
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 28%, rgba(5,70,90,.34), transparent 34%), linear-gradient(180deg,#03070d 0%,#02040a 100%)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: .22,
          backgroundImage:
            "linear-gradient(rgba(80,220,235,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(80,220,235,.08) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(circle at center, black, transparent 76%)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, display: "grid", justifyItems: "center", gap: 20 }}>
        <span style={{ color: "#35cde1", fontSize: 10, fontWeight: 850, letterSpacing: ".18em" }}>
          NEXUS / TACTILE FLUIDICS
        </span>
        <TactileButton />
        <span style={{ color: "rgba(226,248,252,.46)", fontSize: 11 }}>
          Move across the surface · click to discharge
        </span>
      </div>
    </div>
  );
}
