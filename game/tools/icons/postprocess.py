"""Готовит иконки для игры: убирает белый фон (заливкой от краёв) и сохраняет 256×256 PNG.

    python3 tools/icons/postprocess.py

Берёт assets/icons/raw/<группа>/<имя>.* и пишет assets/icons/<группа>/<имя>.png.
Нужен Pillow.
"""
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2] / "assets" / "icons"
RAW = ROOT / "raw"
SIZE = 256
TOLERANCE = 22  # насколько пиксель может отличаться от белого, чтобы считаться фоном


def is_bg(px):
    r, g, b = px[:3]
    return 255 - min(r, g, b) <= TOLERANCE and max(r, g, b) - min(r, g, b) <= 12


def remove_background(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    mask = Image.new("L", (w, h), 255)
    m = mask.load()
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    seen = set()
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not is_bg(px[x, y]):
            continue
        m[x, y] = 0
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    # мягкий край, чтобы не было белой «бахромы»
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
    im.putalpha(mask)
    return im


def fit(im):
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    side = int(max(im.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    files = sorted(p for p in RAW.rglob("*") if p.is_file())
    for src in files:
        rel = src.relative_to(RAW).with_suffix(".png")
        dst = ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        # исходники большие — сначала уменьшаем, потом заливка (быстрее)
        im = Image.open(src)
        im.thumbnail((640, 640), Image.LANCZOS)
        fit(remove_background(im)).save(dst, optimize=True)
        print("✓", rel)
    names = sorted(str(p.relative_to(ROOT).with_suffix("")) for p in ROOT.rglob("*.png"))
    (ROOT / "manifest.json").write_text(json.dumps(names, ensure_ascii=False, indent=1))
    print(f"manifest.json: {len(names)} иконок")


if __name__ == "__main__":
    main()
