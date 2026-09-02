# Music artwork sources

Music demo v2 still contains no third-party album artwork and does not represent the user's real music preferences.

## Local demo covers

The three current covers are generated locally for layout and interaction testing only. They use simple typography, numbering, muted colors, and geometric line work; no external images, AI-generated photography, artist branding, or copyrighted album art is used.

| Slot | Local file | Size | Purpose |
| --- | --- | ---: | --- |
| Demo 01 | `assets/music/demo-01/cover.webp` | 1000×1000 | warm neutral cover / circular motif |
| Demo 02 | `assets/music/demo-02/cover.webp` | 1000×1000 | blue-gray cover / crossed-line motif |
| Demo 03 | `assets/music/demo-03/cover.webp` | 1000×1000 | muted violet cover / arc motif |

These files can be deleted and replaced directly when real music data is provided; the page data structure does not depend on their visual design.

## Future real artwork policy

When real tracks are added:

- prefer official artist / label / distributor / streaming-service artwork;
- save artwork locally under `assets/music/`;
- convert to WebP where practical;
- record the original source URL, original dimensions, and local filename here;
- do not hotlink, use AI-generated fake covers, Pinterest, unknown wallpaper sites, or watermarked images.
