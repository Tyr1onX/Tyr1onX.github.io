import { useState } from "react";
import {
  CurtainThemeToggle,
  type CurtainTheme,
} from "../../components/toggles";

export function CurtainThemeToggleDemo() {
  const [theme, setTheme] = useState<CurtainTheme>("light");
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const dark = theme === "dark";

  return (
    <div
      ref={setPortalTarget}
      style={{
        minHeight: 384,
        borderRadius: 13,
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
        color: dark ? "#dfd8c6" : "#1a1a1a",
        background: dark ? "#0e0e0e" : "#f3ede1",
        transition: "background .3s ease, color .3s ease",
        isolation: "isolate",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "grid", justifyItems: "center", gap: 18 }}>
        <p style={{ margin: 0, opacity: 0.6, fontSize: 12 }}>
          Click the button to see the animation.
        </p>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: dark ? "#000" : "#fff",
            border: dark ? "1px solid rgba(255,255,255,.1)" : "1px solid rgba(0,0,0,.05)",
            boxShadow: "0 10px 28px rgba(0,0,0,.10)",
          }}
        >
          <CurtainThemeToggle
            variant="icon"
            defaultTheme="light"
            duration={600}
            onThemeChange={setTheme}
            portalTarget={portalTarget}
            syncDocumentTheme={false}
          />
        </div>
      </div>
    </div>
  );
}
