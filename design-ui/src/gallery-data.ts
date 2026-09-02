import type { ComponentType } from "react";

export type Category =
  | "buttons"
  | "cards"
  | "effects"
  | "text"
  | "toggles"
  | "docks"
  | "loaders"
  | "status"
  | "borders"
  | "selectors";

export type Fidelity = "source" | "adapted" | "reproduction";
export type ComponentWeight = "light" | "medium" | "heavy";

export type GalleryItem = {
  id: string;
  name: string;
  author: string;
  category: Category;
  tags: string[];
  source: string;
  original: string;
  originalLabel?: string;
  originalSource?: string;
  license?: string;
  dependencies: string[];
  fidelity: Fidelity;
  featuredRank: number;
  visualWeight: ComponentWeight;
  runtimeWeight: ComponentWeight;
  usedInSite: boolean;
  heavy?: boolean;
  previewHeight?: number;
  previewMinWidth?: number;
  previewWide?: boolean;
  previewTone?: "inherit" | "light" | "dark";
  loadDemo: () => Promise<{ default: ComponentType }>;
};

type GalleryItemInput = Omit<GalleryItem, "dependencies" | "featuredRank" | "visualWeight" | "runtimeWeight" | "usedInSite"> & Partial<Pick<GalleryItem, "dependencies" | "featuredRank" | "visualWeight" | "runtimeWeight" | "usedInSite">>;

function namedDemo<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return async () => ({ default: (await loader())[name] });
}

