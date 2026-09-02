#!/usr/bin/env python3
"""Deterministic regression checks for the generated Music Archive."""
from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "music-archive-raw.json"
LIBRARY_FILE = ROOT / "music-library.js"
REPORT_FILE = ROOT / "music-library-report.json"
BUILDER_FILE = ROOT / "scripts" / "build-music-library.py"
PREFIX = "window.TYR1ONX_MUSIC_LIBRARY = "


def load_library() -> list[dict]:
    source = LIBRARY_FILE.read_text(encoding="utf-8").strip()
    if not source.startswith(PREFIX) or not source.endswith(";"):
        raise AssertionError("music-library.js does not expose the expected global")
    return json.loads(source[len(PREFIX):-1])


def load_builder():
    spec = importlib.util.spec_from_file_location("music_builder", BUILDER_FILE)
    if spec is None or spec.loader is None:
        raise AssertionError("cannot load music builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def raw_key(row: dict) -> tuple:
    return (
        row.get("source", ""), row.get("sourceOrder"), row.get("title", ""),
        row.get("artist", ""), row.get("album", ""), bool(row.get("unresolved")),
    )


def entry_key(entry: dict) -> tuple:
    return (
        entry.get("platform", ""), entry.get("sourceIndex"), entry.get("rawTitle", ""),
        entry.get("rawArtist", ""), entry.get("rawAlbum", ""), bool(entry.get("unresolved")),
    )


def main() -> int:
    builder = load_builder()
    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    library = load_library()
    report = json.loads(REPORT_FILE.read_text(encoding="utf-8"))

    assert len(raw) == 394, len(raw)
    expected_sources = {"qishui": 101, "netease": 95, "qq": 198}
    actual_sources = {source: sum(1 for row in raw if row.get("source") == source) for source in expected_sources}
    assert actual_sources == expected_sources, actual_sources
    assert sum(1 for row in raw if row.get("source") == "qq" and row.get("unresolved")) == 5
    assert sum(1 for row in raw if row.get("source") == "qq" and not row.get("unresolved")) == 193

    assert len(library) == report["unique"]
    assert report["beforeUnique"] == 333
    assert report["afterUnique"] == len(library)
    assert report["newlyMerged"] == 333 - len(library)
    assert report["mergedDuplicates"] == 394 - len(library)
    assert len({track["id"] for track in library}) == len(library)
    assert sum(1 for track in library if track.get("unresolved")) == 5

    # Canonical identity invariant: no duplicate normalizedTitle + normalizedArtist.
    identity_keys = []
    for track in library:
        if track.get("unresolved"):
            continue
        expected_title = builder.normalize_title(track.get("title", ""))
        expected_artist = builder.normalize_artist(track.get("artist", ""))
        assert track.get("normalizedTitle") == expected_title, (track.get("id"), track.get("normalizedTitle"), expected_title)
        assert track.get("normalizedArtist") == expected_artist, (track.get("id"), track.get("normalizedArtist"), expected_artist)
        identity_keys.append((track["normalizedTitle"], track["normalizedArtist"]))
    duplicates = [key for key, count in Counter(identity_keys).items() if count > 1]
    assert not duplicates, duplicates

    # Every RAW row is retained exactly once in sourceEntries.
    entries = [entry for track in library for entry in track.get("sourceEntries", [])]
    assert len(entries) == 394, len(entries)
    assert Counter(map(raw_key, raw)) == Counter(map(entry_key, entries))
    assert report["sourceEntries"] == 394

    featured = sorted((track for track in library if track.get("featured")), key=lambda track: track.get("featuredOrder") or 0)
    assert len(featured) == 12
    assert [track.get("featuredOrder") for track in featured] == list(range(1, 13))

    # Explicit regression examples requested by the aggressive merge policy.
    def by_identity(title: str, artist: str) -> list[dict]:
        key = (builder.normalize_title(title), builder.normalize_artist(artist))
        return [track for track in library if (track.get("normalizedTitle"), track.get("normalizedArtist")) == key]

    assert len(by_identity("Love Story", "Taylor Swift")) == 1
    assert len(by_identity("普通朋友", "陶喆")) == 1
    assert len(by_identity("天天", "陶喆")) == 1
    sun_earth = by_identity("太阳与地球", "卢广仲")
    assert len(sun_earth) == 1
    assert set(sun_earth[0].get("sources", [])) == {"qishui", "netease", "qq"}

    artwork_total = sum(report[key] for key in ("artworkMatched", "artworkPlaceholder", "artworkAmbiguous"))
    assert artwork_total == len(library), (artwork_total, len(library))
    assert sum(report.get("artworkSources", {}).values()) == len(library)

    print(
        "music archive ok:",
        f"raw={len(raw)}",
        f"unique={len(library)}",
        f"merged={len(raw) - len(library)}",
        f"featured={len(featured)}",
        "source_entries=394",
        "canonical_duplicate_keys=0",
        f"artwork_matched={report['artworkMatched']}",
        f"placeholder={report['artworkPlaceholder']}",
        f"ambiguous={report['artworkAmbiguous']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
