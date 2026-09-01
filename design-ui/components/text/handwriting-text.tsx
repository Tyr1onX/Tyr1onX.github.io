import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type HandwritingTextProps = {
  words: string[];
  className?: string;
  height?: CSSProperties["height"];
  traceDuration?: number;
  fillDuration?: number;
  holdDuration?: number;
  loop?: boolean;
};

export function HandwritingText({
  words,
  className,
  height = "1.15em",
  traceDuration = 1.05,
  fillDuration = 0.35,
  holdDuration = 1.25,
  loop = true,
}: HandwritingTextProps) {
  const safeWords = useMemo(() => words.filter((word) => word.trim().length > 0), [words]);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (safeWords.length === 0) return;
    if (index >= safeWords.length) setIndex(0);
  }, [index, safeWords.length]);

  useEffect(() => {
    if (reduceMotion || !loop || safeWords.length <= 1) return;

    const timeout = window.setTimeout(() => {
      setIndex((current) => (current + 1) % safeWords.length);
    }, (traceDuration + fillDuration + holdDuration) * 1000);

    return () => window.clearTimeout(timeout);
  }, [fillDuration, holdDuration, loop, reduceMotion, safeWords.length, traceDuration, index]);

  if (safeWords.length === 0) return null;

  const word = safeWords[Math.min(index, safeWords.length - 1)];
  const sharedStyle: CSSProperties = {
    gridArea: "1 / 1",
    whiteSpace: "nowrap",
    fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "-0.055em",
  };

  if (reduceMotion) {
    return (
      <span className={className} style={{ display: "inline-block", height, lineHeight: 1 }}>
        {word}
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-label={word}
      style={{
        display: "inline-grid",
        height,
        minWidth: "1ch",
        alignItems: "center",
        verticalAlign: "-0.08em",
        lineHeight: 1,
      }}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={word}
          aria-hidden="true"
          initial={{ opacity: 0, y: "0.08em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "-0.05em" }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{ ...sharedStyle, display: "inline-grid" }}
        >
          <motion.span
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: traceDuration, ease: [0.2, 0.75, 0.2, 1] }}
            style={{
              ...sharedStyle,
              WebkitTextFillColor: "transparent",
              WebkitTextStroke: "0.028em currentColor",
              textShadow: "0 0 0.01em currentColor",
            }}
          >
            {word}
          </motion.span>

          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: traceDuration * 0.82, duration: fillDuration, ease: "easeOut" }}
            style={sharedStyle}
          >
            {word}
          </motion.span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
