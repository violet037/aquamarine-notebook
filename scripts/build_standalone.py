#!/usr/bin/env python3
"""Build the self-contained phone HTML from the current site files."""

from __future__ import annotations

import base64
import io
import json
import os
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Aquamarine-standalone.html"
CSS = ROOT / "css" / "style.css"
HTML = ROOT / "index.html"
MAIN_JS = ROOT / "js" / "main.js"
DATA = ROOT / "js" / "data.js"


def raw_uri(path: Path, mime: str) -> str:
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def webp_uri(path: Path, max_h: int = 560, quality: int = 80) -> str:
    image = Image.open(path).convert("RGB")
    if image.height > max_h:
        image = image.resize((round(image.width * max_h / image.height), max_h), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def main():
    html = HTML.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    main_js = MAIN_JS.read_text(encoding="utf-8")
    payload = json.loads(DATA.read_text(encoding="utf-8").split("window.AQUAMARINE = ", 1)[1].rstrip().rstrip(";"))

    cache = {}

    def cover_uri(path: str) -> str:
        if path not in cache:
            full = ROOT / path
            if not full.exists():
                raise FileNotFoundError(full)
            cache[path] = webp_uri(full)
        return cache[path]

    for item in payload["items"]:
        item["cover"] = cover_uri(item["cover"])
    for item in payload["featured"]:
        item["cover"] = cover_uri(item["cover"])

    css = css.replace('url("../assets/noise.svg")', f'url("{raw_uri(ROOT / "assets" / "noise.svg", "image/svg+xml")}")')
    html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
    html = re.sub(r'\s*<link rel="preload"[^>]*>\n?', "\n", html)
    html = re.sub(r'\s*<meta property="og:image"[^>]*>\n?', "\n", html)
    html = re.sub(
        r'<link rel="icon"[^>]*>',
        '<link rel="icon" href="' + raw_uri(ROOT / "assets" / "favicon.svg", "image/svg+xml") + '" type="image/svg+xml">',
        html,
        count=1,
    )
    html = html.replace('<script src="js/data.js" defer></script>\n  <script src="js/main.js" defer></script>', "")

    def replace_img(match):
        path = match.group(1)
        if path == "assets/covers/304087-hero.webp":
            hero = ROOT / path
            if not hero.exists():
                hero = ROOT / "assets" / "covers" / "304087.webp"
            return 'src="' + raw_uri(hero, "image/webp") + '"'
        if path in {"assets/avatar.jpg", "assets/avatar-tsdm.jpg"}:
            return 'src="' + raw_uri(ROOT / path, "image/jpeg") + '"'
        if path.startswith("assets/covers/"):
            return 'src="' + cover_uri(path) + '"'
        return match.group(0)

    html = re.sub(r'src="(assets/[^"]+)"', replace_img, html)

    data_js = "window.AQUAMARINE = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";\n"
    scripts = "<script>\n" + data_js + "</script>\n<script>\n" + main_js + "\n</script>\n"
    html = html.replace("</body>", scripts + "</body>")

    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"Wrote {OUT.name} ({os.path.getsize(OUT) / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
