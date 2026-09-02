#!/usr/bin/env python3
"""Build the unified Tyr1onX music library from recovered platform archives.

The raw archive is the evidence layer. This script performs conservative
normalisation/deduplication and can optionally resolve official Apple/iTunes
artwork + preview metadata. It never invents data for unresolved screenshot
slots and never downloads full song audio.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "music-archive-raw.json"
CACHE_FILE = ROOT / "music-artwork-cache.json"
LIBRARY_JS = ROOT / "music-library.js"
REPORT_FILE = ROOT / "music-library-report.json"
GENERATED_PREVIEWS = ROOT / "assets" / "music" / "generated-previews.json"
USER_AGENT = "Tyr1onX-MusicArchive/2.0 (+https://github.com/Tyr1onX/Tyr1onX.github.io)"

FEATURED = [
    {"id":"sun-earth","title":"太阳与地球","artist":"卢广仲","album":"HeartBreakFast 伤心早餐店","year":"2025","cover":"./assets/music/covers/sun-earth.svg","fallbackCover":"./assets/music/demo-01/cover.webp","accent":"#b94f67","listenUrl":"https://music.apple.com/cn/album/heartbreakfast-%E5%82%B7%E5%BF%83%E6%97%A9%E9%A4%90%E5%BA%97/1839368226"},
    {"id":"glass","title":"玻璃","artist":"Gareth.T","album":"玻璃 - Single","year":"2026","cover":"./assets/music/covers/glass.svg","fallbackCover":"./assets/music/demo-02/cover.webp","accent":"#6f7376","listenUrl":"https://music.apple.com/us/song/6769327013"},
    {"id":"regular-friends","title":"普通朋友","artist":"陶喆","album":"I'm O.K.","year":"1999","cover":"./assets/music/covers/regular-friends.svg","fallbackCover":"./assets/music/demo-03/cover.webp","accent":"#b89d20","listenUrl":"https://music.apple.com/us/song/905206479"},
    {"id":"who-do-you-love","title":"爱我还是他","artist":"陶喆","album":"太平盛世","year":"2005","cover":"./assets/music/covers/who-do-you-love.svg","fallbackCover":"./assets/music/demo-01/cover.webp","accent":"#9b553f","listenUrl":"https://music.apple.com/us/song/905206660"},
    {"id":"expose","title":"拆穿","artist":"小霞","album":"小霞","year":"2015","cover":"./assets/music/covers/expose.svg","fallbackCover":"./assets/music/demo-02/cover.webp","accent":"#8a8a86","listenUrl":"https://music.apple.com/us/song/1066174990"},
    {"id":"no-compromise","title":"不将就","artist":"李荣浩","album":"有理想","year":"2016","cover":"./assets/music/covers/no-compromise.svg","fallbackCover":"./assets/music/demo-03/cover.webp","accent":"#6c8390","listenUrl":"https://www.shazam.com/zh-tw/song/1072339996/%E4%B8%8D%E5%B0%86%E5%B0%B1-%E7%94%B5%E5%BD%B1%E4%BD%95%E4%BB%A5%E7%AC%99%E7%AE%AB%E9%BB%98%E7%89%87%E5%B0%BE%E6%9B%B2"},
    {"id":"engraved-name","title":"刻在我心底的名字","artist":"卢广仲","album":"刻在我心底的名字 - Single","year":"2020","cover":"./assets/music/covers/engraved-name.svg","fallbackCover":"./assets/music/demo-01/cover.webp","accent":"#546b91","listenUrl":"https://music.apple.com/cn/album/%E5%88%BB%E5%9C%A8%E6%88%91%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E9%9B%BB%E5%BD%B1-%E5%88%BB%E5%9C%A8%E4%BD%A0%E5%BF%83%E5%BA%95%E7%9A%84%E5%90%8D%E5%AD%97-%E4%B8%BB%E9%A1%8C%E6%9B%B2-single/1528149434"},
    {"id":"love-story-tv","title":"Love Story (Taylor’s Version)","artist":"Taylor Swift","album":"Fearless (Taylor’s Version)","year":"2021","cover":"./assets/music/covers/love-story-tv.svg","fallbackCover":"./assets/music/demo-02/cover.webp","accent":"#a77b4d","listenUrl":"https://music.apple.com/us/song/1552791427"},
    {"id":"kataomoi","title":"カタオモイ","artist":"Aimer","album":"daydream","year":"2016","cover":"./assets/music/covers/kataomoi.svg","fallbackCover":"./assets/music/demo-03/cover.webp","accent":"#7f9fae","listenUrl":"https://music.apple.com/us/song/1538259004"},
    {"id":"anxiety","title":"Anxiety","artist":"Doechii","album":"Anxiety - Single","year":"2025","cover":"./assets/music/covers/anxiety.svg","fallbackCover":"./assets/music/demo-01/cover.webp","accent":"#66686a","listenUrl":"https://music.apple.com/us/song/1800052074"},
    {"id":"tenderness","title":"温柔","artist":"五月天","album":"爱情万岁","year":"2000","cover":"./assets/music/covers/tenderness.svg","fallbackCover":"./assets/music/demo-02/cover.webp","accent":"#4a8196","listenUrl":"https://music.apple.com/us/song/1078528644"},
    {"id":"mermaid","title":"美人鱼","artist":"林俊杰","album":"第二天堂(江南)","year":"2004","cover":"./assets/music/covers/mermaid.svg","fallbackCover":"./assets/music/demo-03/cover.webp","accent":"#7c9295","listenUrl":"https://music.apple.com/us/song/1071753633"},
]

SOURCE_ORDER = {"qishui": 0, "netease": 1, "qq": 2}
VERSION_MARKERS = {
    "live": ("live", "演唱会", "现场", "ライブ"),
    "taylor": ("taylor's version", "taylor’s version", "taylors version"),
    "first-take": ("first take",),
    "anniversary": ("anniversary", "周年"),
    "2003": ("2003 version", "2003版"),
    "remix": ("remix", "mix版", "混音"),
    "dub": ("dub mix", "dub版"),
    "stripped": ("stripped",),
    "piano": ("钢琴", "piano"),
    "preview": ("试听版", "试听"),
    "natural": ("natural",),
    "explicit": ("explicit",),
    "pv": ("(pv)", " pv "),
}
NON_VERSION_HINTS = (
    "电影", "电视剧", "影视", "主题曲", "片尾曲", "插曲", "宣传曲", "游戏",
    "原声", "ost", "国语精选", "中国豪华特别版", "single", "ep",
)
ARTIST_ALIASES = {
    "gem邓紫棋": "邓紫棋",
    "gem鄧紫棋": "邓紫棋",
    "eric周兴哲": "周兴哲",
    "eric周興哲": "周兴哲",
    "菲菲公主陆绮菲": "陆绮菲",
    "陆绮菲菲菲公主": "陆绮菲",
    "mayday五月天": "五月天",
}
TITLE_EQUIVALENTS = {
    "太阳与地球sunearth": "太阳与地球",
    "太陽與地球sunearth": "太阳与地球",
    "普通朋友regularfriends": "普通朋友",
    "爱我还是他whodoyoulove": "爱我还是他",
    "愛我還是他whodoyoulove": "爱我还是他",
    "就是爱你lovecan": "就是爱你",
    "永不失联的爱unbreakablelove": "永不失联的爱",
    "怎么了whatswrong": "怎么了",
    "几分之几youcompleteme": "几分之几",
    "爱你loveyou": "爱你",
}


def nfkc(value: str) -> str:
    return unicodedata.normalize("NFKC", value or "").strip()


def compact(value: str) -> str:
    value = nfkc(value).lower().replace("’", "'")
    value = value.replace("·", "").replace("・", "")
    return re.sub(r"[^0-9a-z\u3400-\u9fff\u3040-\u30ff]+", "", value)


def title_version_markers(title: str, album: str = "") -> tuple[str, ...]:
    haystack = f" {nfkc(title).lower()} {nfkc(album).lower()} "
    markers = [name for name, needles in VERSION_MARKERS.items() if any(n in haystack for n in needles)]
    return tuple(sorted(set(markers)))


def strip_non_version_brackets(title: str) -> str:
    title = nfkc(title)

    def repl(match: re.Match[str]) -> str:
        text = match.group(1).strip()
        lower = text.lower()
        if any(any(n in lower for n in needles) for needles in VERSION_MARKERS.values()):
            return f" ({text})"
        if any(hint in lower for hint in NON_VERSION_HINTS):
            return ""
        # Parenthetical translations/aliases are frequently platform decoration.
        if len(text) <= 24:
            return ""
        return f" ({text})"

    return re.sub(r"[（(]([^（）()]*)[）)]", repl, title).strip()


def canonical_title(title: str) -> str:
    value = compact(strip_non_version_brackets(title))
    return TITLE_EQUIVALENTS.get(value, value)


def artist_parts(artist: str) -> list[str]:
    text = nfkc(artist).lower()
    text = re.sub(r"\s*(?:/|,|、|&| and | feat\.? | ft\.? )\s*", "|", text)
    result = []
    for part in text.split("|"):
        c = compact(part)
        if not c:
            continue
        c = ARTIST_ALIASES.get(c, c)
        if c not in result:
            result.append(c)
    return sorted(result)


def canonical_artist(artist: str) -> str:
    return "|".join(artist_parts(artist))


def dedupe_key(row: dict) -> str:
    if row.get("unresolved"):
        return f"unresolved:{row['source']}:{row.get('sourceOrder')}:{row['title']}"
    title = canonical_title(row.get("title", ""))
    artist = canonical_artist(row.get("artist", ""))
    version = ",".join(title_version_markers(row.get("title", ""), row.get("album", "")))
    return f"{title}::{artist}::{version}"


def pick_text(rows: list[dict], field: str) -> str:
    values = [nfkc(str(r.get(field, ""))) for r in rows if nfkc(str(r.get(field, "")))]
    if not values:
        return ""
    def score(value: str) -> tuple[int, int]:
        truncated = int(value.endswith("…") or value.endswith("...") or value.endswith(".."))
        return (-truncated, len(value))
    return max(values, key=score)


def featured_match(track: dict, featured: dict) -> bool:
    if track.get("unresolved"):
        return False
    if canonical_artist(track.get("artist", "")) != canonical_artist(featured["artist"]):
        return False
    if canonical_title(track.get("title", "")) != canonical_title(featured["title"]):
        return False
    track_markers = set(title_version_markers(track.get("title", ""), track.get("album", "")))
    featured_markers = set(title_version_markers(featured["title"], featured["album"]))
    return track_markers == featured_markers


def make_archive_id(index: int, track: dict) -> str:
    if track.get("unresolved"):
        return f"archive-unresolved-{index:03d}"
    digest = hashlib.sha1(dedupe_key(track).encode("utf-8")).hexdigest()[:8]
    return f"archive-{index:03d}-{digest}"


def artwork_url_600(url: str) -> str:
    if not url:
        return ""
    return re.sub(r"/\d+x\d+([^/?]*)(\?.*)?$", r"/600x600\1\2", url)


def request_json(url: str) -> dict:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def candidate_score(track: dict, song: dict) -> tuple[int, bool]:
    wanted_title = canonical_title(track.get("title", ""))
    got_title = canonical_title(str(song.get("trackName", "")))
    if not wanted_title or not got_title:
        return 0, False
    if wanted_title == got_title:
        title_score = 5
    elif wanted_title in got_title or got_title in wanted_title:
        title_score = 3
    else:
        return 0, False

    wanted_artists = set(artist_parts(track.get("artist", "")))
    got_artists = set(artist_parts(str(song.get("artistName", ""))))
    if wanted_artists and got_artists:
        overlap = wanted_artists & got_artists
        if not overlap:
            return 0, False
        artist_score = 4 if wanted_artists == got_artists else 3
    else:
        artist_score = 0

    wanted_versions = set(title_version_markers(track.get("title", ""), track.get("album", "")))
    got_versions = set(title_version_markers(str(song.get("trackName", "")), str(song.get("collectionName", ""))))
    important = {"live","taylor","first-take","anniversary","2003","remix","dub","stripped","piano","preview","natural"}
    if (wanted_versions & important) != (got_versions & important):
        return 0, False

    wanted_album = compact(track.get("album", ""))
    got_album = compact(str(song.get("collectionName", "")))
    album_score = 0
    if wanted_album and got_album:
        if wanted_album == got_album:
            album_score = 2
        elif wanted_album in got_album or got_album in wanted_album:
            album_score = 1
    return title_score + artist_score + album_score, True


def lookup_artwork(track: dict) -> dict:
    if track.get("unresolved") or not track.get("artist"):
        return {"status":"placeholder"}
    term = f"{track.get('title','')} {track.get('artist','')}"
    best: tuple[int, dict] | None = None
    second = 0
    for country in ("CN", "TW", "HK", "US"):
        query = urlencode({"term": term, "entity": "song", "limit": 20, "country": country})
        try:
            payload = request_json(f"https://itunes.apple.com/search?{query}")
        except Exception:
            continue
        for song in payload.get("results", []):
            score, valid = candidate_score(track, song)
            if not valid:
                continue
            if best is None or score > best[0]:
                if best is not None:
                    second = max(second, best[0])
                best = (score, song)
            else:
                second = max(second, score)
        if best and best[0] >= 9:
            break
    if not best or best[0] < 8:
        return {"status":"placeholder"}
    # Two similarly strong results are intentionally treated as ambiguous.
    if second >= best[0] - 1:
        return {"status":"ambiguous"}
    song = best[1]
    return {
        "status":"matched",
        "cover": artwork_url_600(str(song.get("artworkUrl100", ""))),
        "previewUrl": str(song.get("previewUrl", "")),
        "listenUrl": str(song.get("trackViewUrl", "")),
        "year": str(song.get("releaseDate", ""))[:4],
        "appleTrackId": song.get("trackId"),
    }


def build_library(raw: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for row in raw:
        key = dedupe_key(row)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(row)

    library = []
    for index, key in enumerate(order, start=1):
        rows = groups[key]
        first = rows[0]
        sources = sorted({r["source"] for r in rows}, key=lambda s: SOURCE_ORDER.get(s, 99))
        source_orders = {
            source: [r.get("sourceOrder") for r in rows if r["source"] == source and r.get("sourceOrder") is not None]
            for source in sources
        }
        track = {
            "id": make_archive_id(index, first),
            "title": pick_text(rows, "title"),
            "artist": pick_text(rows, "artist"),
            "album": pick_text(rows, "album"),
            "year": "",
            "cover": "",
            "fallbackCover": "",
            "sources": sources,
            "sourceOrders": source_orders,
            "featured": False,
            "featuredOrder": None,
            "listenUrl": "",
            "previewUrl": "",
            "accent": "#8a6f5b",
            "unresolved": any(bool(r.get("unresolved")) for r in rows),
            "rawCount": len(rows),
        }
        library.append(track)

    for order_index, featured in enumerate(FEATURED, start=1):
        matches = [track for track in library if featured_match(track, featured)]
        if len(matches) != 1:
            raise RuntimeError(f"featured match for {featured['id']} expected 1, got {len(matches)}")
        track = matches[0]
        track.update(featured)
        track["featured"] = True
        track["featuredOrder"] = order_index

    return library


def resolve_artwork(library: list[dict], workers: int = 10) -> dict[str, dict]:
    cache = {}
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    pending = [t for t in library if not t["featured"] and t["id"] not in cache]
    if pending:
        print(f"resolving artwork for {len(pending)} archive tracks...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            future_map = {pool.submit(lookup_artwork, track): track for track in pending}
            done = 0
            for future in concurrent.futures.as_completed(future_map):
                track = future_map[future]
                try:
                    cache[track["id"]] = future.result()
                except Exception as exc:
                    cache[track["id"]] = {"status":"placeholder", "error":str(exc)}
                done += 1
                if done % 25 == 0:
                    print(f"  {done}/{len(pending)}")
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return cache


def apply_cache(library: list[dict], cache: dict[str, dict]) -> None:
    for track in library:
        if track["featured"]:
            continue
        item = cache.get(track["id"], {})
        if item.get("status") == "matched":
            track["cover"] = item.get("cover", "")
            track["previewUrl"] = item.get("previewUrl", "")
            track["listenUrl"] = item.get("listenUrl", "")
            track["year"] = item.get("year", "")
        track["artworkStatus"] = item.get("status", "placeholder")
    for track in library:
        if track["featured"]:
            track["artworkStatus"] = "matched"


def write_outputs(raw: list[dict], library: list[dict]) -> dict:
    # Keep the evidence file deterministic/readable after recovery.
    RAW_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js = "window.TYR1ONX_MUSIC_LIBRARY = " + json.dumps(library, ensure_ascii=False, separators=(",", ":")) + ";\n"
    LIBRARY_JS.write_text(js, encoding="utf-8")
    generated_previews = {}
    if GENERATED_PREVIEWS.exists():
        try:
            generated_previews = json.loads(GENERATED_PREVIEWS.read_text(encoding="utf-8"))
        except Exception:
            generated_previews = {}
    preview_ids = {t["id"] for t in library if t.get("previewUrl")}
    preview_ids.update(track_id for track_id, item in generated_previews.items() if item.get("previewUrl"))

    report = {
        "raw": len(raw),
        "sources": {s: sum(1 for r in raw if r["source"] == s) for s in ("qishui","netease","qq")},
        "qqRecognized": sum(1 for r in raw if r["source"] == "qq" and not r.get("unresolved")),
        "qqUnresolved": sum(1 for r in raw if r["source"] == "qq" and r.get("unresolved")),
        "unique": len(library),
        "mergedDuplicates": len(raw) - len(library),
        "featured": sum(1 for t in library if t["featured"]),
        "artworkMatched": sum(1 for t in library if t.get("artworkStatus") == "matched"),
        "artworkPlaceholder": sum(1 for t in library if t.get("artworkStatus") == "placeholder"),
        "artworkAmbiguous": sum(1 for t in library if t.get("artworkStatus") == "ambiguous"),
        "previewAvailable": len(preview_ids),
    }
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def validate_raw(raw: list[dict]) -> None:
    if len(raw) != 394:
        raise RuntimeError(f"raw count must be 394, got {len(raw)}")
    expected = {"qishui":101, "netease":95, "qq":198}
    for source, count in expected.items():
        got = sum(1 for r in raw if r["source"] == source)
        if got != count:
            raise RuntimeError(f"{source} count must be {count}, got {got}")
    qq_unresolved = sum(1 for r in raw if r["source"] == "qq" and r.get("unresolved"))
    if qq_unresolved != 5:
        raise RuntimeError(f"QQ unresolved must be 5, got {qq_unresolved}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resolve-artwork", action="store_true")
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    validate_raw(raw)
    library = build_library(raw)
    cache = resolve_artwork(library, max(1, min(args.workers, 16))) if args.resolve_artwork else (
        json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
    )
    apply_cache(library, cache)
    report = write_outputs(raw, library)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
