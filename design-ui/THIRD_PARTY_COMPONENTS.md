# Third-party component notes

> Migrated into `Tyr1onX/Tyr1onX.github.io` from `Tyr1onX/ui` at `bda3fc97b8da18555f89d3a3a040dc4c73f6cc60`. The original UI repository remains the historical content/source reference.

This repository contains visual components sourced from or adapted from public upstream implementations. The gallery fidelity badge is intentionally conservative:

- **原版源码 / source**: public upstream source is available and the component implementation is preserved; gallery wrappers or local demo data may differ.
- **最小适配 / adapted**: public upstream source is available, but a small runtime/environment change is required to keep previews isolated, self-contained, or compatible with Vite.
- **独立复刻 / reproduction**: public reference behavior is known, but a complete trustworthy upstream implementation is unavailable or intentionally not imported; the local implementation is explicitly independent and does not claim source fidelity.

## Verified source-based components

- Liquid Glass: public source by suraj-xd.
- Aurora Background: public source by Manu Arora / Aceternity UI.
- Spotlight: public Motion Primitives implementation by ibelick (MIT).
- Sky Toggle: public mirror of Ravi Katiyar's 21st component.
- Liquid Glass Button: public Designali implementation.
- Button 7 / Expand Arrow: public UI Layout implementation.
- Mac OS Dock: public mirrors reproduce the 21st component implementation, including responsive sizing, cosine magnification, RAF interpolation, optional GSAP click bounce, and open-app indicators. The gallery only substitutes local self-contained demo icons.
- Progressive Flux Loader: Ruixen UI public registry implementation (MIT).
- Morphing Square: molecule-ui public registry implementation (MIT).
- Flipping Card: based on Erik / aghasisahakyan1's public 21st implementation; the 3D perspective and hover-flip structure are retained.
- Gooey Dock: based directly on Ruixen UI's public source, preserving cosine proximity magnification, lift, labels, and optional generated tick sound.
- Animated Gradient Border: based on EaseMize's public implementation with the same conic-gradient animation model; the component carries its required animation CSS so it remains self-contained in the gallery.

## Source-based with gallery isolation/runtime adaptation

- Interactive Selector: based on minhxthanh's 21st.dev rendered reference and a matching public mirror. The five camping panels, exact text/image set, Font Awesome icon family, `flex: 7` active expansion, 700ms transitions, and 180ms staggered entrance are preserved. Vite compatibility replaces `style jsx` with a normal scoped style tag and the demo exposes a viewport-height override for gallery containment.
- Liquid Gooey: uses Jakub Antalik's official `liquid-gooey` package (`0.1.x`, MIT) directly. The compact gallery component follows the upstream Plus Menu morph pattern while using local inline SVG icons and RedPalm-oriented labels; no iframe, CDN, or external image assets are required.
- Theme Toggle: the public Ayushmaan/21st-style implementation uses `next-themes` and changes the document theme. The gallery preserves the moving-knob/icon behavior but keeps theme state local so one tile cannot recolor the whole component browser.
- Curtain Theme Toggle: the public Fatih implementation is restored, including `default` / `appbar` / `icon` variants, design tokens, and falling/rising curtain timing. Two optional isolation hooks contain the curtain inside a preview tile and prevent global `document.documentElement` dark-class mutation.
- Cinematic Theme Switcher: based on the public Om Rohilla implementation. Visuals, spring motion, and particle burst are preserved while theme state is isolated for the gallery.
- Button 1 / Github Liquid: based on UI Layout's public registry implementation. The 17-color Motion radial-gradient system and seven Liquid layers are preserved; the local component split and gallery wrapper are runtime adaptations.
- Spark Badge: based on Meng To / ThreeUI's public iframe wrapper and local Canvas renderer. The gallery adds sizing/containment around the original isolation model.
- Particle Drift: based on Meng To / ThreeUI's public Particle Drift source. The gallery removes unrelated external runtime resources and keeps the effect self-contained.
- Tactile Button: based on Meng To / ThreeUI's public Nexus Tactile source. The original source relies on a larger isolated HTML/runtime environment, so the gallery implementation remains explicitly marked adapted.
- Dynamic Island: adapted from Erik / aghasisahakyan1's public implementation; spring-layout morphing and blur/scale transitions are retained while demo-specific phone content is generalized into reusable slots.
- Card Stack: adapted from Ruixen UI's public implementation; fan geometry, drag behavior, and spring motion are retained, with Next.js `Link` replaced by a normal anchor for Vite compatibility.
- Animated Glow Card: adapted from EaseMize's public glow-card treatment into a self-contained component that does not require the upstream page stylesheet.

## Independent reproductions / intentionally different runtime

- Handwriting Text: independent Vite-friendly reproduction of Moazzam's 21st.dev Handwriting Text reference. The public page exposes the behavior, usage API, MIT license label, and preview, while the full `Component.tsx` implementation is member-locked. This repository therefore does not claim source fidelity: it recreates the trace-then-fill word cycle with Framer Motion, local system handwriting fonts, configurable timing, and reduced-motion handling.
- Oceanic Currents: the 21st shader preview is the visual reference, but no complete trustworthy public upstream source matching that specific preset has been verified. The current implementation is an independent zero-dependency WebGL reproduction and must remain marked `reproduction` until a source is found.
- Playing Card: lightweight Vite-friendly reproduction of Maxim Bortnikov's 21st Playing Card. The original depends on Next.js, `@react-three/fiber`, and `three`; this gallery version preserves the layered card/inscription/reveal idea without importing that runtime stack.
- Liquid Glass Card: lightweight reproduction of Ali Imam's 21st liquid-glass card treatment, implemented as a reusable self-contained glass panel for this gallery.

