#!/usr/bin/env python3
"""Sync the public Bangumi collection into js/data.js.

Run from the repository root:
    python scripts/update_bangumi.py
    python scripts/update_bangumi.py --dry-run

Optional environment:
    HTTPS_PROXY=http://127.0.0.1:7897   (needed on some networks)
"""

from __future__ import annotations

import argparse
import html
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "js" / "data.js"
COVERS = ROOT / "assets" / "covers"
USER_ID = "1242442"
API = "https://api.bgm.tv/v0"
PROFILE = f"https://bangumi.tv/user/{USER_ID}"
UA = f"AquamarineAnimeNotebook/1.0 (+{PROFILE})"
JST = timezone(timedelta(hours=8))


def _opener(verify=True):
    handlers = []
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    ctx = ssl.create_default_context() if verify else ssl._create_unverified_context()
    handlers.append(urllib.request.HTTPSHandler(context=ctx))
    opener = urllib.request.build_opener(*handlers)
    opener.addheaders = [("User-Agent", UA), ("Referer", "https://bangumi.tv/")]
    return opener


VERIFIED = _opener(True)
UNVERIFIED = _opener(False)


def get_bytes(url: str, retries: int = 4, timeout: int = 50) -> bytes:
    last = None
    for attempt in range(retries):
        for opener in (VERIFIED, UNVERIFIED):
            try:
                with opener.open(urllib.request.Request(url), timeout=timeout) as response:
                    return response.read()
            except ssl.SSLError as exc:
                last = exc
            except Exception as exc:  # network hiccups are common
                last = exc
        time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f"GET failed: {url} ({last})")


def get_json(url: str, retries: int = 4) -> dict:
    raw = get_bytes(url, retries=retries)
    return json.loads(raw.decode("utf-8"))


def get_text(url: str) -> str:
    return get_bytes(url).decode("utf-8", "replace")


def clean(value, limit=None):
    if not value:
        return ""
    value = html.unescape(re.sub(r"<[^>]+>", " ", str(value)))
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit] if limit else value


