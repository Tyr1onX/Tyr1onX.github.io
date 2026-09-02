import fs from "node:fs";

const files = {
  app: fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"),
  designCss: fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8"),
  vite: fs.readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8"),
  wikiCss: fs.readFileSync(new URL("../../wiki.css", import.meta.url), "utf8"),
  wikiJs: fs.readFileSync(new URL("../../wiki.js", import.meta.url), "utf8"),
  musicJs: fs.readFileSync(new URL("../../music.js", import.meta.url), "utf8"),
  musicCss: fs.readFileSync(new URL("../../music.css", import.meta.url), "utf8"),
};

const failures = [];
const requireMatch = (condition, message) => { if (!condition) failures.push(message); };

const bodyBlock = files.wikiCss.match(/body\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const shellBlock = files.wikiCss.match(/\.wiki-shell\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
requireMatch(!/transition\s*:[^;]*(background-color|\bcolor\b)/.test(bodyBlock), "wiki body must not animate full-page theme colors");
requireMatch(!/transition\s*:[^;]*(grid-template-columns|\bgap\b)/.test(shellBlock), "wiki shell must not animate layout tracks");
requireMatch(files.wikiJs.includes("prefetchNavigationTarget") && files.wikiJs.includes("pointerover") && files.wikiJs.includes("touchstart"), "navigation intent prefetch is missing");

requireMatch(files.app.includes('const PRELOAD_MARGIN = "1500px 0px"'), "Design preload distance guard missing");
requireMatch(files.app.includes('const MEDIUM_PRELOAD_MARGIN = "900px 0px"'), "Design medium preload distance guard missing");
requireMatch(files.app.includes('const MOUNT_MARGIN = "560px 0px"'), "Design mount distance guard missing");
requireMatch(files.app.includes("demoModuleCache = new Map"), "Design module promise cache missing");
requireMatch(files.app.includes("MAX_PRELOAD_CONCURRENCY = 2"), "Design preload concurrency guard missing");
requireMatch(files.app.includes("PRELOAD_BATCH_GAP = 3000"), "Design preload batches must be paced");
requireMatch(files.app.includes("if (item.heavy || demoModuleCache.has"), "Heavy previews must not enter automatic preload queue");
requireMatch(files.app.includes("const shouldMount = pageVisible && nearViewport"), "Design previews must unmount when far away or hidden");
requireMatch(files.app.includes('document.addEventListener("visibilitychange"'), "Design page visibility lifecycle missing");
requireMatch(files.app.includes("useDeferredValue(query)"), "Design search must keep input rendering separate from filtering");
requireMatch(files.designCss.includes("min-height: var(--preview-min-height, 300px)"), "Design unmounted previews must reserve their original height");

requireMatch(files.musicJs.includes("syncVisualVisibility") && files.musicCss.includes('data-visual-paused="true"'), "Music background visual pause missing");
requireMatch(!files.musicJs.includes('cache: "no-store"'), "Music preview catalog must not bypass browser cache");

if (failures.length) {
  for (const failure of failures) console.error(`runtime performance check: ${failure}`);
  process.exit(1);
}
console.log("runtime performance check: architecture guards OK");
