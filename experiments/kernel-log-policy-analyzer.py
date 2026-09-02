#!/usr/bin/env python3
"""Read-only analyzer for BaiduYunKernel rolled logs.

The kernel log payload is byte-wise XOR encoded with 0x8A. This tool only reads
closed/available log files and skips the currently locked writer file.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import re
from pathlib import Path

XOR_KEY = 0x8A
TS_RE = re.compile(r"^\|(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+)")
SET_RE = re.compile(
    r"set sl\|cdn_sl=(-?\d+)\|total_sl=(-?\d+)\|src=enable_cms_total_sl\|"
    r"current_cdn_src=([^|]+)\|current_cdn_sl=(\d+)\|"
    r"current_total_src=([^|]+)\|current_total_sl=(\d+)"
)
COMPUTED_RE = re.compile(
    r"cms time\|cms_max_speed=(\d+)\|total_limit_enable=(\d+)\|total_max_speed=(\d+)\|"
)
RAW_RE = re.compile(r'"total_limit_enable":(\d+),"total_limit_speed":(\d+)')


def decode_log(path: Path) -> str:
    raw = path.read_bytes()
    return bytes(b ^ XOR_KEY for b in raw).decode("utf-8", "replace")


def parse_int(fields: dict[str, str], key: str):
    try:
        return int(fields[key])
    except (KeyError, TypeError, ValueError):
        return None


def parse_speed_source(value: str):
    if ":" not in value:
        return None, None
    source, raw = value.rsplit(":", 1)
    try:
        return source, int(raw)
    except ValueError:
        return source, None


def timestamp(line: str):
    m = TS_RE.match(line)
    return dt.datetime.fromisoformat(m.group(1)) if m else None


def analyze(directory: Path, long_threshold: int = 100, strict_threshold: int = 600):
    files = []
    skipped = []
    cms_events = []
    telemetry = []
    small_file_events = []

    for path in sorted(directory.glob("BaiduKernel_*.log")):
        try:
            text = decode_log(path)
        except (PermissionError, OSError) as exc:
            skipped.append({"file": path.name, "reason": str(exc)})
            continue
        files.append(path.name)
        last_raw = None
        last_set = None

        for line in text.splitlines():
            ts = timestamp(line)

            if "handle_p2sp_time_sharing_recv" in line and "total_limit_enable" in line:
                clean = line.replace("\\", "")
                m = RAW_RE.search(clean)
                if m:
                    last_raw = {
                        "timestamp": ts.isoformat() if ts else None,
                        "enable": int(m.group(1)),
                        "speed": int(m.group(2)),
                    }

            if "set sl|cdn_sl=-1|" in line and "src=enable_cms_total_sl" in line:
                m = SET_RE.search(line)
                if m:
                    last_set = {
                        "timestamp": ts.isoformat() if ts else None,
                        "incoming_cdn": int(m.group(1)),
                        "incoming_total": int(m.group(2)),
                        "current_cdn_source": m.group(3),
                        "current_cdn": int(m.group(4)),
                        "current_total_source": m.group(5),
                        "current_total": int(m.group(6)),
                    }

            if "cms time|cms_max_speed=" in line:
                m = COMPUTED_RE.search(line)
                if m:
                    cms_events.append({
                        "timestamp": ts.isoformat() if ts else None,
                        "file": path.name,
                        "raw": dict(last_raw) if last_raw else None,
                        "set_sl": dict(last_set) if last_set else None,
                        "computed_cms_max": int(m.group(1)),
                        "computed_enable": int(m.group(2)),
                        "computed_total_max": int(m.group(3)),
                    })

            if "small file download|" in line:
                small_file_events.append({
                    "timestamp": ts,
                    "file": path.name,
                })

            if "report_download_common:" in line and "total_speed_limit=enable_cms_total_sl:" in line:
                fields = {}
                for part in line.split("@#")[1:]:
                    if "=" in part:
                        k, v = part.split("=", 1)
                        fields[k] = v
                total_source, total = parse_speed_source(fields.get("total_speed_limit", ""))
                cdn_source, cdn = parse_speed_source(fields.get("cdn_speed_limit", ""))
                row = {
                    "timestamp": ts.isoformat() if ts else None,
                    "timestamp_obj": ts,
                    "file": path.name,
                    "duration": parse_int(fields, "duration"),
                    "download_flux": parse_int(fields, "download_flux"),
                    "average_speed": parse_int(fields, "average_speed"),
                    "current_speed": parse_int(fields, "current_speed"),
                    "sample_avg_speed": parse_int(fields, "sample_avg_speed"),
                    "total_source": total_source,
                    "total": total,
                    "cdn_source": cdn_source,
                    "cdn": cdn,
                    "current_task": parse_int(fields, "current_task"),
                    "file_size": parse_int(fields, "cur_task_file_size"),
                    "running_time_ms": parse_int(fields, "cur_task_running_time"),
                    "max_active_http": parse_int(fields, "cur_task_max_active_http"),
                    "speed_up_flag": parse_int(fields, "speed_up_flag"),
                    "limited_user": parse_int(fields, "limited_user"),
                }
                if ts:
                    row["near_small_file_fast_path"] = any(
                        e["file"] == path.name
                        and e["timestamp"]
                        and abs((ts - e["timestamp"]).total_seconds()) <= 10
                        for e in small_file_events[-20:]
                    )
                else:
                    row["near_small_file_fast_path"] = False
                telemetry.append(row)

    def group_telemetry(rows):
        result = {}
        for rate, group in sorted(collections.defaultdict(list, {
            k: [r for r in rows if r["total"] == k]
            for k in sorted({r["total"] for r in rows if r["total"] is not None})
        }).items()):
            long_rows = [r for r in group if (r["duration"] or 0) >= long_threshold and r["download_flux"] is not None]
            dur = sum(r["duration"] for r in long_rows)
            flux = sum(r["download_flux"] for r in long_rows)
            result[str(rate)] = {
                "records": len(group),
                "long_records": len(long_rows),
                "long_duration_s": dur,
                "long_flux_bytes": flux,
                "long_weighted_Bps": flux / dur if dur else None,
                "max_duration_s": max((r["duration"] or 0 for r in group), default=0),
            }
        return result

    strict_rows = [
        r for r in telemetry
        if r["total"] == 122880 and (r["duration"] or 0) >= strict_threshold
        and r["download_flux"] is not None and r["cdn"] is not None
    ]
    strict_by_cdn = {}
    for cdn in sorted({r["cdn"] for r in strict_rows}):
        group = [r for r in strict_rows if r["cdn"] == cdn]
        dur = sum(r["duration"] for r in group)
        flux = sum(r["download_flux"] for r in group)
        strict_by_cdn[str(cdn)] = {
            "records": len(group),
            "duration_s": dur,
            "flux_bytes": flux,
            "weighted_Bps": flux / dur if dur else None,
            "reported_average_min": min((r["average_speed"] for r in group if r["average_speed"] is not None), default=None),
            "reported_average_max": max((r["average_speed"] for r in group if r["average_speed"] is not None), default=None),
        }

    cms_pair_counts = collections.Counter()
    for e in cms_events:
        raw = e["raw"] or {}
        ss = e["set_sl"] or {}
        cms_pair_counts[(
            raw.get("enable"), raw.get("speed"), ss.get("current_cdn"),
            e["computed_total_max"], ss.get("incoming_total")
        )] += 1

    cms_matrix = [
        {
            "raw_enable": key[0], "raw_speed": key[1], "current_cdn": key[2],
            "computed_total_max": key[3], "submitted_total": key[4], "count": count,
        }
        for key, count in sorted(cms_pair_counts.items(), key=lambda kv: str(kv[0]))
    ]

    exceptional = []
    for r in telemetry:
        if r["total"] != 122880:
            clean = {k: v for k, v in r.items() if k != "timestamp_obj"}
            if r["total"] and r["average_speed"]:
                clean["average_over_total"] = r["average_speed"] / r["total"]
            exceptional.append(clean)

    return {
        "directory": str(directory),
        "xor_key": "0x8A",
        "files_scanned": len(files),
        "files_skipped": skipped,
        "cms_event_count": len(cms_events),
        "cms_compatibility_matrix": cms_matrix,
        "telemetry_count": len(telemetry),
        "telemetry_by_total": group_telemetry(telemetry),
        "strict_total_122880_by_cdn": strict_by_cdn,
        "non_122880_telemetry": exceptional,
    }


def print_human(result):
    print(f"xor_key={result['xor_key']} files_scanned={result['files_scanned']} skipped={len(result['files_skipped'])}")
    print(f"CMS_EVENTS={result['cms_event_count']}")
    for row in result["cms_compatibility_matrix"]:
        print(
            "CMS_MATRIX raw_enable={raw_enable} raw_speed={raw_speed} current_cdn={current_cdn} "
            "computed_total={computed_total_max} submitted_total={submitted_total} count={count}".format(**row)
        )
    print(f"TELEMETRY={result['telemetry_count']}")
    for rate, row in result["telemetry_by_total"].items():
        print(
            f"TOTAL rate={rate} records={row['records']} long={row['long_records']} "
            f"duration={row['long_duration_s']} weighted_Bps={row['long_weighted_Bps']} max_duration={row['max_duration_s']}"
        )
    for cdn, row in result["strict_total_122880_by_cdn"].items():
        print(
            f"STRICT_AB total=122880 cdn={cdn} records={row['records']} duration={row['duration_s']} "
            f"weighted_Bps={row['weighted_Bps']} avg_range={row['reported_average_min']}..{row['reported_average_max']}"
        )
    for row in result["non_122880_telemetry"]:
        print(
            f"EXCEPTION total={row['total']} duration={row['duration']} avg={row['average_speed']} "
            f"ratio={row.get('average_over_total')} file_size={row['file_size']} max_http={row['max_active_http']} "
            f"small_file_fast_path={row['near_small_file_fast_path']}"
        )
    for row in result["files_skipped"]:
        print(f"SKIPPED file={row['file']} reason={row['reason']}")


def main():
    default_dir = Path(os.environ.get("APPDATA", "")) / "BaiduYunKernel" / "Data"
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=default_dir)
    ap.add_argument("--long-threshold", type=int, default=100)
    ap.add_argument("--strict-threshold", type=int, default=600)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = analyze(args.dir, args.long_threshold, args.strict_threshold)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_human(result)


if __name__ == "__main__":
    main()
