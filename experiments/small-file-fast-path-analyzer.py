#!/usr/bin/env python3
"""Read-only analysis of locatedownload fsl and the legacy small-file branch.

This consumes only already-rolled BaiduYunKernel logs. It does not create tasks,
change policy values, or touch the active writer file.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import os
import re
import statistics
from pathlib import Path

XOR_KEY = 0x8A
SMALL_FILE_LIMIT = 0x1400000       # recovered from kernel.dll .234
SMALL_FILE_GRANULARITY = 0x80000   # 512 KiB
TS_RE = re.compile(r"^\|(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+)")


def decode(path: Path) -> str:
    raw = path.read_bytes()
    return bytes(b ^ XOR_KEY for b in raw).decode("utf-8", "replace")


def ts(line: str):
    m = TS_RE.match(line)
    return dt.datetime.fromisoformat(m.group(1)) if m else None


def analyze(directory: Path):
    tasks: dict[tuple[str, int], dict] = {}
    responses = []
    skipped = []

    def task(file: str, handle: int):
        return tasks.setdefault((file, handle), {
            "file": file,
            "handle": handle,
            "size": None,
            "start": None,
            "finish": None,
            "sl": None,
            "fsl": None,
            "small_events": [],
            "peer_objects": 0,
            "peer_flow": 0,
            "peer_token_calls": 0,
            "max_peer_live_ms": None,
        })

    files = 0
    for path in sorted(directory.glob("BaiduKernel_*.log")):
        try:
            lines = decode(path).splitlines()
        except (PermissionError, OSError) as exc:
            skipped.append((path.name, str(exc)))
            continue
        files += 1

        for line in lines:
            when = ts(line)

            m = re.search(r"set_download_param:1863 task_handle=(\d+)\|file_size=(\d+)", line)
            if m:
                t = task(path.name, int(m.group(1)))
                t["size"] = int(m.group(2))

            m = re.search(r"start task\|.*?task_handle=(\d+)\|fsize=(\d+)", line)
            if m:
                t = task(path.name, int(m.group(1)))
                t["size"] = t["size"] if t["size"] is not None else int(m.group(2))
                t["start"] = when

            m = re.search(r"download finish\|.*?task_handle=(\d+)\|", line)
            if m:
                task(path.name, int(m.group(1)))["finish"] = when

            m = re.search(
                r"cdn_urls_finish\|.*?handle=(\d+)\|.*?sl=(-?\d+)\|.*?fsl=(-?\d+)", line
            )
            if m:
                handle, sl, fsl = map(int, m.groups())
                t = task(path.name, handle)
                t["sl"] = sl
                t["fsl"] = fsl
                responses.append({"file": path.name, "handle": handle, "sl": sl, "fsl": fsl})

            m = re.search(
                r"small file download\|task_handle=(\d+)\|http_count=(\d+)\|target_cdn_count=(\d+)", line
            )
            if m:
                handle, current, target = map(int, m.groups())
                task(path.name, handle)["small_events"].append({
                    "timestamp": when,
                    "http_count": current,
                    "target": target,
                })

            if "~PeerData:90" in line:
                mh = re.search(r"task_handle=(\d+)", line)
                if mh:
                    t = task(path.name, int(mh.group(1)))
                    t["peer_objects"] += 1
                    mf = re.search(r"download_flow=(\d+)", line)
                    mt = re.search(r"get_download_token_total_ct=(\d+)", line)
                    ml = re.search(r"live time=(\d+)", line)
                    if mf:
                        t["peer_flow"] += int(mf.group(1))
                    if mt:
                        t["peer_token_calls"] += int(mt.group(1))
                    if ml:
                        live = int(ml.group(1))
                        t["max_peer_live_ms"] = max(t["max_peer_live_ms"] or 0, live)

    paired = [tasks[(r["file"], r["handle"])] for r in responses]
    pair_counts = collections.Counter((t["sl"], t["fsl"]) for t in paired)

    normal_sizes = [t["size"] for t in paired if t["fsl"] != 0 and t["size"] is not None]
    special = [t for t in paired if t["fsl"] == 0]

    print(f"xor_key=0x{XOR_KEY:02X} files_scanned={files} skipped={len(skipped)}")
    print("LD_FSL_PAIRS " + " ".join(
        f"sl={sl},fsl={fsl}:count={count}" for (sl, fsl), count in sorted(pair_counts.items())
    ))
    if normal_sizes:
        print(
            "NORMAL_FSL_NONZERO "
            f"known_sizes={len(normal_sizes)} min={min(normal_sizes)} median={int(statistics.median(normal_sizes))} "
            f"max={max(normal_sizes)} le_20MiB={sum(s <= SMALL_FILE_LIMIT for s in normal_sizes)}"
        )

    for t in special:
        size = t["size"]
        candidate = (size // SMALL_FILE_GRANULARITY + 1) if size is not None and size <= SMALL_FILE_LIMIT else None
        targets = sorted({e["target"] for e in t["small_events"]})
        elapsed = (t["finish"] - t["start"]).total_seconds() if t["start"] and t["finish"] else None
        print(
            f"FSL0 file={t['file']} handle={t['handle']} size={size} sl={t['sl']} "
            f"candidate_before_cap={candidate} observed_targets={targets} "
            f"peer_objects={t['peer_objects']} peer_flow={t['peer_flow']} "
            f"peer_token_calls={t['peer_token_calls']} max_peer_live_ms={t['max_peer_live_ms']} "
            f"task_elapsed_s={elapsed}"
        )

    print(
        f"STATIC_SMALL_BRANCH limit={SMALL_FILE_LIMIT} granularity={SMALL_FILE_GRANULARITY} "
        "candidate=floor(size/524288)+1_then_min_with_global_cap"
    )
    for name, reason in skipped:
        print(f"SKIPPED file={name} reason={reason}")


if __name__ == "__main__":
    default_dir = Path(os.environ.get("APPDATA", "")) / "BaiduYunKernel" / "Data"
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=default_dir)
    args = ap.parse_args()
    analyze(args.dir)
