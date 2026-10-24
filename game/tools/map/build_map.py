"""Готовит векторную карту мира для игры из данных Natural Earth (public domain).

    python3 tools/map/build_map.py [папка-кэша]          — файлы карты
    python3 tools/map/build_map.py <папка-кэша> masks    — маска суши для генератора мира (src/data/landmask.js)

Скачивает GeoJSON Natural Earth (если нет в кэше), упрощает линии (Дуглас — Пекер), округляет координаты,
оставляет только нужные поля и пишет компактные файлы в assets/map/:
  countries-50m.json — страны для мелкого масштаба (+ русские названия и точки подписей)
  countries-10m.json — страны для крупного масштаба
  lakes.json, rivers.json — озёра и реки
Только стандартная библиотека Python.
"""
import json
import sys
import urllib.request
from pathlib import Path

SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{}.geojson"
OUT = Path(__file__).resolve().parents[2] / "assets" / "map"


def load(name, cache):
    path = cache / f"{name}.geojson"
    if not path.exists():
        print("скачиваю", name)
        urllib.request.urlretrieve(SRC.format(name), path)
    return json.loads(path.read_text(encoding="utf-8"))


def _perp(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return ((x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2) ** 0.5


def simplify(points, tol):
    """Дуглас — Пекер без рекурсии."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0, None
        for k in range(i + 1, j):
            d = _perp(points[k], points[i], points[j])
            if d > best:
                best, idx = d, k
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(points, keep) if k]


def ring_area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2


def clean(points, tol, digits):
    pts = simplify(points, tol)
    out = []
    for x, y in pts:
        p = [round(x, digits), round(y, digits)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def polygons(geom, tol, digits, min_area):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    result = []
    for poly in polys:
        rings = []
        for i, ring in enumerate(poly):
            r = clean(ring, tol, digits)
            if len(r) < 4 or ring_area(r) < (min_area if i == 0 else min_area * 4):
                if i == 0:
                    break
                continue
            rings.append(r)
        if rings:
            result.append(rings)
    if not result:
        return None
    return {"type": "MultiPolygon", "coordinates": result}


def lines(geom, tol, digits):
    parts = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
    out = [clean(p, tol, digits) for p in parts]
    out = [p for p in out if len(p) >= 2]
    return {"type": "MultiLineString", "coordinates": out} if out else None


def write(name, features):
    OUT.mkdir(parents=True, exist_ok=True)
    data = {"type": "FeatureCollection", "features": features}
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (OUT / name).write_text(text, encoding="utf-8")
    print(f"{name}: {len(features)} объектов, {len(text) / 1e6:.2f} МБ")


def countries(src, tol, digits, min_area, labels):
    feats = []
    for f in src["features"]:
        p = f["properties"]
        geom = polygons(f["geometry"], tol, digits, min_area)
        if not geom:
            continue
        props = {"c": p.get("MAPCOLOR7", 1)}
        if labels:
            props.update({"n": p.get("NAME_RU") or p.get("NAME"), "r": p.get("LABELRANK", 9),
                          "lx": round(p.get("LABEL_X", 0), 2), "ly": round(p.get("LABEL_Y", 0), 2)})
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    return feats


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/natural-earth")
    cache.mkdir(parents=True, exist_ok=True)
    write("countries-50m.json", countries(load("ne_50m_admin_0_countries", cache), 0.06, 2, 0.02, True))
    write("countries-10m.json", countries(load("ne_10m_admin_0_countries", cache), 0.008, 3, 0.0006, False))

    lakes = []
    for f in load("ne_10m_lakes", cache)["features"]:
        rank = f["properties"].get("scalerank", 10)
        if rank > 7:
            continue
        geom = polygons(f["geometry"], 0.006, 3, 0.001)
        if geom:
            lakes.append({"type": "Feature", "properties": {"r": rank}, "geometry": geom})
    write("lakes.json", lakes)

    rivers = []
    for f in load("ne_10m_rivers_lake_centerlines", cache)["features"]:
        rank = f["properties"].get("scalerank", 10)
        if rank > 8 or f["properties"].get("featurecla") == "Lake Centerline":
            continue
        geom = lines(f["geometry"], 0.008, 3)
        if geom:
            rivers.append({"type": "Feature", "properties": {"r": rank}, "geometry": geom})
    write("rivers.json", rivers)


if __name__ == "__main__" and len(sys.argv) <= 2:
    main()


# ---------- маска суши вокруг городов (для генератора мира) ----------
import base64
import math
import re


def read_places():
    """Берёт id и координаты городов и регионов из src/data/cities.js."""
    src = (Path(__file__).resolve().parents[2] / "src" / "data" / "cities.js").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"\{ id: '([a-z_]+)', name: '[^']*', country: '[A-Z]{2}', lat: (-?[\d.]+), lng: (-?[\d.]+)", src):
        out.append((m.group(1), float(m.group(2)), float(m.group(3))))
    return out


def ring_edges(rings, lat_lo, lat_hi, lng_lo):
    edges = []
    for ring in rings:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            if max(y1, y2) < lat_lo or min(y1, y2) > lat_hi or max(x1, x2) < lng_lo:
                continue
            edges.append((x1, y1, x2, y2))
    return edges


def inside(edges, x, y):
    c = False
    for x1, y1, x2, y2 in edges:
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def land_masks(cache):
    land = load("ne_10m_admin_0_countries", cache)["features"]
    lakes = load("ne_10m_lakes", cache)["features"]
    rings_land = [r for f in land for poly in (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]) for r in poly]
    rings_lake = [r for f in lakes for poly in (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]) for r in poly]
    masks = {}
    for pid, lat, lng in read_places():
        rural = pid.startswith("r_")
        step = 1000 if rural else 500
        half = 25000 if rural else 15000
        n = 2 * (half // step) + 1
        dlat = half / 111320
        dlng = half / (111320 * math.cos(math.radians(lat)))
        el = ring_edges(rings_land, lat - dlat, lat + dlat, lng - dlng)
        ew = ring_edges(rings_lake, lat - dlat, lat + dlat, lng - dlng)
        bits = bytearray((n * n + 7) // 8)
        for j in range(n):
            for i in range(n):
                y = lat + ((n // 2) - j) * step / 111320
                x = lng + (i - n // 2) * step / (111320 * math.cos(math.radians(lat)))
                if inside(el, x, y) and not inside(ew, x, y):
                    k = j * n + i
                    bits[k // 8] |= 1 << (k % 8)
        masks[pid] = {"step": step, "n": n, "bits": base64.b64encode(bytes(bits)).decode()}
        share = sum(bin(b).count("1") for b in bits) / (n * n)
        print(f"маска {pid}: суша {share:.0%}")
    out = Path(__file__).resolve().parents[2] / "src" / "data" / "landmask.js"
    out.write_text(
        "// Сгенерировано tools/map/build_map.py из Natural Earth: суша/вода вокруг городов и регионов.\n"
        "// Сетка n×n с шагом step метров, центр — координаты места; bits — base64, 1 = суша.\n"
        f"export const LAND_MASK = {json.dumps(masks, indent=1)};\n",
        encoding="utf-8",
    )


if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "masks":
    land_masks(Path(sys.argv[1]))
