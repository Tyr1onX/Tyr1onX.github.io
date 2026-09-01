# Third-party component notes

> Migrated into `Tyr1onX/Tyr1onX.github.io` from `Tyr1onX/ui` at `bda3fc97b8da18555f89d3a3a040dc4c73f6cc60`. The original UI repository remains the historical content/source reference.

This repository contains visual components sourced from or adapted from public upstream implementations. The gallery fidelity badge is intentionally conservative:

- **原版源码 / source**: public upstream source is available and the component implementation is preserved; gallery wrappers or local demo data may differ.
- **最小适配 / adapted**: public upstream source is available, but a small runtime/environment change is required to keep previews isolated, self-contained, or compatible with Vite.
- **复刻待核对 / reproduction**: the 21st visual is known, but a complete trustworthy public upstream source has not been verified or the original runtime stack is intentionally not imported.

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

## Reproduction pending verification / intentionally lightweight

- Handwriting Text: independent Vite-friendly reproduction of Moazzam's 21st.dev Handwriting Text reference. The public page exposes the behavior, usage API, MIT license label, and preview, while the full `Component.tsx` implementation is member-locked. This repository therefore does not claim source fidelity: it recreates the trace-then-fill word cycle with Framer Motion, local system handwriting fonts, configurable timing, and reduced-motion handling.
- Oceanic Currents: the 21st shader preview is the visual reference, but no complete trustworthy public upstream source matching that specific preset has been verified. The current implementation is an independent zero-dependency WebGL reproduction and must remain marked `reproduction` until a source is found.
- Playing Card: lightweight Vite-friendly reproduction of Maxim Bortnikov's 21st Playing Card. The original depends on Next.js, `@react-three/fiber`, and `three`; this gallery version preserves the layered card/inscription/reveal idea without importing that runtime stack.
- Liquid Glass Card: lightweight reproduction of Ali Imam's 21st liquid-glass card treatment, implemented as a reusable self-contained glass panel for this gallery.

For source-available components, this repository prefers the upstream implementation over dependency-reduced visual rewrites. Adaptations should be limited to gallery containment, build-environment compatibility, replacing framework-only primitives, removal of unrelated external page assets, and other changes required to prevent one demo from affecting the rest of the preview site.