def strip_html(value: str) -> str:
    value = re.sub(r"<script.*?</script>|<style.*?</style>", " ", value, flags=re.S | re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def compute_cats(tags):
    tags = set(tags)
    cats = []
    if tags & {"京阿尼", "京都动画", "京都アニメーション", "Kyoto Animation"}:
        cats.append("kyoani")
    if tags & {"治愈", "治愈系", "治癒"}:
        cats.append("healing")
    if "百合" in tags:
        cats.append("yuri")
    if tags & {"轻百合", "轻百"}:
        cats.append("lightyuri")
    if "日常" in tags:
        cats.append("nichijou")
    if "芳文社" in tags:
        cats.append("houbunsha")
    if tags & {"Fate", "Type-Moon", "型月"}:
        cats.append("fate")
    if tags & {"水星领航员", "ARIA"}:
        cats.append("aria")
    if tags & {"剧场版", "动画电影", "电影"}:
        cats.append("movie")
    return cats


def ensure_cover(subject: dict, dry_run=False) -> str:
    sid = subject["id"]
    path = COVERS / f"{sid}.webp"
    rel = f"assets/covers/{sid}.webp"
    if path.exists() and path.stat().st_size > 5000:
        return rel
    if dry_run:
        print(f"  ! missing cover: {sid} {subject.get('name_cn') or subject.get('name')}")
        return rel
    images = subject.get("images") or {}
    url = images.get("large") or images.get("medium") or images.get("common")
    if not url:
        print(f"  ! no cover URL: {sid}")
        return rel
    try:
        raw = get_bytes(url, timeout=70)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        if image.height > 640:
            image = image.resize((round(image.width * 640 / image.height), 640), Image.LANCZOS)
        COVERS.mkdir(parents=True, exist_ok=True)
        image.save(path, format="WEBP", quality=82, method=6)
        print(f"  + cover {sid} {image.size[0]}x{image.size[1]}")
    except Exception as exc:
        print(f"  ! cover failed: {sid} ({exc})")
    return rel


def fetch_collections():
    items = []
    offset = 0
    total = None
    while True:
        url = f"{API}/users/{USER_ID}/collections?subject_type=2&limit=50&offset={offset}"
        payload = get_json(url)
        chunk = payload.get("data", [])
        total = payload.get("total", len(items) + len(chunk))
        items.extend(chunk)
        print(f"  collections {len(items)}/{total}")
        if not chunk or len(items) >= total:
            break
        offset += len(chunk)
    return items


def overall_totals(fallback):
    try:
        text = strip_html(get_text(PROFILE))
        match = re.search(
            r"(\d+)收藏\s*(\d+)完成\s*([\d.]+)%完成率\s*([\d.]+)平均分\s*([\d.]+)标准差\s*(\d+)评分数",
            text,
        )
        if match:
            return {
                "all": int(match.group(1)),
                "completed": int(match.group(2)),
                "rate": float(match.group(3)),
                "avg": float(match.group(4)),
                "sd": float(match.group(5)),
                "rated": int(match.group(6)),
            }
    except Exception as exc:
        print(f"  ! profile stats failed: {exc}")
    return fallback


def average_color(path: Path):
    try:
        im = Image.open(path).convert("RGB").resize((1, 1), Image.LANCZOS)
        r, g, b = im.getpixel((0, 0))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Reading current data...")
    text = DATA_FILE.read_text(encoding="utf-8")
    payload = json.loads(text.split("window.AQUAMARINE = ", 1)[1].rstrip().rstrip(";").strip())
    old_items = {int(item["id"]): item for item in payload.get("items", [])}
    featured = payload.get("featured", [])

    print("Fetching Bangumi collections...")
    collections = fetch_collections()
    print(f"Fetched {len(collections)} collections")

    new_items = []
    for collection in collections:
        subject = collection["subject"]
        sid = int(subject["id"])
        old = old_items.get(sid, {})
        detail = None
        tags = old.get("tags") or [tag["name"] for tag in subject.get("tags", [])[:12]]
        summary = old.get("summary") or clean(subject.get("short_summary"), 260)
        if not old:
            try:
                detail = get_json(f"{API}/subjects/{sid}")
                tags = [tag["name"] for tag in detail.get("tags", [])[:12]]
                summary = clean(detail.get("summary"), 260)
            except Exception as exc:
                print(f"  ! detail failed: {sid} ({exc})")

        name = subject.get("name") or old.get("name", "")
        cn = subject.get("name_cn") or old.get("cn") or name
        rate = int(collection.get("rate") or 0)
        status = int(collection.get("type") or 0)
        updated = (collection.get("updated_at") or "")[:10]
        date = (detail or subject).get("date") or old.get("date", "")
        year = int(date[:4]) if date[:4].isdigit() else int(old.get("year") or 0)
        api_comment = clean(collection.get("comment"))
        search = old.get("search") or f"{cn} {name} {' '.join(tags)}".lower()
        for token in (cn, name):
            if token and token.lower() not in search:
                search = f"{search} {token.lower()}"

        item = {
            "id": sid,
            "name": name,
            "cn": cn,
            "rate": rate,
            "status": status,
            "eps": int(collection.get("ep_status") or 0),
            "total": int((detail or subject).get("eps") or 0),
            "year": year,
            "date": date,
            "score": float((detail or subject).get("score") or 0),
            "rank": int((detail or subject).get("rank") or 0),
            "tags": tags,
            "comment": api_comment or old.get("comment", ""),
            "summary": summary,
            "cover": ensure_cover(subject, dry_run=args.dry_run),
            "cats": old.get("cats") or compute_cats(tags),
            "updated": updated,
            "search": search,
        }
        new_items.append(item)

    new_items.sort(key=lambda item: (-item["rate"], -item["year"], item["cn"]))
    current_ids = {item["id"] for item in new_items}
    print(f"Active: {len(new_items)}; removed: {len(set(old_items) - current_ids)}")

    lookup = {item["id"]: item for item in new_items}
    for feature in featured:
        current = lookup.get(int(feature["id"]))
        if current:
            feature["cover"] = current["cover"]
            feature["rate"] = current["rate"]
            feature["year"] = current["year"]
            feature["name"] = current["cn"]
            feature["jp"] = current["name"]

    watched = [item for item in new_items if item["status"] == 2]
    rated = [item for item in new_items if item["rate"] > 0]
    anime_avg = round(sum(item["rate"] for item in rated) / len(rated), 2) if rated else 0
    anime_sd = 0.0
    if rated:
        anime_sd = round((sum((item["rate"] - anime_avg) ** 2 for item in rated) / len(rated)) ** 0.5, 2)
    episodes = sum(item["eps"] for item in watched)

    status_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for item in new_items:
        status_counts[item["status"]] = status_counts.get(item["status"], 0) + 1

    rating_counts = {r: 0 for r in range(1, 11)}
    for item in new_items:
        if item["rate"] in rating_counts:
            rating_counts[item["rate"]] += 1
    rating = [{"r": r, "c": rating_counts[r]} for r in range(10, 0, -1)]

    year_counts = Counter(item["year"] for item in watched if item["year"])
    watched_years = [item["year"] for item in watched if item["year"]]
    max_year = max(watched_years) if watched_years else datetime.now(JST).year
    min_year = min([1995] + [item["year"] for item in new_items if item["year"]])
    years = [{"y": y, "c": year_counts.get(y, 0)} for y in range(min_year, max_year + 1)]

    totals = payload.get("totals", {})
    totals.update(overall_totals({k: totals.get(k) for k in ("all", "completed", "rate", "avg", "sd", "rated")}))
    totals.update({
        "anime": len(new_items),
        "animeCompleted": len(watched),
        "animeRate": round(len(watched) / len(new_items) * 100, 1) if new_items else 0,
        "animeAvg": anime_avg,
        "animeRated": len(rated),
        "sd": anime_sd,
        "episodes": episodes,
        "hours": round(episodes * 24 / 60),
    })

    spectrum = []
    for item in new_items:
        color = average_color(ROOT / item["cover"])
        if color:
            spectrum.append({"id": item["id"], "color": color, "title": item["cn"]})

    payload.update({
        "items": new_items,
        "featured": featured,
        "totals": totals,
        "status": status_counts,
        "rating": rating,
        "years": years,
        "spectrum": spectrum,
        "generated": datetime.now(JST).strftime("%Y-%m-%d"),
    })

    print(f"Watched: {len(watched)}; rated: {len(rated)}; avg: {anime_avg}; episodes: {episodes}")
    print(f"Totals: {totals.get('all')} / {totals.get('completed')} / {totals.get('rate')}% / {totals.get('avg')}")
    if args.dry_run:
        print("Dry run: not writing js/data.js")
        return

    DATA_FILE.write_text(
        "/* generated from Bangumi public data + TSDM public profile */\n"
        "window.AQUAMARINE = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Wrote {DATA_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
