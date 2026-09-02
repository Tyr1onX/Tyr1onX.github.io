#!/usr/bin/env python3
"""Deterministic regression checks for the generated Music Archive."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "music-archive-raw.json"
LIBRARY_FILE = ROOT / "music-library.js"
REPORT_FILE = ROOT / "music-library-report.json"
PREFIX = "window.TYR1ONX_MUSIC_LIBRARY = "


def load_library() -> list[dict]:
    source = LIBRARY_FILE.read_text(encoding="utf-8").strip()
    if not source.startswith(PREFIX) or not source.endswith(";"):
        raise AssertionError("music-library.js does not expose the expected global")
    return json.loads(source[len(PREFIX):-1])


def titles(library: list[dict], needle: str, artist: str) -> list[dict]:
    return [
        track for track in library
        if needle in track.get("title", "") and artist in track.get("artist", "")
    ]


def main() -> int:
    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    library = load_library()
    report = json.loads(REPORT_FILE.read_text(encoding="utf-8"))

    assert len(raw) == 394, len(raw)
    expected_sources = {"qishui": 101, "netease": 95, "qq": 198}
    actual_sources = {
        source: sum(1 for row in raw if row.get("source") == source)
        for source in expected_sources
    }
    assert actual_sources == expected_sources, actual_sources

    qq_recognized = sum(1 for row in raw if row.get("source") == "qq" and not row.get("unresolved"))
    qq_unresolved = sum(1 for row in raw if row.get("source") == "qq" and row.get("unresolved"))
    assert qq_recognized == 193, qq_recognized
    assert qq_unresolved == 5, qq_unresolved

    assert len(library) == report["unique"], (len(library), report["unique"])
    assert len(raw) - len(library) == report["mergedDuplicates"]
    assert len({track["id"] for track in library}) == len(library)
    assert sum(1 for track in library if track.get("unresolved")) == 5

    featured = sorted(
        (track for track in library if track.get("featured")),
        key=lambda track: track.get("featuredOrder") or 0,
    )
    assert len(featured) == 12
    assert [track.get("featuredOrder") for track in featured] == list(range(1, 13))

    regular_friends = titles(library, "普通朋友", "陶喆")
    assert any("Soul Power" in track.get("album", "") for track in regular_friends)
    assert any("I'm O.K." in track.get("album", "") for track in regular_friends)

    love_story = [track.get("title", "") for track in library if "Love Story" in track.get("title", "")]
    assert any("Taylor" in title for title in love_story)
    assert any("Taylor" not in title for title in love_story)

    kataomoi = [track.get("title", "") for track in library if "カタオモイ" in track.get("title", "")]
    assert any("FIRST TAKE" in title for title in kataomoi)
    assert any("Anniversary" in title for title in kataomoi)
    assert any(title == "カタオモイ" for title in kataomoi)

    tao_tian = titles(library, "天天", "陶喆")
    assert any("2003 Version" in track.get("title", "") for track in tao_tian)
    assert any("Soul Power" in track.get("album", "") for track in tao_tian)
    assert any(track.get("title") == "天天" and "I'm O.K." in track.get("album", "") for track in tao_tian)

    artwork_total = sum(report[key] for key in ("artworkMatched", "artworkPlaceholder", "artworkAmbiguous"))
    assert artwork_total == len(library), (artwork_total, len(library))

    print(
        "music archive ok:",
        f"raw={len(raw)}",
        f"unique={len(library)}",
        f"merged={len(raw) - len(library)}",
        f"featured={len(featured)}",
        f"qq_unresolved={qq_unresolved}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
