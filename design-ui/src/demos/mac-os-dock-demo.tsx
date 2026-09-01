import { useMemo, useState } from "react";
import { MacOSDock, type MacOSDockApp } from "../../components/docks";

function appIcon(label: string, from: string, to: string, foreground = "white") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/><path d="M10 12h108" stroke="white" stroke-opacity=".35" stroke-width="3"/><text x="64" y="77" text-anchor="middle" font-family="Arial,sans-serif" font-size="43" font-weight="700" fill="${foreground}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function MacOSDockDemo() {
  const [openApps, setOpenApps] = useState(["finder", "safari"]);
  const apps = useMemo<MacOSDockApp[]>(
    () => [
      { id: "finder", name: "Finder", icon: appIcon("F", "#79c8ff", "#247dd2") },
      { id: "mail", name: "Mail", icon: appIcon("✉", "#62d8ff", "#1477e8") },
      { id: "safari", name: "Safari", icon: appIcon("↗", "#67d5ff", "#126bd4") },
      { id: "notes", name: "Notes", icon: appIcon("≡", "#fff7a8", "#f2cc45", "#6b5b18") },
      { id: "music", name: "Music", icon: appIcon("♪", "#ff7599", "#ff3b6b") },
      { id: "settings", name: "Settings", icon: appIcon("⚙", "#a8b0bb", "#59616d") },
    ],
    [],
  );

  return (
    <div className="relative flex h-[384px] items-end justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_25%_20%,rgba(255,184,120,.85),transparent_26%),radial-gradient(circle_at_76%_26%,rgba(117,139,255,.86),transparent_32%),linear-gradient(150deg,#152030,#43506b_52%,#182033)] p-7">
      <MacOSDock
        apps={apps}
        openApps={openApps}
        onAppClick={(id) => {
          setOpenApps((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
        }}
      />
    </div>
  );
}