For source-available components, this repository prefers the upstream implementation over dependency-reduced visual rewrites. Adaptations should be limited to gallery containment, build-environment compatibility, replacing framework-only primitives, removal of unrelated external page assets, and other changes required to prevent one demo from affecting the rest of the preview site.

## 2026-09-01 · 21st.dev curated lightweight batch

This batch was selected from 28 reviewed 21st.dev candidates. The selection record is kept in `21ST_CURATION_2026-09-01.md`. Components remain third-party-derived inventory; gallery wrappers and theme containment do not transfer authorship to Tyr1onX.

- **Footer 7 — Shadcnblocks.com**
  - 21st.dev: https://21st.dev/@shadcnblockscom/components/footer-7
  - Original source page: https://www.shadcnblocks.com/blocks/footer/basic
  - Public registry mirror used to verify implementation: https://shadcnregistry.com/shadcnblocks/footer7
  - Dependencies: `react-icons`; local `cn` helper.
  - Fidelity: **adapted**. The public registry structure, props, link groups, social row and legal row are retained; only local import/theme/preview sizing compatibility is changed.
  - License: the 21st.dev page and registry mirror inspected for this migration do not declare a license. Attribution is therefore retained explicitly and no license is inferred.

- **Mini Navbar — Erik / aghasisahakyan1**
  - 21st.dev: https://21st.dev/@aghasisahakyan1/components/mini-navbar
  - Dependencies: `lucide-react` for the gallery reproduction's mobile menu icons.
  - Fidelity: **reproduction**. 21st exposes the preview/usage and describes the minimalist responsive behavior, but a complete trustworthy `Component.tsx` source was not available through the public page during migration.
  - License: MIT is listed on the 21st.dev component page.

- **Tooltip Icon Button — Serafim**
  - 21st.dev: https://21st.dev/@serafimcloud/components/tooltip-icon-button
  - Dependencies: `lucide-react` in the demo.
  - Fidelity: **reproduction**. Public 21st usage/API and side variants are preserved; the inventory implementation uses a self-contained accessible tooltip surface instead of claiming access to the member-gated source.
  - License: MIT (listed on the current 21st.dev component page).

- **Tabs · With Line — Origin UI**
  - 21st.dev: https://21st.dev/originui/tabs
  - Original source: https://github.com/shadcn/originui
  - Dependencies: `@radix-ui/react-tabs`.
  - Fidelity: **adapted**. The public Origin UI with-line trigger geometry, full-width active underline, neutral tab list and centered content treatment are preserved with Radix primitives.
  - License: MIT (Origin UI repository).

- **Accordion · Table w/ Chevron — Origin UI**
  - 21st.dev: https://21st.dev/community/components/originui/accordion/table-w-chevron
  - Original source: https://github.com/shadcn/originui
  - Dependencies: `@radix-ui/react-accordion`, `lucide-react`.
  - Fidelity: **adapted**. The public four-row example, default-open third item, heading, border stacking, spacing, chevron state and Radix behavior are retained.
  - License: MIT (Origin UI repository; also listed on the 21st.dev component page).

- **Copy Code Button — Le Thanh / minhxthanh**
  - 21st.dev: https://21st.dev/@minhxthanh/components/copy-code-button
  - Dependencies: `lucide-react` in the reproduction.
  - Fidelity: **reproduction**. The public page exposes usage and the copy-button interaction but not a complete trustworthy component source. The local implementation keeps clipboard fallback and avoids bundling a syntax-highlighting runtime.
  - License: not declared on the inspected 21st.dev page.

- **Button · With Number — Origin UI**
  - 21st.dev: https://21st.dev/community/components/originui/button/button-with-number
  - Original source: https://github.com/shadcn/originui
  - Dependencies: `lucide-react`.
  - Fidelity: **adapted**. The outline button + small numeric badge composition is preserved while removing the need to import the site's full shadcn Button wrapper.
  - License: MIT (Origin UI repository).

- **Status Badge — Serafim**
  - 21st.dev: https://21st.dev/@serafimcloud/components/status-badge
  - Original source reference listed by 21st.dev: https://blocks.tremor.so
  - Dependencies: `class-variance-authority`, `react-icons` in the gallery reproduction (21st lists `@remixicon/react` + CVA).
  - Fidelity: **adapted**. Badge 8 is now matched to the public Tremor/21st structure: neutral outlined pill, colored leading status icon, divider, trailing context icon/text; only token names and icon package are adapted to the gallery.
  - License: MIT (listed on 21st.dev; Tremor source reference retained).

- **Breadcrumb · Chevron — Origin UI**
  - 21st.dev: https://21st.dev/community/components/originui/breadcrumb/with-chevron-right
  - Original source: https://github.com/shadcn/originui
  - Dependencies: `lucide-react`.
  - Fidelity: **adapted**. The Home → Components → current-page chevron breadcrumb is kept as shown, with a reusable gallery wrapper and no framework-only link dependency.
  - License: MIT (Origin UI repository).

- **Hyper Text — Magic UI / Dillion Verma**
  - 21st.dev: https://21st.dev/@dillionverma/components/hyper-text
  - Original source: https://magicui.design/docs/components/hyper-text
  - Public registry used for verification: https://magicui.design/r/hyper-text.json
  - Dependencies: current upstream uses `motion`; the 21st.dev listing still reports `framer-motion`. Both were already present in this Design Library before this batch.
  - Fidelity: **adapted**. The current Magic UI registry implementation is preserved with only the `cn` import redirected to the local utility and formatting adjusted for this repository.
  - License: MIT (listed on 21st.dev / Magic UI).
