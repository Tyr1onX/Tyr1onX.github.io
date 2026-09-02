import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../src/gallery-data.ts", import.meta.url), "utf8");

function fail(message) {
  console.error(`design preview check: ${message}`);
  process.exitCode = 1;
}

const previewBlock = css.match(/\.design-card-preview \{([\s\S]*?)\n\}/)?.[1] ?? "";
if (/^\s*height\s*:/m.test(previewBlock)) fail(".design-card-preview must not use a fixed height");
if (/overflow\s*:\s*hidden/.test(previewBlock)) fail(".design-card-preview must not hide overflow");
if (/translate\([^)]*\)\s*scale\(/.test(css)) fail("gallery preview wrappers must not scale demos to fit");
if (app.includes("design-tag-filter") || app.includes("priorityTags")) fail("duplicate English tag filter returned");
if (app.includes("design-provenance-note") || app.includes("初始库存迁自")) fail("development provenance copy returned to the UI");
if (app.includes("design-fidelity-filter") || app.includes("FidelityMark")) fail("source fidelity filter or marker returned to the UI");
if (css.includes("design-fidelity-filter") || css.includes("design-fidelity-")) fail("source fidelity filter styling returned to the UI");
if (data.includes("复刻待核对")) fail("unresolved reproduction label returned");
if (!data.includes("previewHeight") || !data.includes("previewMinWidth") || !data.includes("previewWide")) fail("per-component preview sizing metadata is missing");

const itemCount = (data.match(/\{ id: "/g) ?? []).length;
if (itemCount !== 38) fail(`expected 38 inventory items, found ${itemCount}`);

if (!process.exitCode) console.log(`design preview check: ${itemCount} items, layout guards OK`);
