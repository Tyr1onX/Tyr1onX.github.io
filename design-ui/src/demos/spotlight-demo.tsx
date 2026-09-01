import { Spotlight } from "../../components/effects";

export function SpotlightDemo() {
  return (
    <div
      style={{
        minHeight: 384,
        display: "grid",
        placeItems: "center",
        borderRadius: 13,
        background: "#09090b",
      }}
    >
      <div className="relative aspect-video h-[200px] rounded border border-zinc-800 bg-black">
        <Spotlight
          className="from-blue-800 via-blue-600 to-blue-400 blur-xl dark:from-blue-900 dark:via-blue-500 dark:to-blue-900"
          size={64}
        />
        <div className="absolute inset-0">
          <svg className="h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="grid-pattern-spotlight" width="8" height="8" patternUnits="userSpaceOnUse">
                <path
                  d="M0 4H4M4 4V0M4 4H8M4 4V8"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  className="stroke-white dark:stroke-black"
                />
                <rect
                  x="3"
                  y="3"
                  width="2"
                  height="2"
                  fill="currentColor"
                  fillOpacity="0.25"
                  className="fill-white dark:fill-black"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern-spotlight)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
