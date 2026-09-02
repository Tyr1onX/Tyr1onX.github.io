#!/usr/bin/env python3
"""Build the unified Tyr1onX music library from recovered platform archives.

The raw archive is the immutable evidence layer. Canonical Archive cards are
grouped aggressively by normalized song title + normalized full artist credit.
Official artwork is recovered from platform/catalog metadata without requiring
matching album/release/year, and unresolved screenshot slots are never invented.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "music-archive-raw.json"
CACHE_FILE = ROOT / "music-artwork-cache.json"
LIBRARY_JS = ROOT / "music-library.js"
REPORT_FILE = ROOT / "music-library-report.json"
REVIEW_FILE = ROOT / "music-dedupe-review-candidates.json"
GENERATED_PREVIEWS = ROOT / "assets" / "music" / "generated-previews.json"
USER_AGENT = "Tyr1onX-MusicArchive/2.1 (+https://github.com/Tyr1onX/Tyr1onX.github.io)"
LIBRARY_PREFIX = "window.TYR1ONX_MUSIC_LIBRARY = "

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

def nfkc(value: str) -> str:
    return unicodedata.normalize("NFKC", value or "").strip()


def compact(value: str) -> str:
    value = nfkc(value).casefold().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^0-9a-z\u3400-\u9fff\u3040-\u30ff]+", "", value)


def normalize_title(value: str) -> str:
    """Simple matching title normalization; no version taxonomy is used.

    Trailing parenthetical or spaced-dash qualifiers are treated as platform
    title decoration rather than separate Archive identities. This is generic
    cleanup, not Live/Remix/etc. classification.
    """
    text = nfkc(value).casefold().replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = re.sub(r"\s+", " ", text).strip()
    previous = None
    while text and text != previous:
        previous = text
        text = re.sub(r"\s*[（(][^()（）]*[）)]\s*$", "", text).strip()
    text = re.sub(r"\s+[-–—]\s+.+$", "", text).strip()
    text = re.sub(r"\s*([:;,!?/\\&+])\s*", r"\1", text)
    return text


def normalize_artist(value: str) -> str:
    """Normalize the complete artist credit and common separators."""
    text = nfkc(value).casefold().replace("’", "'").replace("‘", "'")
    text = re.sub(r"\s*(?:/|,|、|&|\band\b)\s*", "|", text, flags=re.I)
    parts: list[str] = []
    for part in text.split("|"):
        part = re.sub(r"\s+", "", part).strip()
        if part and part not in parts:
            parts.append(part)
    return "|".join(sorted(parts))


def canonical_title(title: str) -> str:
    return normalize_title(title)


def artist_tokens(artist: str) -> list[str]:
    normalized = normalize_artist(artist)
    return normalized.split("|") if normalized else []


def artist_parts(artist: str) -> list[str]:
    return artist_tokens(artist)


def primary_artist(artist: str) -> str:
    raw = nfkc(artist)
    first = re.split(r"\s*(?:/|,|、|&|\band\b)\s*", raw, maxsplit=1, flags=re.I)[0].strip()
    return normalize_artist(first)


def canonical_artist(artist: str) -> str:
    return normalize_artist(artist)


def dedupe_key(row: dict) -> str:
    """The only canonical identity rule: normalized title + normalized artist."""
    if row.get("unresolved"):
        return f"unresolved:{row['source']}:{row.get('sourceOrder')}:{row.get('title','')}"
    return f"{normalize_title(row.get('title', ''))}::{normalize_artist(row.get('artist', ''))}"

def row_ref(row: dict) -> tuple[str, int | None]:
    return row.get("source", ""), row.get("sourceOrder")


def same_song_identity(a: dict, b: dict) -> tuple[bool, str]:
    if a.get("unresolved") or b.get("unresolved"):
        return False, ""
    if dedupe_key(a) == dedupe_key(b):
        return True, "same normalized title + normalized artist"
    return False, ""

def make_groups(raw: list[dict]) -> tuple[list[list[dict]], list[dict]]:
    """Aggressive song-level grouping by normalized title + primary artist."""
    grouped: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    merge_events: list[dict] = []
    first_by_key: dict[str, dict] = {}
    for index, row in enumerate(raw):
        key = dedupe_key(row)
        grouped[key].append((index, row))
        first = first_by_key.get(key)
        if first is None:
            first_by_key[key] = row
        elif not row.get("unresolved"):
            merge_events.append({
                "candidateA": source_entry(first),
                "candidateB": source_entry(row),
                "reason": "same normalized title + normalized artist",
                "confidence": "direct-rule",
            })
    groups = [
        [row for _, row in sorted(items, key=lambda pair: pair[0])]
        for _, items in sorted(grouped.items(), key=lambda item: min(index for index, _ in item[1]))
    ]
    return groups, merge_events

def review_candidates(raw: list[dict], groups: list[list[dict]]) -> list[dict]:
    # The requested policy has one direct rule and no conservative review tier.
    return []

def pick_text(rows: list[dict], field: str) -> str:
    values = [nfkc(str(row.get(field, ""))) for row in rows if nfkc(str(row.get(field, "")))]
    if not values:
        return ""
    def score(value: str) -> tuple[int, int, int]:
        truncated = int(value.endswith("…") or value.endswith("...") or value.endswith(".."))
        decorated = int(bool(re.search(r"\s*[（(].*[）)]\s*$|\s+[-–—]\s+.+$", value)))
        return (truncated, decorated, len(value))
    return min(values, key=score)

def source_entry(row: dict) -> dict:
    return {
        "platform": row.get("source", ""),
        "rawTitle": row.get("title", ""),
        "rawArtist": row.get("artist", ""),
        "rawAlbum": row.get("album", ""),
        "sourceIndex": row.get("sourceOrder"),
        "confidence": row.get("confidence", ""),
        "unresolved": bool(row.get("unresolved")),
    }


def load_existing_library() -> list[dict]:
    if not LIBRARY_JS.exists():
        return []
    try:
        source = LIBRARY_JS.read_text(encoding="utf-8").strip()
        if source.startswith(LIBRARY_PREFIX) and source.endswith(";"):
            return json.loads(source[len(LIBRARY_PREFIX):-1])
    except Exception:
        pass
    return []


def existing_source_map(existing: list[dict]) -> dict[tuple[str, object], dict]:
    mapping: dict[tuple[str, object], dict] = {}
    for track in existing:
        if track.get("unresolved"):
            for platform in track.get("sources", []):
                mapping[(platform, f"unresolved:{track.get('title', '')}")] = track
        for platform, orders in track.get("sourceOrders", {}).items():
            for order in orders:
                if order is not None:
                    mapping[(platform, int(order))] = track
        for entry in track.get("sourceEntries", []):
            platform, order = entry.get("platform"), entry.get("sourceIndex")
            if platform and order is not None:
                mapping[(platform, int(order))] = track
    return mapping


def stable_id(rows: list[dict], old_by_source: dict[tuple[str, object], dict]) -> tuple[str, list[str]]:
    old_tracks: dict[str, dict] = {}
    for row in rows:
        order = row.get("sourceOrder")
        if order is None:
            old = old_by_source.get((row.get("source", ""), f"unresolved:{row.get('title', '')}"))
        else:
            old = old_by_source.get((row.get("source", ""), int(order)))
        if old and old.get("id"):
            old_tracks[old["id"]] = old
    if old_tracks:
        featured = [track for track in old_tracks.values() if track.get("featured")]
        if featured:
            chosen = sorted(featured, key=lambda track: track.get("featuredOrder") or 999)[0]["id"]
        else:
            def sort_key(track: dict) -> tuple[int, str]:
                match = re.match(r"archive-(\d+)", str(track.get("id", "")))
                return (int(match.group(1)) if match else 999999, str(track.get("id", "")))
            chosen = sorted(old_tracks.values(), key=sort_key)[0]["id"]
        return chosen, sorted(old_tracks)

    if any(row.get("unresolved") for row in rows):
        row = rows[0]
        digest = hashlib.sha1(f"{row.get('source', 'x')}|{row.get('title', '')}".encode("utf-8")).hexdigest()[:10]
        return f"archive-unresolved-{digest}", []
    seed = "|".join(sorted(dedupe_key(row) for row in rows))
    return f"archive-{hashlib.sha1(seed.encode('utf-8')).hexdigest()[:12]}", []


def featured_match(track: dict, featured: dict) -> bool:
    if track.get("unresolved"):
        return False
    return (
        track.get("normalizedTitle") == normalize_title(featured["title"])
        and track.get("normalizedArtist") == normalize_artist(featured["artist"])
    )

def artwork_url_600(url: str) -> str:
    if not url:
        return ""
    return re.sub(r"/\d+x\d+([^/?]*)(\?.*)?$", r"/600x600\1\2", url)


def request_json(url: str) -> dict:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def artist_credit_matches(wanted: str, candidate: str) -> bool:
    wanted_set = set(artist_parts(wanted))
    candidate_set = set(artist_parts(candidate))
    if not wanted_set or not candidate_set:
        return False
    return wanted_set == candidate_set or wanted_set < candidate_set or candidate_set < wanted_set


def metadata_identity_matches(track: dict, title: str, artist: str) -> bool:
    return (
        bool(track.get("normalizedTitle"))
        and track.get("normalizedTitle") == normalize_title(title)
        and artist_credit_matches(track.get("artist", ""), artist)
    )

def candidate_score(track: dict, song: dict) -> tuple[int, bool, dict]:
    title = str(song.get("trackName", ""))
    artist = str(song.get("artistName", ""))
    if not metadata_identity_matches(track, title, artist):
        return 0, False, {}
    wanted_album = compact(track.get("album", ""))
    got_album = compact(str(song.get("collectionName", "")))
    album_exact = bool(wanted_album and got_album and wanted_album == got_album)
    return 13 if album_exact else 10, True, {
        "titleExact": True,
        "artistExact": True,
        "albumExact": album_exact,
    }

def search_artist_name(track: dict) -> str:
    raw = nfkc(track.get("artist", ""))
    return re.split(r"\s*(?:/|,|、|&|\band\b)\s*", raw, maxsplit=1, flags=re.I)[0].strip()

def qq_candidate_score(track: dict, song: dict) -> tuple[int, bool, dict]:
    song_title = str(song.get("name") or song.get("title") or song.get("songname") or "")
    singer_list = song.get("singer", []) or []
    artist_text = " / ".join(str(artist.get("name", "")) for artist in singer_list if isinstance(artist, dict))
    if not metadata_identity_matches(track, song_title, artist_text):
        return 0, False, {}
    album_obj = song.get("album")
    got_album_name = str(album_obj.get("name", "")) if isinstance(album_obj, dict) else str(song.get("albumname", ""))
    wanted_album = compact(track.get("album", ""))
    got_album = compact(got_album_name)
    album_exact = bool(wanted_album and got_album and wanted_album == got_album)
    return 13 if album_exact else 10, True, {
        "albumExact": album_exact,
        "artistText": artist_text,
        "albumName": got_album_name,
        "songTitle": song_title,
    }

def lookup_qq(track: dict) -> dict:
    if track.get("unresolved") or not track.get("artist"):
        return {"status": "placeholder", "source": "qq"}
    query_text = f"{track.get('normalizedTitle') or track.get('title', '')} {search_artist_name(track)}"
    query = urlencode({"p": 1, "n": 20, "w": query_text, "format": "json"})
    req = Request(
        f"https://c.y.qq.com/soso/fcgi-bin/client_search_cp?{query}",
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://y.qq.com/", "Accept": "application/json"},
    )
    try:
        with urlopen(req, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return {"status": "placeholder", "source": "qq"}
    songs = ((((payload.get("data") or {}).get("song") or {}).get("list")) or [])
    ranked: list[tuple[int, dict, dict]] = []
    for song in songs:
        score, valid, details = qq_candidate_score(track, song)
        if valid:
            ranked.append((score, song, details))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked or ranked[0][0] < 10:
        return {"status": "placeholder", "source": "qq"}
    top_score, song, details = ranked[0]
    album_mid = str(song.get("albummid") or ((song.get("album") or {}).get("mid") if isinstance(song.get("album"), dict) else "") or "")
    if not album_mid:
        return {"status": "placeholder", "source": "qq"}
    cover = f"https://y.gtimg.cn/music/photo_new/T002R500x500M000{album_mid}.jpg"
    song_mid = str(song.get("songmid") or song.get("mid") or "")
    song_id = song.get("songid") or song.get("id")
    time_public = str(song.get("time_public", ""))
    year = time_public[:4] if re.match(r"^\d{4}", time_public) else ""
    if not year and isinstance(song.get("pubtime"), (int, float)) and song.get("pubtime"):
        from datetime import datetime, timezone
        year = str(datetime.fromtimestamp(float(song["pubtime"]), tz=timezone.utc).year)
    confidence = "exact" if details.get("albumExact") else "high"
    return {
        "status": "matched",
        "source": "qq",
        "confidence": confidence,
        "cover": cover,
        "previewUrl": "",
        "listenUrl": f"https://y.qq.com/n/ryqq/songDetail/{song_mid}" if song_mid else "",
        "year": year,
        "qqSongId": song_id,
        "qqSongMid": song_mid,
        "qqAlbumMid": album_mid,
        "matchedTitle": details.get("songTitle", ""),
        "matchedArtist": details.get("artistText", ""),
        "matchedAlbum": details.get("albumName", ""),
        "score": top_score,
    }

def netease_candidate_score(track: dict, song: dict) -> tuple[int, bool, dict]:
    song_title = str(song.get("name", ""))
    artist_text = " / ".join(str(artist.get("name", "")) for artist in song.get("artists", []) if isinstance(artist, dict))
    if not metadata_identity_matches(track, song_title, artist_text):
        return 0, False, {}
    album = song.get("album", {}) or {}
    got_album_name = str(album.get("name", ""))
    wanted_album = compact(track.get("album", ""))
    got_album = compact(got_album_name)
    album_exact = bool(wanted_album and got_album and wanted_album == got_album)
    return 13 if album_exact else 10, True, {
        "albumExact": album_exact,
        "artistText": artist_text,
        "albumName": got_album_name,
    }

def lookup_netease(track: dict) -> dict:
    if track.get("unresolved") or not track.get("artist"):
        return {"status": "placeholder", "source": "netease"}
    query_text = f"{track.get('normalizedTitle') or track.get('title', '')} {search_artist_name(track)}"
    query = urlencode({"s": query_text, "type": 1, "offset": 0, "total": "true", "limit": 15})
    req = Request(
        f"https://music.163.com/api/search/get/web?{query}",
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/", "Accept": "application/json"},
    )
    try:
        with urlopen(req, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return {"status": "placeholder", "source": "netease"}
    ranked: list[tuple[int, dict, dict]] = []
    for song in (payload.get("result", {}) or {}).get("songs", []) or []:
        score, valid, details = netease_candidate_score(track, song)
        if valid:
            ranked.append((score, song, details))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked or ranked[0][0] < 10:
        return {"status": "placeholder", "source": "netease"}
    top_score, song, details = ranked[0]
    song_id = song.get("id")
    cover = ""
    year = ""
    if song_id:
        detail_query = urlencode({"id": song_id, "ids": f"[{song_id}]"})
        detail_req = Request(
            f"https://music.163.com/api/song/detail/?{detail_query}",
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/", "Accept": "application/json"},
        )
        try:
            with urlopen(detail_req, timeout=12) as response:
                detail_payload = json.loads(response.read().decode("utf-8"))
            detailed = (detail_payload.get("songs", []) or [None])[0] or {}
            album = detailed.get("album", {}) or {}
            cover = str(album.get("picUrl") or album.get("blurPicUrl") or "")
            publish_ms = album.get("publishTime") or detailed.get("publishTime")
            if isinstance(publish_ms, (int, float)) and publish_ms > 0:
                from datetime import datetime, timezone
                year = str(datetime.fromtimestamp(publish_ms / 1000, tz=timezone.utc).year)
        except Exception:
            cover = ""
    if not cover:
        return {"status": "placeholder", "source": "netease"}
    confidence = "exact" if details.get("albumExact") else "high"
    return {
        "status": "matched",
        "source": "netease",
        "confidence": confidence,
        "cover": cover,
        "previewUrl": "",
        "listenUrl": f"https://music.163.com/#/song?id={song_id}" if song_id else "",
        "year": year,
        "neteaseSongId": song_id,
        "neteaseAlbumId": (song.get("album", {}) or {}).get("id"),
        "matchedTitle": str(song.get("name", "")),
        "matchedArtist": details.get("artistText", ""),
        "matchedAlbum": details.get("albumName", ""),
        "score": top_score,
    }

def lookup_itunes(track: dict) -> dict:
    if track.get("unresolved") or not track.get("artist"):
        return {"status": "placeholder", "source": "itunes"}

    terms = []
    for term in (
        f"{track.get('title','')} {track.get('artist','')}",
        f"{track.get('title','')} {track.get('artist','')}",
    ):
        term = re.sub(r"\s+", " ", term).strip()
        if term and term not in terms:
            terms.append(term)

    candidates: dict[int | str, tuple[int, dict, dict]] = {}
    for term in terms:
        for country in ("CN", "TW", "HK", "US", "JP", "SG"):
            query = urlencode({"term": term, "entity": "song", "limit": 30, "country": country})
            try:
                payload = request_json(f"https://itunes.apple.com/search?{query}")
            except Exception:
                continue
            for song in payload.get("results", []):
                score, valid, details = candidate_score(track, song)
                if not valid:
                    continue
                track_id = song.get("trackId") or f"{song.get('trackName')}|{song.get('artistName')}|{song.get('collectionName')}"
                prior = candidates.get(track_id)
                if prior is None or score > prior[0]:
                    candidates[track_id] = (score, song, details)
            if candidates and max(item[0] for item in candidates.values()) >= 13:
                break
        if candidates and max(item[0] for item in candidates.values()) >= 13:
            break

    ranked = sorted(candidates.values(), key=lambda item: item[0], reverse=True)
    if not ranked or ranked[0][0] < 10:
        return {"status": "placeholder", "source": "itunes"}

    top_score, song, details = ranked[0]
    confidence = "exact" if details.get("albumExact") else "high"
    return {
        "status": "matched",
        "source": "itunes",
        "confidence": confidence,
        "cover": artwork_url_600(str(song.get("artworkUrl100", ""))),
        "previewUrl": str(song.get("previewUrl", "")),
        "listenUrl": str(song.get("trackViewUrl", "")),
        "year": str(song.get("releaseDate", ""))[:4],
        "appleTrackId": song.get("trackId"),
        "matchedTitle": str(song.get("trackName", "")),
        "matchedArtist": str(song.get("artistName", "")),
        "matchedAlbum": str(song.get("collectionName", "")),
        "score": top_score,
    }


def lookup_musicbrainz(track: dict) -> dict:
    if track.get("unresolved") or not track.get("artist"):
        return {"status": "placeholder", "source": "musicbrainz"}
    title = track.get("normalizedTitle") or track.get("title", "")
    artist = search_artist_name(track)
    query_text = f'recording:"{title}" AND artist:"{artist}"'
    query = urlencode({"query": query_text, "fmt": "json", "limit": 10})
    try:
        payload = request_json(f"https://musicbrainz.org/ws/2/recording/?{query}")
    except Exception:
        return {"status": "placeholder", "source": "musicbrainz"}

    ranked: list[tuple[int, dict, str]] = []
    for recording in payload.get("recordings", []):
        credits = recording.get("artist-credit", []) or []
        credit_name = " / ".join(str(item.get("name", "")) for item in credits if isinstance(item, dict))
        if not metadata_identity_matches(track, str(recording.get("title", "")), credit_name):
            continue
        mb_score = int(recording.get("score") or 0)
        if mb_score < 85:
            continue
        ranked.append((mb_score, recording, credit_name))
    ranked.sort(key=lambda item: item[0], reverse=True)

    for mb_score, recording, credit_name in ranked[:5]:
        for release in (recording.get("releases", []) or [])[:12]:
            release_id = release.get("id")
            if not release_id:
                continue
            try:
                caa = request_json(f"https://coverartarchive.org/release/{release_id}")
            except Exception:
                continue
            images = caa.get("images", []) or []
            front = next((image for image in images if image.get("front")), images[0] if images else None)
            if not front:
                continue
            thumbnails = front.get("thumbnails", {}) or {}
            cover = thumbnails.get("500") or thumbnails.get("250") or front.get("image") or ""
            if not cover:
                continue
            return {
                "status": "matched",
                "source": "musicbrainz",
                "confidence": "high",
                "cover": cover,
                "previewUrl": "",
                "listenUrl": f"https://musicbrainz.org/release/{release_id}",
                "year": str(release.get("date", ""))[:4],
                "musicBrainzRecordingId": recording.get("id"),
                "musicBrainzReleaseId": release_id,
                "matchedTitle": str(recording.get("title", "")),
                "matchedArtist": credit_name,
                "matchedAlbum": str(release.get("title", "")),
                "score": mb_score,
            }
    return {"status": "placeholder", "source": "musicbrainz"}

def lookup_artwork(track: dict) -> dict:
    if track.get("unresolved"):
        return {"status": "placeholder", "source": "resolver"}
    attempts: list[dict] = []
    for resolver in (lookup_qq, lookup_netease, lookup_itunes, lookup_musicbrainz):
        result = resolver(track)
        attempts.append(result)
        if result.get("status") == "matched":
            return result
    ambiguous = next((item for item in attempts if item.get("status") == "ambiguous"), None)
    return ambiguous or {"status": "placeholder", "source": "resolver"}

def representative_row(rows: list[dict]) -> dict:
    def score(row: dict) -> tuple[int, int, int, int, int]:
        title = nfkc(row.get("title", ""))
        decorated = int(bool(re.search(r"\s*[（(].*[）)]\s*$|\s+[-–—]\s+.+$", title)))
        confidence_rank = {"high": 0, "medium": 1, "low": 2}.get(str(row.get("confidence", "")), 3)
        album_missing = 0 if nfkc(row.get("album", "")) else 1
        return (
            decorated,
            confidence_rank,
            album_missing,
            len(title),
            SOURCE_ORDER.get(row.get("source", ""), 99),
        )
    return min(rows, key=score)


def ensure_unique_ids(library: list[dict]) -> None:
    by_id: dict[str, list[dict]] = defaultdict(list)
    for track in library:
        by_id[str(track.get("id", ""))].append(track)
    used = {str(track.get("id", "")) for track in library}
    for old_id, tracks in by_id.items():
        if not old_id or len(tracks) <= 1:
            continue
        # Featured IDs win. Otherwise keep the richer surviving canonical group.
        tracks.sort(
            key=lambda track: (
                0 if track.get("featured") else 1,
                -int(track.get("rawCount") or 0),
                -len(track.get("sources", [])),
                str(track.get("normalizedTitle", "")),
                str(track.get("normalizedArtist", "")),
            )
        )
        for track in tracks[1:]:
            seed = f"{track.get('normalizedTitle','')}::{track.get('normalizedArtist','')}"
            digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
            candidate = f"archive-{digest[:12]}"
            width = 12
            while candidate in used:
                width += 2
                candidate = f"archive-{digest[:width]}"
            if old_id not in track.get("_legacyIds", []):
                track.setdefault("_legacyIds", []).append(old_id)
            track["id"] = candidate
            used.add(candidate)


def build_library(raw: list[dict], existing: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    groups, merge_events = make_groups(raw)
    old_by_source = existing_source_map(existing)
    library: list[dict] = []

    for rows in groups:
        sources = sorted({row["source"] for row in rows}, key=lambda source: SOURCE_ORDER.get(source, 99))
        source_orders = {
            source: [row.get("sourceOrder") for row in rows if row["source"] == source and row.get("sourceOrder") is not None]
            for source in sources
        }
        track_id, legacy_ids = stable_id(rows, old_by_source)
        representative = representative_row(rows)
        display_title = pick_text(rows, "title")
        display_artist = pick_text(rows, "artist")
        # Prefer the representative row for album because it is the cleanest
        # existing source record; matched official metadata may replace it later.
        display_album = nfkc(representative.get("album", "")) or pick_text(rows, "album")
        normalized_title = normalize_title(representative.get("title", "")) if not representative.get("unresolved") else ""
        normalized_artist = normalize_artist(representative.get("artist", "")) if not representative.get("unresolved") else ""

        track = {
            "id": track_id,
            "title": display_title,
            "normalizedTitle": normalized_title,
            "artist": display_artist,
            "normalizedArtist": normalized_artist,
            "artistAliases": sorted({nfkc(row.get("artist", "")) for row in rows if nfkc(row.get("artist", ""))}),
            "album": display_album,
            "year": "",
            "cover": "",
            "fallbackCover": "",
            "sources": sources,
            "sourceOrders": source_orders,
            "sourceEntries": [source_entry(row) for row in rows],
            "featured": False,
            "featuredOrder": None,
            "listenUrl": "",
            "previewUrl": "",
            "accent": "#8a6f5b",
            "unresolved": any(bool(row.get("unresolved")) for row in rows),
            "rawCount": len(rows),
            "_legacyIds": legacy_ids,
        }
        library.append(track)

    for order_index, featured in enumerate(FEATURED, start=1):
        matches = [track for track in library if featured_match(track, featured)]
        if len(matches) != 1:
            raise RuntimeError(f"featured match for {featured['id']} expected 1, got {len(matches)}")
        track = matches[0]
        preserved = {
            key: track[key]
            for key in (
                "normalizedTitle", "normalizedArtist", "artistAliases",
                "sources", "sourceOrders", "sourceEntries", "unresolved", "rawCount", "_legacyIds",
            )
        }
        track.update(featured)
        track.update(preserved)
        track["featured"] = True
        track["featuredOrder"] = order_index

    ensure_unique_ids(library)
    reviews = review_candidates(raw, groups)
    return library, merge_events, reviews

def cached_identity_matches(track: dict, item: dict) -> bool:
    if item.get("status") != "matched":
        return True
    title = str(item.get("matchedTitle", ""))
    artist = str(item.get("matchedArtist", ""))
    if not title or not artist:
        return False
    return metadata_identity_matches(track, title, artist)


def migrate_cache(cache: dict[str, dict], library: list[dict]) -> dict[str, dict]:
    status_rank = {"matched": 3, "ambiguous": 2, "placeholder": 1}
    source_rank = {"qq": 6, "netease": 5, "qishui": 4, "itunes": 3, "musicbrainz": 2, "featured": 7}
    migrated: dict[str, dict] = {}
    for track in library:
        candidate_ids = [track["id"]] + list(track.get("_legacyIds", []))
        candidates = [cache.get(old_id) for old_id in candidate_ids]
        candidates = [item for item in candidates if isinstance(item, dict) and cached_identity_matches(track, item)]
        if not candidates:
            continue
        chosen = dict(max(
            candidates,
            key=lambda item: (
                status_rank.get(item.get("status", ""), 0),
                source_rank.get(item.get("source", ""), 0),
            ),
        ))
        status = chosen.get("status", "placeholder")
        if not chosen.get("source"):
            chosen["source"] = "itunes" if chosen.get("appleTrackId") or status == "ambiguous" else "placeholder"
        if not chosen.get("confidence"):
            chosen["confidence"] = "high" if status == "matched" else ("ambiguous" if status == "ambiguous" else "none")
        migrated[track["id"]] = chosen
    return migrated

def resolve_artwork(library: list[dict], workers: int = 10, refresh: bool = False) -> dict[str, dict]:
    cache: dict[str, dict] = {}
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            cache = {}
    cache = migrate_cache(cache, library)

    pending = []
    for track in library:
        status = cache.get(track["id"], {}).get("status")
        if track["id"] not in cache or (refresh and status != "matched"):
            pending.append(track)
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
                    cache[track["id"]] = {"status": "placeholder", "source": "resolver", "error": str(exc)}
                done += 1
                if done % 10 == 0:
                    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                if done % 25 == 0 or done == len(pending):
                    print(f"  {done}/{len(pending)}")
    valid_ids = {track["id"] for track in library}
    cache = {track_id: item for track_id, item in cache.items() if track_id in valid_ids}
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return cache


def apply_cache(library: list[dict], cache: dict[str, dict]) -> None:
    for track in library:
        item = cache.get(track["id"], {})
        status = item.get("status", "placeholder")
        if status == "matched":
            track["cover"] = item.get("cover", "")
            track["previewUrl"] = item.get("previewUrl", "") or track.get("previewUrl", "")
            track["listenUrl"] = item.get("listenUrl", "") or track.get("listenUrl", "")
            track["year"] = item.get("year", "")
            if item.get("matchedAlbum"):
                track["album"] = item["matchedAlbum"]
        track["artworkStatus"] = status
        track["artworkMatch"] = {
            "source": item.get("source", "placeholder" if status == "placeholder" else "unknown"),
            "confidence": item.get("confidence", status if status == "ambiguous" else "none"),
            "matchedTitle": item.get("matchedTitle", ""),
            "matchedArtist": item.get("matchedArtist", ""),
            "matchedAlbum": item.get("matchedAlbum", ""),
        }


def baseline_report() -> dict:
    if not REPORT_FILE.exists():
        return {}
    try:
        return json.loads(REPORT_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def source_combo_stats(library: list[dict]) -> dict[str, int]:
    wanted = {
        frozenset(("qq", "netease")): "qq+netease",
        frozenset(("qq", "qishui")): "qq+qishui",
        frozenset(("netease", "qishui")): "netease+qishui",
        frozenset(("qq", "netease", "qishui")): "qq+netease+qishui",
    }
    counts = {label: 0 for label in wanted.values()}
    for track in library:
        key = frozenset(track.get("sources", []))
        if key in wanted:
            counts[wanted[key]] += 1
    return counts


def write_outputs(
    raw: list[dict],
    library: list[dict],
    merge_events: list[dict],
    reviews: list[dict],
    before: dict,
) -> dict:
    # RAW is deliberately not rewritten: it remains the immutable evidence layer.
    clean_library = []
    for track in library:
        item = dict(track)
        item.pop("_legacyIds", None)
        clean_library.append(item)
    js = LIBRARY_PREFIX + json.dumps(clean_library, ensure_ascii=False, separators=(",", ":")) + ";\n"
    LIBRARY_JS.write_text(js, encoding="utf-8")
    REVIEW_FILE.write_text(json.dumps(reviews, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    generated_previews = {}
    if GENERATED_PREVIEWS.exists():
        try:
            generated_previews = json.loads(GENERATED_PREVIEWS.read_text(encoding="utf-8"))
        except Exception:
            generated_previews = {}
    preview_ids = {track["id"] for track in clean_library if track.get("previewUrl")}
    preview_ids.update(track_id for track_id, item in generated_previews.items() if item.get("previewUrl"))

    before_unique = int(before.get("beforeUnique", before.get("unique", 333)))
    before_art = before.get("artworkBefore") or {
        "matched": int(before.get("artworkMatched", 52)),
        "placeholder": int(before.get("artworkPlaceholder", 260)),
        "ambiguous": int(before.get("artworkAmbiguous", 21)),
    }
    artwork_after = {
        "matched": sum(1 for track in clean_library if track.get("artworkStatus") == "matched"),
        "placeholder": sum(1 for track in clean_library if track.get("artworkStatus") == "placeholder"),
        "ambiguous": sum(1 for track in clean_library if track.get("artworkStatus") == "ambiguous"),
    }
    artwork_sources = Counter(
        (track.get("artworkMatch") or {}).get("source", "unknown")
        for track in clean_library
    )
    report = {
        "raw": len(raw),
        "sources": {source: sum(1 for row in raw if row["source"] == source) for source in ("qishui", "netease", "qq")},
        "qqRecognized": sum(1 for row in raw if row["source"] == "qq" and not row.get("unresolved")),
        "qqUnresolved": sum(1 for row in raw if row["source"] == "qq" and row.get("unresolved")),
        "beforeUnique": before_unique,
        "afterUnique": len(clean_library),
        "unique": len(clean_library),
        "newlyMerged": before_unique - len(clean_library),
        "mergedDuplicates": len(raw) - len(clean_library),
        "crossPlatformGroups": source_combo_stats(clean_library),
        "highConfidenceMergeEvents": len(merge_events),
        "reviewCandidates": len(reviews),
        "featured": sum(1 for track in clean_library if track["featured"]),
        "sourceEntries": sum(len(track.get("sourceEntries", [])) for track in clean_library),
        "artworkBefore": before_art,
        "artworkAfter": artwork_after,
        "artworkMatched": artwork_after["matched"],
        "artworkPlaceholder": artwork_after["placeholder"],
        "artworkAmbiguous": artwork_after["ambiguous"],
        "artworkSources": dict(sorted(artwork_sources.items())),
        "previewAvailable": len(preview_ids),
        "mergeEvents": merge_events,
    }
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def validate_raw(raw: list[dict]) -> None:
    if len(raw) != 394:
        raise RuntimeError(f"raw count must be 394, got {len(raw)}")
    expected = {"qishui": 101, "netease": 95, "qq": 198}
    for source, count in expected.items():
        got = sum(1 for row in raw if row["source"] == source)
        if got != count:
            raise RuntimeError(f"{source} count must be {count}, got {got}")
    qq_unresolved = sum(1 for row in raw if row["source"] == "qq" and row.get("unresolved"))
    if qq_unresolved != 5:
        raise RuntimeError(f"QQ unresolved must be 5, got {qq_unresolved}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resolve-artwork", action="store_true")
    parser.add_argument("--refresh-artwork", action="store_true", help="retry cached placeholder/ambiguous artwork")
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    validate_raw(raw)
    before = baseline_report()
    existing = load_existing_library()
    library, merge_events, reviews = build_library(raw, existing)

    if args.resolve_artwork or args.refresh_artwork:
        cache = resolve_artwork(
            library,
            max(1, min(args.workers, 16)),
            refresh=bool(args.refresh_artwork),
        )
    else:
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
        except Exception:
            cache = {}
        cache = migrate_cache(cache, library)
    apply_cache(library, cache)
    report = write_outputs(raw, library, merge_events, reviews, before)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
