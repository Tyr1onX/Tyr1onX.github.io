# Music page design references

Research completed before implementing Music v1. The goal was to study composition and interaction, not reproduce any one design.

| Reference | URL | Worth borrowing | Not suitable for Tyr1onX |
| --- | --- | --- | --- |
| 21st.dev — Music Artwork | https://21st.dev/community/components/diriktv/music-artwork/default | Album artwork paired with a partially visible animated vinyl; simple focal object | Next/React dependency; full-screen demo framing |
| MD Vinyl | https://apps.apple.com/us/app/md-vinyl-music-app/id1606306441 | Treat vinyl as a quiet listening ritual; large readable record; subtle persistent motion | Real playback, tonearm manipulation, widgets, subscription/app chrome |
| Codrops — Interactive Record Player | https://github.com/codrops/RecordPlayer | Separating the record visual from the rest of the UI; record movement during track changes | Web Audio API, audio hosting, full turntable simulation, sound effects |
| Vinyl Vue | https://github.com/Ventuss-OvO/Vinyl-Vue | Album-library-as-vinyl concept; record-led visual identity | Full online player behavior and app-level feature set |
| Dribbble — Web Vinyl Player | https://dribbble.com/shots/6836442-Web-Vinyl-Player | Monochrome restraint, thin controls, information hierarchy | Dense playlist / volume / player dashboard structure |
| Dribbble — Interactive Record Player | https://dribbble.com/shots/2781784-Interactive-Record-Player | Strong cover-to-record scale relationship; album switching as the main interaction | Large side collection panel, physical tonearm controls, demo-like UI |
| Dribbble — Vinyl Listening Landing Page | https://dribbble.com/shots/26342459-Vinyl-Listening-Landing-Page-Concept | Editorial typography, whitespace, analog object in a clean web layout | Marketing landing-page hero language and product CTA structure |
| Behance — TurnPlay | https://www.behance.net/gallery/6291091/TurnPlay-vinyl-player-for-iPad | Careful physical proportions and restrained turntable presentation | High-fidelity skeuomorphism and touch-driven needle interaction |
| Dribbble — VinylPlayer | https://dribbble.com/shots/1772785-VinylPlayer | Minimal mobile presentation and neutral grayscale palette | Native-app chrome and real playback controls |

## Final synthesis

Tyr1onX Music v1 uses the site's existing editorial shell, one cover-and-vinyl focal composition, slow CSS-only rotation, light record retreat during switching, simple previous/next controls, and small numeric collection navigation. It intentionally excludes playback, progress, volume, waveform/equalizer animation, tonearm interaction, glassmorphism, full-screen artwork gradients, Canvas/WebGL, and framework dependencies.
