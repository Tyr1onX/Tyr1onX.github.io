#!/usr/bin/env python3
"""Prepare local album artwork and official preview metadata for the Music page.

The committed site keeps only source metadata. During the Pages build this script:
- resolves Apple/iTunes metadata for the curated tracks;
- downloads album artwork and embeds it in local SVG files, so the deployed page does not hotlink covers;
- writes a small JSON map of official preview URLs when Apple exposes one.

If any remote lookup fails, deployment still succeeds and that track falls back to one of the
committed demo covers. Full song audio is never downloaded or stored here.
"""

from __future__ import annotations

import base64
import json
import re
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "music" / "covers"
PREVIEW_FILE = ROOT / "assets" / "music" / "generated-previews.json"
USER_AGENT = "Tyr1onX-MusicArchive/1.0 (+https://github.com/Tyr1onX/Tyr1onX.github.io)"
MAX_IMAGE_BYTES = 5 * 1024 * 1024

TRACKS = [
    {
        "id": "sun-earth",
        "lookup_id": "1839368226",
        "country": "TW",
        "match": "太陽與地球",
        "listen_url": "https://music.apple.com/cn/album/heartbreakfast-%E5%82%B7%E5%BF%83%E6%97%A9%E9%A4%90%E5%BA%97/1839368226",
        "fallback": "demo-01/cover.webp",
    },
    {
        "id": "glass",
        "lookup_id": "6769327013",
        "country": "HK",
        "match": "玻璃",
        "listen_url": "https://music.apple.com/us/song/6769327013",
        "fallback": "demo-02/cover.webp",
    },
    {
        "id": "regular-friends",
        "lookup_id": "905206479",
        "country": "US",
        "match": "普通朋友",
        "listen_url": "https://music.apple.com/us/song/905206479",
        "fallback": "demo-03/cover.webp",
    },
    {
        "id": "who-do-you-love",
        "lookup_id": "905206660",
        "country": "TW",
        "match": "愛我還是他",
        "listen_url": "https://music.apple.com/us/song/905206660",
        "fallback": "demo-01/cover.webp",
    },
    {
        "id": "expose",
        "lookup_id": "1066174990",
        "country": "US",
        "match": "拆穿",
        "listen_url": "https://music.apple.com/us/song/1066174990",
        "fallback": "demo-02/cover.webp",
    },
    {
        "id": "no-compromise",
        "lookup_id": "1072339996",
        "country": "TW",
        "match": "不將就",
        "listen_url": "https://www.shazam.com/zh-tw/song/1072339996/%E4%B8%8D%E5%B0%86%E5%B0%B1-%E7%94%B5%E5%BD%B1%E4%BD%95%E4%BB%A5%E7%AC%99%E7%AE%AB%E9%BB%98%E7%89%87%E5%B0%BE%E6%9B%B2",
        "fallback": "demo-03/cover.webp",
    },
    {
        "id": "engraved-name",
        "lookup_id": "1528149434",
        "country": "TW",
        "match": "刻在我心底的名字",
        "listen_url": "https://music.apple.com/cn/album/%E5%88%BB%E5%9C%A8%E6%88%91%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E9%9B%BB%E5%BD%B1-%E5%88%BB%E5%9C%A8%E4%BD%A0%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E4%B8%BB%E9%A1%8C%E6%9B%B2-single/1528149434",
        "fallback": "demo-01/cover.webp",
    },
    {
        "id": "love-story-tv",
        "lookup_id": "1552791427",
        "country": "US",
        "match": "Love Story",
        "listen_url": "https://music.apple.com/us/song/1552791427",
        "fallback": "demo-02/cover.webp",
    },
    {
        "id": "kataomoi",
        "lookup_id": "1538259004",
        "country": "US",
        "match": "Kataomoi",
        "listen_url": "https://music.apple.com/us/song/1538259004",
        "fallback": "demo-03/cover.webp",
    },
    {
        "id": "anxiety",
        "lookup_id": "1800052074",
        "country": "US",
        "match": "Anxiety",
        "listen_url": "https://music.apple.com/us/song/1800052074",
        "fallback": "demo-01/cover.webp",
    },
    {
        "id": "tenderness",
        "lookup_id": "1078528644",
        "country": "US",
        "match": "溫柔",
        "listen_url": "https://music.apple.com/us/song/1078528644",
        "artwork_url": "https://coverartarchive.org/release/a0704b30-faf4-4909-b61d-7b1cd9a55575/front-500",
        "fallback": "demo-02/cover.webp",
    },
    {
        "id": "mermaid",
        "lookup_id": "1071753633",
        "country": "US",
        "match": "美人魚",
        "listen_url": "https://music.apple.com/us/song/1071753633",
        "fallback": "demo-03/cover.webp",
    },
]


