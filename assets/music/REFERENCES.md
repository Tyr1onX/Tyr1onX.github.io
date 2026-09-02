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

Tyr1onX Music v1 established the site editorial shell, slow CSS-only vinyl rotation, simple previous/next controls, small numeric collection navigation, and a cover-plus-vinyl focal composition. It intentionally excluded progress, volume, waveform/equalizer animation, glassmorphism, full-screen artwork gradients, Canvas/WebGL, and framework dependencies.

## Retro turntable visual pass

A second research pass was completed before replacing the original half-exposed vinyl composition with a full turntable object.

| Reference | URL | Used in this pass | Rejected in this pass |
| --- | --- | --- | --- |
| NetEase Cloud Music — early vinyl player discussion | https://sspai.com/post/33964 | Vinyl as the single memorable listening ritual; deliberate slow rotation | Full-screen player framing and app chrome |
| NetEase Cloud Music v3 UI review | https://sspai.com/post/31493 | Flat, simplified tonearm and stronger focus on the record itself | Cover-derived blurred background and full transport bar |
| MD Vinyl | https://apps.apple.com/us/app/md-vinyl-music-app/id1606306441 | Turntable hardware as the primary visual object; needle movement communicates playback | Direct needle scrubbing, widgets, subscription UI |
| Vinyl Vue | https://github.com/Ventuss-OvO/Vinyl-Vue | Tonearm moving between rest and playing position; restrained retro hardware cues | Vinyl crackle, full player application and album browser |
| Dribbble — Music Player | https://dribbble.com/shots/20509121-Music-Player | Minimal digital-turntable composition and soothing mechanical motion | Inverted/experimental playback motion that would distract from the archive |
| Behance — Virtual Drive Turntable System | https://www.behance.net/gallery/31984881/Vinyl-Virtual-Drive-Turntable-System | Platter, pivot, tonearm, small hardware controls as a coherent physical silhouette | Heavy skeuomorphic texture, gold trim and realistic equipment UI |

### v2 synthesis

The turntable pass keeps Tyr1onX's existing editorial page shell and real music data, but turns the left visual into one coherent object: a muted deck, full-size platter and record, a CSS tonearm, a small status lamp, and the current album sleeve resting partly over the lower-left edge. The Apple preview's existing play/pause state only drives the tonearm and status lamp. No new player controls, blur backgrounds, audio effects, Canvas, WebGL, framework or data-layer changes are introduced.