const rawItems: GalleryItemInput[] = [
  { id: "playing-card", previewHeight: 380, name: "Playing Card", author: "maxim.bort.devel", category: "cards", tags: ["Card", "Event", "RedPalm"], source: "components/cards/playing-card.tsx", original: "https://21st.dev/@maxim.bort.devel/components/playing-card", fidelity: "reproduction", loadDemo: namedDemo(() => import("./demos/playing-card-demo"), "PlayingCardDemo") },
  { id: "flipping-card", previewHeight: 380, name: "Flipping Card", author: "aghasisahakyan1", category: "cards", tags: ["Card", "Flip", "RedPalm"], source: "components/cards/flipping-card.tsx", original: "https://21st.dev/@aghasisahakyan1/components/flipping-card", fidelity: "source", loadDemo: namedDemo(() => import("./demos/flipping-card-demo"), "FlippingCardDemo") },
  { id: "card-stack", previewHeight: 400, name: "Card Stack", author: "ruixen.ui", category: "cards", tags: ["Card", "Stack", "Drag", "RedPalm"], source: "components/cards/card-stack.tsx", original: "https://21st.dev/@ruixen.ui/components/card-stack", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/card-stack-demo"), "CardStackDemo") },
  { id: "animated-glow-card", name: "Animated Glow Card", author: "easemize", category: "cards", tags: ["Card", "Glow", "Active", "RedPalm"], source: "components/cards/animated-glow-card.tsx", original: "https://21st.dev/@easemize/components/animated-glow-card", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/animated-glow-card-demo"), "AnimatedGlowCardDemo") },
  { id: "liquid-glass-card", previewHeight: 520, previewMinWidth: 390, previewWide: true, previewTone: "dark", name: "Liquid Glass Card", author: "aliimam", category: "cards", tags: ["Card", "Glass", "Liquid", "RedPalm"], source: "components/cards/liquid-glass-card.tsx", original: "https://21st.dev/@designali-in/components/liquid-glass-card", fidelity: "reproduction", loadDemo: namedDemo(() => import("./demos/liquid-glass-card-demo"), "LiquidGlassCardDemo") },
  { id: "dynamic-island", previewHeight: 340, name: "Dynamic Island", author: "aghasisahakyan1", category: "status", tags: ["HUD", "Status", "Motion", "RedPalm"], source: "components/status/dynamic-island.tsx", original: "https://21st.dev/@aghasisahakyan1/components/dynamic-island", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/dynamic-island-demo"), "DynamicIslandDemo") },
  { id: "animated-gradient-border", name: "Animated Gradient Border", author: "easemize", category: "borders", tags: ["Border", "Gradient", "Active", "RedPalm"], source: "components/borders/animated-gradient-border.tsx", original: "https://21st.dev/@easemize/components/animated-gradient-border", fidelity: "source", loadDemo: namedDemo(() => import("./demos/animated-gradient-border-demo"), "AnimatedGradientBorderDemo") },
  { id: "gooey-dock", previewHeight: 320, previewMinWidth: 620, previewWide: true, name: "Gooey Dock", author: "ruixen.ui", category: "docks", tags: ["Navigation", "Motion", "RedPalm"], source: "components/docks/gooey-dock.tsx", original: "https://21st.dev/@ruixen.ui/components/gooey-dock", fidelity: "source", loadDemo: namedDemo(() => import("./demos/gooey-dock-demo"), "GooeyDockDemo") },
  { id: "interactive-selector", previewHeight: 440, previewMinWidth: 760, previewWide: true, name: "Interactive Selector", author: "minhxthanh", category: "selectors", tags: ["Selector", "Cards", "Interaction", "Images"], source: "components/selectors/interactive-selector.tsx", original: "https://21st.dev/@minhxthanh/components/interactive-selector", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/interactive-selector-demo"), "InteractiveSelectorDemo") },
  { id: "handwriting-text", previewHeight: 400, previewMinWidth: 600, previewWide: true, name: "Handwriting Text", author: "Moazzam", category: "text", tags: ["Typography", "Text", "Animation", "SVG"], source: "components/text/handwriting-text.tsx", original: "https://21st.dev/@davailospirasto/components/handwriting-text", fidelity: "reproduction", loadDemo: namedDemo(() => import("./demos/handwriting-text-demo"), "HandwritingTextDemo") },
  { id: "liquid-glass", previewHeight: 430, previewMinWidth: 680, previewWide: true, name: "Liquid Glass", author: "suraj-xd", category: "effects", tags: ["Glass", "Dock"], source: "components/effects/liquid-glass.tsx", original: "https://21st.dev/@suraj-xd/components/liquid-glass", fidelity: "source", loadDemo: namedDemo(() => import("./demos/liquid-glass-demo"), "LiquidGlassDemo") },
  { id: "liquid-gooey", previewHeight: 430, previewMinWidth: 680, previewWide: true, name: "Liquid Gooey", author: "Jakub Antalik", category: "effects", tags: ["Liquid", "Gooey", "Morph", "Motion", "RedPalm"], source: "components/effects/liquid-gooey.tsx", original: "https://gooey.jakubantalik.com/", originalLabel: "Demo", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/liquid-gooey-demo"), "LiquidGooeyDemo") },
  { id: "aurora-background", previewHeight: 430, previewMinWidth: 680, previewWide: true, name: "Aurora Background", author: "manuarora700", category: "effects", tags: ["Background", "Aurora"], source: "components/effects/aurora-background.tsx", original: "https://21st.dev/@manuarora700/components/aurora-background", fidelity: "source", loadDemo: namedDemo(() => import("./demos/aurora-background-demo"), "AuroraBackgroundDemo") },
  { id: "oceanic-currents", previewHeight: 430, previewMinWidth: 680, previewWide: true, name: "Oceanic Currents", author: "community / shaders", category: "effects", tags: ["Shader", "WebGL"], source: "components/effects/oceanic-currents.tsx", original: "https://21st.dev/community/shaders/oceanic-currents-5fc8773a-9561-4cba-9eec-27b7899021e3", fidelity: "reproduction", heavy: true, loadDemo: namedDemo(() => import("./demos/oceanic-currents-demo"), "OceanicCurrentsDemo") },
  { id: "spark-badge", previewHeight: 380, previewMinWidth: 560, previewWide: true, name: "Spark Badge", author: "mengto", category: "effects", tags: ["Canvas", "Particles"], source: "components/effects/spark-badge.tsx", original: "https://21st.dev/@mengto/components/spark-badge", fidelity: "adapted", heavy: true, loadDemo: namedDemo(() => import("./demos/spark-badge-demo"), "SparkBadgeDemo") },
  { id: "particle-drift", previewHeight: 430, previewMinWidth: 680, previewWide: true, name: "Particle Drift", author: "mengto", category: "effects", tags: ["Canvas", "Particles"], source: "components/effects/particle-drift.tsx", original: "https://21st.dev/@mengto/components/particle-drift", fidelity: "adapted", heavy: true, loadDemo: namedDemo(() => import("./demos/particle-drift-demo"), "ParticleDriftDemo") },
  { id: "spotlight", name: "Spotlight", author: "ibelick", category: "effects", tags: ["Cursor", "Spotlight"], source: "components/effects/spotlight.tsx", original: "https://21st.dev/@ibelick/components/spotlight", fidelity: "source", loadDemo: namedDemo(() => import("./demos/spotlight-demo"), "SpotlightDemo") },
  { id: "progressive-flux-loader", name: "Progressive Flux Loader", author: "ruixen.ui", category: "loaders", tags: ["Progress", "Motion"], source: "components/loaders/progressive-flux-loader.tsx", original: "https://21st.dev/@ruixen.ui/components/progressive-flux-loader", fidelity: "source", loadDemo: namedDemo(() => import("./demos/progressive-flux-loader-demo"), "ProgressiveFluxLoaderDemo") },
  { id: "morphing-square", name: "Morphing Square", author: "molecule-lab-rushil", category: "loaders", tags: ["Loader", "Motion"], source: "components/loaders/morphing-square.tsx", original: "https://21st.dev/@molecule-lab-rushil/components/morphing-square", fidelity: "source", loadDemo: namedDemo(() => import("./demos/morphing-square-demo"), "MorphingSquareDemo") },
  { id: "theme-toggle", name: "Theme Toggle", author: "ayushmxxn", category: "toggles", tags: ["Theme", "Serenity"], source: "components/toggles/theme-toggle.tsx", original: "https://21st.dev/@ayushmxxn/components/theme-toggle", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/theme-toggle-demo"), "ThemeToggleDemo") },
  { id: "sky-toggle", name: "Sky Toggle", author: "ravikatiyar162", category: "toggles", tags: ["Theme", "Sky"], source: "components/toggles/sky-toggle.tsx", original: "https://21st.dev/@ravikatiyar162/components/sky-toggle", fidelity: "source", loadDemo: namedDemo(() => import("./demos/sky-toggle-demo"), "SkyToggleDemo") },
  { id: "curtain-theme-toggle", name: "Curtain Theme Toggle", author: "fatih-developer", category: "toggles", tags: ["Theme", "Transition"], source: "components/toggles/curtain-theme-toggle.tsx", original: "https://21st.dev/@fatih-developer/components/curtain-theme-toggle", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/curtain-theme-toggle-demo"), "CurtainThemeToggleDemo") },
  { id: "cinematic-theme-switcher", name: "Cinematic Theme Switcher", author: "omrohilla6", category: "toggles", tags: ["Theme", "Cinematic"], source: "components/toggles/cinematic-theme-switcher.tsx", original: "https://21st.dev/@omrohilla6/components/cinematic-theme-switcher", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/cinematic-theme-switcher-demo"), "CinematicThemeSwitcherDemo") },
  { id: "liquid-glass-button", name: "Liquid Glass Button", author: "designali-in", category: "buttons", tags: ["Glass", "Liquid", "RedPalm"], source: "components/buttons/liquid-glass-button.tsx", original: "https://21st.dev/@designali-in/components/liquid-glass-button", fidelity: "source", loadDemo: namedDemo(() => import("./demos/liquid-glass-button-demo"), "LiquidGlassButtonDemo") },
  { id: "github-liquid-button", name: "Button 1 · Github Liquid", author: "uilayout.contact", category: "buttons", tags: ["Liquid", "Motion"], source: "components/buttons/liquid-gradient-button.tsx", original: "https://21st.dev/@uilayout.contact/components/button-1", fidelity: "adapted", loadDemo: namedDemo(() => import("./demos/button-one-demo"), "ButtonOneDemo") },
  { id: "expand-arrow-button", name: "Button 7 · Expand Arrow", author: "uilayout.contact", category: "buttons", tags: ["Hover", "Arrow"], source: "components/buttons/expand-arrow-button.tsx", original: "https://21st.dev/@uilayout.contact/components/button-7", fidelity: "source", loadDemo: namedDemo(() => import("./demos/button-seven-demo"), "ButtonSevenDemo") },
  { id: "tactile-button", previewHeight: 380, previewMinWidth: 560, previewWide: true, name: "Tactile Button", author: "mengto", category: "buttons", tags: ["WebGL", "Tactile"], source: "components/buttons/tactile-button.tsx", original: "https://21st.dev/@mengto/components/tactile-button", fidelity: "adapted", heavy: true, loadDemo: namedDemo(() => import("./demos/tactile-button-demo"), "TactileButtonDemo") },
  { id: "mac-os-dock", previewHeight: 360, previewMinWidth: 680, previewWide: true, name: "Mac OS Dock", author: "dhmnpunit", category: "docks", tags: ["Navigation", "macOS"], source: "components/docks/mac-os-dock.tsx", original: "https://21st.dev/@dhmnpunit/components/mac-os-dock", fidelity: "source", loadDemo: namedDemo(() => import("./demos/mac-os-dock-demo"), "MacOSDockDemo") },

  { id: "footer-7", name: "Footer 7", author: "shadcnblockscom", category: "docks", tags: ["Footer", "Navigation", "Layout", "Minimal"], source: "components/navigation/footer-7.tsx", original: "https://21st.dev/@shadcnblockscom/components/footer-7", originalSource: "https://www.shadcnblocks.com/blocks/footer/basic", license: "Upstream registry does not declare a license; attribution retained", dependencies: ["react-icons"], fidelity: "adapted", previewHeight: 620, previewMinWidth: 900, previewWide: true, featuredRank: 10, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/footer-7-demo"), "Footer7Demo") },
  { id: "mini-navbar", name: "Mini Navbar", author: "aghasisahakyan1", category: "docks", tags: ["Navigation", "Minimal", "Responsive", "Pill"], source: "components/navigation/mini-navbar.tsx", original: "https://21st.dev/@aghasisahakyan1/components/mini-navbar", license: "MIT (as listed on 21st.dev)", dependencies: ["lucide-react"], fidelity: "reproduction", previewHeight: 340, previewMinWidth: 680, previewWide: true, previewTone: "dark", featuredRank: 20, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/mini-navbar-demo"), "MiniNavbarDemo") },
  { id: "tooltip-icon-button", name: "Tooltip Icon Button", author: "serafimcloud", category: "selectors", tags: ["Tooltip", "Button", "Accessibility", "Interaction"], source: "components/interaction/tooltip-icon-button.tsx", original: "https://21st.dev/@serafimcloud/components/tooltip-icon-button", license: "Not declared on 21st.dev", dependencies: ["lucide-react"], fidelity: "reproduction", previewHeight: 300, previewMinWidth: 420, featuredRank: 30, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/tooltip-icon-button-demo"), "TooltipIconButtonDemo") },
  { id: "line-tabs", name: "Tabs · With Line", author: "originui", category: "selectors", tags: ["Tabs", "Navigation", "Minimal", "Accessibility"], source: "components/interaction/line-tabs.tsx", original: "https://21st.dev/@originui/components/tabs/with-line", originalSource: "https://github.com/shadcn/originui", license: "MIT", dependencies: ["@radix-ui/react-tabs"], fidelity: "adapted", previewHeight: 260, previewMinWidth: 480, featuredRank: 40, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/line-tabs-demo"), "LineTabsDemo") },
  { id: "table-accordion", name: "Accordion · Table w/ Chevron", author: "originui", category: "selectors", tags: ["Accordion", "Disclosure", "Minimal", "Accessibility"], source: "components/interaction/table-accordion.tsx", original: "https://21st.dev/@originui/components/accordion/table-w-chevron", originalSource: "https://github.com/shadcn/originui", license: "MIT", dependencies: ["@radix-ui/react-accordion", "lucide-react"], fidelity: "adapted", previewHeight: 520, previewMinWidth: 520, previewWide: true, featuredRank: 50, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/table-accordion-demo"), "TableAccordionDemo") },
  { id: "copy-code-button", name: "Copy Code Button", author: "minhxthanh", category: "selectors", tags: ["Code", "Copy", "Clipboard", "Interaction"], source: "components/interaction/copy-code-button.tsx", original: "https://21st.dev/@minhxthanh/components/copy-code-button", license: "Not declared on 21st.dev", dependencies: ["lucide-react"], fidelity: "reproduction", previewHeight: 300, previewMinWidth: 520, featuredRank: 60, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/copy-code-button-demo"), "CopyCodeButtonDemo") },
  { id: "button-with-number", name: "Button · With Number", author: "originui", category: "buttons", tags: ["Button", "Badge", "Count", "Minimal"], source: "components/buttons/button-with-number.tsx", original: "https://21st.dev/community/components/originui/button/button-with-number", originalSource: "https://github.com/shadcn/originui", license: "MIT", dependencies: ["lucide-react"], fidelity: "adapted", featuredRank: 70, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/button-with-number-demo"), "ButtonWithNumberDemo") },
  { id: "status-badge", name: "Status Badge", author: "serafimcloud", category: "status", tags: ["Status", "Badge", "Indicator", "Minimal"], source: "components/status/status-badge.tsx", original: "https://21st.dev/@serafimcloud/components/status-badge", originalSource: "https://blocks.tremor.so/blocks/badges", license: "MIT", dependencies: ["class-variance-authority", "react-icons"], fidelity: "adapted", featuredRank: 80, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/status-badge-demo"), "StatusBadgeDemo") },
  { id: "breadcrumb-chevron", name: "Breadcrumb · Chevron", author: "originui", category: "docks", tags: ["Navigation", "Breadcrumb", "Minimal", "Accessibility"], source: "components/navigation/breadcrumb-chevron.tsx", original: "https://21st.dev/community/components/originui/breadcrumb/with-chevron-right", originalSource: "https://github.com/shadcn/originui", license: "MIT", dependencies: ["lucide-react"], fidelity: "adapted", previewHeight: 220, previewMinWidth: 440, featuredRank: 90, visualWeight: "light", runtimeWeight: "light", usedInSite: false, loadDemo: namedDemo(() => import("./demos/breadcrumb-chevron-demo"), "BreadcrumbChevronDemo") },
  { id: "hyper-text", name: "Hyper Text", author: "dillionverma / Magic UI", category: "text", tags: ["Typography", "Text", "Hover", "Motion"], source: "components/text/hyper-text.tsx", original: "https://21st.dev/@dillionverma/components/hyper-text", originalSource: "https://magicui.design/docs/components/hyper-text", license: "MIT", dependencies: ["motion"], fidelity: "adapted", previewHeight: 260, previewMinWidth: 420, featuredRank: 100, visualWeight: "medium", runtimeWeight: "medium", usedInSite: false, loadDemo: namedDemo(() => import("./demos/hyper-text-demo"), "HyperTextDemo") },
];

const weightScore: Record<ComponentWeight, number> = { light: 0, medium: 1, heavy: 2 };

export const items: GalleryItem[] = rawItems.map((value, index) => ({
  ...value,
  dependencies: value.dependencies ?? [],
  featuredRank: value.featuredRank ?? 500 + index,
  visualWeight: value.visualWeight ?? (value.heavy ? "heavy" : "medium"),
  runtimeWeight: value.runtimeWeight ?? (value.heavy ? "heavy" : "medium"),
  usedInSite: value.usedInSite ?? false,
})).sort((a, b) => {
  if (a.usedInSite !== b.usedInSite) return a.usedInSite ? -1 : 1;
  const aWeight = weightScore[a.visualWeight] + weightScore[a.runtimeWeight];
  const bWeight = weightScore[b.visualWeight] + weightScore[b.runtimeWeight];
  if (aWeight !== bWeight) return aWeight - bWeight;
  return a.featuredRank - b.featuredRank;
});

export const categoryLabels: Record<Category | "all", string> = {
  all: "全部",
  buttons: "按钮",
  cards: "卡片",
  effects: "动效",
  text: "文字",
  toggles: "开关",
  docks: "导航",
  loaders: "加载",
  status: "状态",
  borders: "边框",
  selectors: "交互",
};

export const fidelityLabels: Record<Fidelity | "all", string> = {
  all: "全部来源",
  source: "原版源码",
  adapted: "最小适配",
  reproduction: "独立复刻",
};