def request_bytes(url: str, accept: str, attempts: int = 3) -> tuple[bytes, str]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
            with urlopen(request, timeout=25) as response:
                data = response.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise ValueError(f"remote asset is larger than {MAX_IMAGE_BYTES} bytes")
                return data, response.headers.get_content_type()
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1.0 + attempt)
    assert last_error is not None
    raise last_error


def normalize(value: str) -> str:
    return re.sub(r"[^0-9a-z\u3400-\u9fff\u3040-\u30ff]+", "", value.lower())


def lookup_track(spec: dict[str, str]) -> dict[str, object] | None:
    query = urlencode({"id": spec["lookup_id"], "country": spec["country"], "entity": "song", "limit": "50"})
    data, _ = request_bytes(f"https://itunes.apple.com/lookup?{query}", "application/json")
    payload = json.loads(data.decode("utf-8"))
    songs = [result for result in payload.get("results", []) if result.get("wrapperType") == "track" and result.get("kind") == "song"]
    if not songs:
        return None

    wanted = normalize(spec["match"])
    for song in songs:
        title = normalize(str(song.get("trackName", "")))
        if wanted and (wanted in title or title in wanted):
            return song
    return songs[0]


def enlarged_artwork_url(url: str) -> str:
    return re.sub(r"/\d+x\d+([^/?]+)(\?.*)?$", r"/600x600\1\2", url)


def write_embedded_svg(path: Path, image_bytes: bytes, mime: str) -> None:
    if not mime.startswith("image/"):
        raise ValueError(f"expected image content, got {mime}")
    encoded = base64.b64encode(image_bytes).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">\n'
        f'  <image width="600" height="600" preserveAspectRatio="xMidYMid slice" href="data:{mime};base64,{encoded}"/>\n'
        "</svg>\n"
    )
    path.write_text(svg, encoding="utf-8")


def fallback_bytes(relative_path: str) -> tuple[bytes, str]:
    path = ROOT / "assets" / "music" / relative_path
    return path.read_bytes(), "image/webp"


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    previews: dict[str, dict[str, str]] = {}
    downloaded = 0
    fallback_count = 0

    for spec in TRACKS:
        slug = spec["id"]
        song: dict[str, object] | None = None
        try:
            song = lookup_track(spec)
        except Exception as exc:
            print(f"warning: metadata lookup failed for {slug}: {exc}")

        preview_url = str(song.get("previewUrl", "")) if song else ""
        listen_url = str(song.get("trackViewUrl", "")) if song else ""
        previews[slug] = {"previewUrl": preview_url, "listenUrl": listen_url or spec["listen_url"], "provider": "Apple Music"}

        artwork_url = spec.get("artwork_url", "")
        if not artwork_url and song:
            artwork_url = enlarged_artwork_url(str(song.get("artworkUrl100", "")))

        try:
            if not artwork_url:
                raise ValueError("no artwork URL resolved")
            image_bytes, mime = request_bytes(artwork_url, "image/avif,image/webp,image/png,image/jpeg,image/*")
            downloaded += 1
        except Exception as exc:
            print(f"warning: artwork download failed for {slug}: {exc}; using local demo fallback")
            image_bytes, mime = fallback_bytes(spec["fallback"])
            fallback_count += 1

        write_embedded_svg(OUTPUT_DIR / f"{slug}.svg", image_bytes, mime)

    PREVIEW_FILE.write_text(json.dumps(previews, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    preview_count = sum(1 for item in previews.values() if item["previewUrl"])
    print(f"music assets ready: {downloaded}/{len(TRACKS)} remote covers, {fallback_count} fallbacks, {preview_count}/{len(TRACKS)} official previews")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
