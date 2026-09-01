import { CSSProperties, useEffect, useRef, useState } from "react";

export interface SparkBadgeProps {
  className?: string;
  sourceUrl?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Spark Badge wrapper adapted from Meng To's public ThreeUI implementation.
 * The heavy Canvas particle renderer lives in a local spark-badge.html asset.
 *
 * Upstream: https://github.com/MengTo/threeui
 * License: MIT — see spark-badge.LICENSE.txt
 */
export function SparkBadge({
  className = "",
  sourceUrl = "/spark-badge.html",
  style,
  title = "Animated credential badge in rain",
}: SparkBadgeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const intersectsRef = useRef(true);
  const [mounted, setMounted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const sync = () => {
      setMounted(intersectsRef.current && document.visibilityState !== "hidden");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersectsRef.current = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );

    observer.observe(host);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (!mounted) setReady(false);
  }, [mounted]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-state={!mounted ? "paused" : ready ? "ready" : "loading"}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        isolation: "isolate",
        background: "#000",
        ...style,
      }}
    >
      {mounted ? (
        <iframe
          title={title}
          src={sourceUrl}
          sandbox="allow-scripts"
          loading="eager"
          onLoad={() => setReady(true)}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            border: 0,
            background: "#000",
            opacity: ready ? 1 : 0,
            transition: "opacity 180ms ease-out",
          }}
        />
      ) : null}
    </div>
  );
}
