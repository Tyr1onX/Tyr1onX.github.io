# Music artwork and metadata sources

The Music page is a personal archive. Album artwork and preview audio are not claimed as original Tyr1onX assets.

## How production assets are prepared

`python scripts/generate-music-assets.py` runs during the GitHub Pages build.

- Artwork is resolved from Apple/iTunes metadata, except the original 五月天《愛情萬歲》 cover, which is fetched from the MusicBrainz Cover Art Archive.
- The downloaded raster artwork is embedded into local `assets/music/covers/*.svg` files in the deployment artifact. The browser therefore loads the cover from this site rather than hotlinking the upstream image.
- When Apple exposes an official preview clip, only its remote preview URL is written to `assets/music/generated-previews.json`. Full song audio is never downloaded or stored in this repository or Pages artifact.
- Preview metadata is regenerated on every deployment and on the existing daily Pages refresh.
- If a remote artwork lookup fails, the build falls back to one of the three committed local demo covers instead of failing deployment.

Artwork, recordings, artist names, album names, and related marks remain the property of their respective rights holders. Source links below are retained for identification and provenance; this file is not a statement about the legal status of every possible use.

## Curated tracks

| Track | Artist | Album / release | Year | Metadata / listening source | Artwork resolution |
| --- | --- | --- | ---: | --- | --- |
| 太陽與地球 | 盧廣仲 | HeartBreakFast 傷心早餐店 | 2025 | Apple Music album `1839368226`; TEAM EAR release page | iTunes lookup artwork for the matching track |
| 玻璃 | Gareth.T | 玻璃 - Single | 2026 | Apple Music track `6769327013` | iTunes lookup artwork |
| 普通朋友 | 陶喆 | I'm O.K. | 1999 | Apple Music track `905206479` | iTunes lookup artwork |
| 愛我還是他 | 陶喆 | 太平盛世 | 2005 | Shazam / Apple catalog track `905206660` | iTunes lookup artwork |
| 拆穿 | 小霞 | 小霞 | 2015 | Apple Music track `1066174990` | iTunes lookup artwork |
| 不將就 | 李榮浩 | 有理想 | 2016 | Shazam catalog track `1072339996`; Spotify album `3ykTa8oJzxd7n6vplb3VTl` | iTunes lookup artwork when available |
| 刻在我心底的名字 | 盧廣仲 | 刻在我心底的名字 - Single | 2020 | Apple Music release `1528149434`; TEAM EAR news | iTunes lookup artwork for the matching track |
| Love Story (Taylor’s Version) | Taylor Swift | Fearless (Taylor’s Version) | 2021 | Apple Music track `1552791427` | iTunes lookup artwork |
| カタオモイ | Aimer | daydream | 2016 | Apple Music track `1538259004`; MusicBrainz release `e5d74fda-288e-4677-b433-b8fadafa2d1e` | iTunes lookup artwork |
| Anxiety | Doechii | Anxiety - Single | 2025 | Apple Music track `1800052074` | iTunes lookup artwork |
| 溫柔 | 五月天 | 愛情萬歲 | 2000 | Apple Music track `1078528644`; MusicBrainz release `a0704b30-faf4-4909-b61d-7b1cd9a55575` | Cover Art Archive `front-500` for the original album |
| 美人魚 | 林俊傑 | 第二天堂(江南) | 2004 | Apple Music track `1071753633`; MusicBrainz release `7f930e65-b3b0-408d-bd8d-be2ab02af5d2` | iTunes lookup artwork |

### Reference URLs

- HeartBreakFast / 太陽與地球: <https://music.apple.com/cn/album/heartbreakfast-%E5%82%B7%E5%BF%83%E6%97%A9%E9%A4%90%E5%BA%97/1839368226>
- TEAM EAR HeartBreakFast: <https://www.team-ear.com/release_onLinePlay.php?id=3810>
- 玻璃: <https://music.apple.com/us/song/6769327013>
- 普通朋友: <https://music.apple.com/us/song/905206479>
- 愛我還是他: <https://www.shazam.com/zh-tw/song/905206660/%E7%88%B1%E6%88%91%E8%BF%98%E6%98%AF%E4%BB%96>
- 小霞 / 拆穿: <https://music.apple.com/us/song/1066174990>
- 不將就: <https://www.shazam.com/zh-tw/song/1072339996/%E4%B8%8D%E5%B0%86%E5%B0%B1-%E7%94%B5%E5%BD%B1%E4%BD%95%E4%BB%A5%E7%AC%99%E7%AE%AB%E9%BB%98%E7%89%87%E5%B0%BE%E6%9B%B2>
- 刻在我心底的名字: <https://music.apple.com/cn/album/%E5%88%BB%E5%9C%A8%E6%88%91%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E9%9B%BB%E5%BD%B1-%E5%88%BB%E5%9C%A8%E4%BD%A0%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E4%B8%BB%E9%A1%8C%E6%9B%B2-single/1528149434>
- TEAM EAR single announcement: <https://www.team-ear.com/news_detail.php?id=2877>
- Love Story (Taylor’s Version): <https://music.apple.com/us/song/1552791427>
- Aimer / daydream: <https://music.apple.com/us/album/daydream/1538258997>
- Anxiety: <https://music.apple.com/us/song/1800052074>
- 五月天《愛情萬歲》 Cover Art Archive record: <https://musicbrainz.org/release/a0704b30-faf4-4909-b61d-7b1cd9a55575/cover-art>
- 美人魚: <https://music.apple.com/us/song/1071753633>

## Local demo covers

The previous three 1000×1000 WebP demo covers remain committed only as graceful fallbacks for local development or an upstream artwork outage:

- `assets/music/demo-01/cover.webp`
- `assets/music/demo-02/cover.webp`
- `assets/music/demo-03/cover.webp`
