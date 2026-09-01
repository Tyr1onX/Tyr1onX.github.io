#!/usr/bin/env python3
"""Generate local About-page profile statistics from GitHub and repository data."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "profile-stats.json"
LOGIN = "Tyr1onX"

QUERY = r"""
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER) {
      totalCount
      nodes { stargazerCount }
      pageInfo { hasNextPage }
    }
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount weekday }
        }
      }
    }
  }
}
""".strip()


def article_count() -> int:
    ids: set[str] = set()
    pattern = re.compile(r"(?:\bid\s*:\s*|\"id\"\s*:\s*)[\"']([^\"']+)[\"']")
    for filename in ("notes-data.js", "notes-2026.js"):
        text = (ROOT / filename).read_text(encoding="utf-8")
        ids.update(pattern.findall(text))
    return len(ids)


def run_graphql(from_iso: str, to_iso: str) -> dict:
    env = os.environ.copy()
    if env.get("GITHUB_TOKEN") and not env.get("GH_TOKEN"):
        env["GH_TOKEN"] = env["GITHUB_TOKEN"]

    command = [
        "gh", "api", "graphql",
        "-f", f"query={QUERY}",
        "-F", f"login={LOGIN}",
        "-f", f"from={from_iso}",
        "-f", f"to={to_iso}",
    ]
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(completed.stdout)


def build_payload() -> dict:
    now = datetime.now(timezone.utc)
    year = now.year
    from_iso = f"{year}-01-01T00:00:00Z"
    to_iso = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    response = run_graphql(from_iso, to_iso)
    user = response.get("data", {}).get("user")
    if not user:
        raise RuntimeError("GitHub GraphQL returned no user data")

    repositories = user["repositories"]
    if repositories.get("pageInfo", {}).get("hasNextPage"):
        raise RuntimeError("Repository count exceeded the 100-repository snapshot limit")

    calendar = user["contributionsCollection"]["contributionCalendar"]
    days = [
        {
            "date": day["date"],
            "count": int(day["contributionCount"]),
            "weekday": int(day["weekday"]),
        }
        for week in calendar["weeks"]
        for day in week["contributionDays"]
    ]

    return {
        "login": LOGIN,
        "generatedAt": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "period": {
            "year": year,
            "from": f"{year}-01-01",
            "to": now.date().isoformat(),
        },
        "metrics": {
            "articles": article_count(),
            "publicRepos": int(repositories["totalCount"]),
            "yearContributions": int(calendar["totalContributions"]),
            "totalStars": sum(int(repo["stargazerCount"]) for repo in repositories["nodes"]),
        },
        "contributions": days,
    }


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = build_payload()
    except Exception as error:
        if OUTPUT.exists():
            print(f"warning: profile stats refresh failed; keeping existing snapshot: {error}", file=sys.stderr)
            return 0
        raise

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    metrics = payload["metrics"]
    print(
        "profile stats updated: "
        f"articles={metrics['articles']} "
        f"repos={metrics['publicRepos']} "
        f"contributions={metrics['yearContributions']} "
        f"stars={metrics['totalStars']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
