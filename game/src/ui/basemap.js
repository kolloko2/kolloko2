/* global L */
// Собственная стилизованная карта мира: реальные берега, страны, озёра и реки (Natural Earth),
// мягкие цвета и «гранёная» текстура как у иконок, а в городах — процедурные кварталы вместо улиц.

const PALETTE = ['#e9dfc6', '#dbe2c3', '#ead6bf', '#d6dcc8', '#f0e4c9', '#ded2b9', '#e4ddcb'];
const WATER = '#a9d3dc';
const SHALLOW = '#c4e3e6';
const BORDER = '#fbf8f1';

// Цвета кварталов по типу района
const DISTRICT_TINT = {
  cbd: ['#c3cfe4', '#b3c1db'],
  historic: ['#e6ccb4', '#dcbfa4'],
  premium: ['#ddd0e6', '#d1c2dd'],
  residential: ['#d3e1c6', '#c5d6b6'],
  student: ['#f0d9b8', '#e8cca5'],
  mall: ['#efd0dd', '#e5c0d0'],
  industrial: ['#d5d5cf', '#c8c8c1'],
};
const PARK = ['#bcd8a6', '#a9cc92'];
const FIELDS = ['#e8d89a', '#d8dc9a', '#c9d79a', '#e3c98c'];

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return res.json();
}

// ---------- «гранёная» текстура ----------
// Треугольная сетка в глобальных пиксельных координатах — поэтому стыки тайлов совпадают.
const FacetLayer = L.GridLayer.extend({
  createTile(coords) {
    const tile = document.createElement('canvas');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    const ctx = tile.getContext('2d');
    const S = 56;
    const x0 = coords.x * size.x;
    const y0 = coords.y * size.y;
    const pt = (i, j) => [
      i * S + (hash(i, j, coords.z) - 0.5) * S * 0.7 - x0,
      j * S + (hash(j, i, coords.z + 7) - 0.5) * S * 0.7 - y0,
    ];
    const i0 = Math.floor(x0 / S) - 1;
    const j0 = Math.floor(y0 / S) - 1;
    for (let i = i0; i <= i0 + size.x / S + 2; i++) {
      for (let j = j0; j <= j0 + size.y / S + 2; j++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const c = pt(i, j + 1);
        const d = pt(i + 1, j + 1);
        for (const [tri, k] of /** @type {[number[][], number][]} */ ([[[a, b, c], 1], [[b, d, c], 2]])) {
          const v = hash(i, j, k + coords.z * 3);
          ctx.fillStyle = v < 0.5 ? `rgba(255,255,255,${(0.5 - v) * 0.16})` : `rgba(70,50,30,${(v - 0.5) * 0.09})`;
          ctx.beginPath();
          ctx.moveTo(tri[0][0], tri[0][1]);
          ctx.lineTo(tri[1][0], tri[1][1]);
          ctx.lineTo(tri[2][0], tri[2][1]);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    return tile;
  },
});

// ---------- кварталы ----------
const urbanCache = new WeakMap();
// Радиус застройки города — до самого дальнего района
function urbanRadius(state, place) {
  let m = urbanCache.get(state);
  if (!m) urbanCache.set(state, (m = {}));
  if (m[place.id] === undefined) {
    let r = 2000;
    for (const id of place.districtIds) {
      const d = state.world.districts[id];
      const dy = (d.lat - place.lat) * 111320;
      const dx = (d.lng - place.lng) * 111320 * Math.cos((place.lat * Math.PI) / 180);
      r = Math.max(r, Math.hypot(dx, dy) + d.radius);
    }
    m[place.id] = r;
  }
  return m[place.id];
}
function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

// Части суши (из детальных границ стран) с рамками — чтобы обрезать город по берегу
let landParts = null;

function setLandParts(geojson) {
  landParts = [];
  for (const f of geojson.features) {
    for (const poly of f.geometry.coordinates) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of poly[0]) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      landParts.push({ bbox: [x0, y0, x1, y1], rings: poly });
    }
  }
}

// Обрезать тайл по суше; false — тайл целиком в море
function clipToLand(ctx, map, coords, size) {
  if (!landParts) return true;
  const nw = map.unproject([coords.x * size.x, coords.y * size.y], coords.z);
  const se = map.unproject([(coords.x + 1) * size.x, (coords.y + 1) * size.y], coords.z);
  const parts = landParts.filter((p) => p.bbox[0] <= se.lng && p.bbox[2] >= nw.lng && p.bbox[1] <= nw.lat && p.bbox[3] >= se.lat);
  if (!parts.length) return false;
  const x0 = coords.x * size.x;
  const y0 = coords.y * size.y;
  ctx.beginPath();
  for (const part of parts) {
    for (const ring of part.rings) {
      ring.forEach(([lng, lat], i) => {
        const p = map.project([lat, lng], coords.z);
        if (i === 0) ctx.moveTo(p.x - x0, p.y - y0);
        else ctx.lineTo(p.x - x0, p.y - y0);
      });
      ctx.closePath();
    }
  }
  ctx.clip('evenodd');
  return true;
}

const CityLayer = L.GridLayer.extend({
  initialize(getState, options) {
    this.getState = getState;
    L.setOptions(this, options);
  },

  createTile(coords) {
    const tile = document.createElement('canvas');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    const state = this.getState();
    if (!state) return tile;
    const ctx = tile.getContext('2d');
    const map = this._map;
    const x0 = coords.x * size.x;
    const y0 = coords.y * size.y;
    const near = (c, R) => !(c.x + R < x0 || c.x - R > x0 + size.x || c.y + R < y0 || c.y - R > y0 + size.y);
    const cities = Object.values(state.world.places).filter((place) => {
      if (place.kind !== 'city') return false;
      const c = map.project([place.lat, place.lng], coords.z);
      return near(c, (urbanRadius(state, place) + 1500) / metersPerPixel(place.lat, coords.z));
    });
    const farms = Object.values(state.world.districts).some((d) => d.type === 'rural'
      && near(map.project([d.lat, d.lng], coords.z), 25000 / metersPerPixel(d.lat, coords.z)));
    if (!cities.length && !farms) return tile;
    if (!clipToLand(ctx, map, coords, size)) return tile;
    // ткань города: кварталы по всей площади застройки, гуще к центру
    for (const place of cities) {
      const c = map.project([place.lat, place.lng], coords.z);
      drawFabric(ctx, c.x - x0, c.y - y0, metersPerPixel(place.lat, coords.z), urbanRadius(state, place), strHash(place.id), coords.z, x0, y0, c, size);
    }
    for (const d of Object.values(state.world.districts)) {
      const c = map.project([d.lat, d.lng], coords.z);
      const mpp = metersPerPixel(d.lat, coords.z);
      if (d.type === 'rural') {
        for (const lotId of d.lotIds) {
          const lot = state.world.lots[lotId];
          const p = map.project([lot.lat, lot.lng], coords.z);
          const r = 1600 / mpp;
          if (p.x + r < x0 || p.x - r > x0 + size.x || p.y + r < y0 || p.y - r > y0 + size.y) continue;
          drawFields(ctx, p.x - x0, p.y - y0, mpp, strHash(lot.id));
        }
        continue;
      }
      const r = (d.radius * 1.05) / mpp;
      if (c.x + r < x0 || c.x - r > x0 + size.x || c.y + r < y0 || c.y - r > y0 + size.y) continue;
      if (coords.z >= 12) {
        drawDistrict(ctx, c.x - x0, c.y - y0, mpp, d, strHash(d.id));
      } else {
        // издалека район — цветное пятно
        ctx.fillStyle = (DISTRICT_TINT[d.type] || DISTRICT_TINT.residential)[0];
        ctx.beginPath();
        ctx.arc(c.x - x0, c.y - y0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tile;
  },
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Обычная застройка города между районами
function drawFabric(ctx, cx, cy, mpp, radiusM, seed, zoom, x0, y0, c, size) {
  const blockM = 120;
  const stepM = 145;
  const step = stepM / mpp;
  const block = blockM / mpp;
  const n = Math.ceil(radiusM / stepM);
  // только клетки, попадающие в тайл
  const iMin = Math.max(-n, Math.floor((x0 - c.x) / step) - 1);
  const iMax = Math.min(n, Math.ceil((x0 + size.x - c.x) / step) + 1);
  const jMin = Math.max(-n, Math.floor((y0 - c.y) / step) - 1);
  const jMax = Math.min(n, Math.ceil((y0 + size.y - c.y) / step) + 1);
  const detailed = zoom >= 12;
  const depth = Math.max(1, 5 / mpp);
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const d = Math.hypot(i, j) * stepM;
      const density = 1.15 - d / radiusM + (hash(seed + i, j, 9) - 0.5) * 0.5;
      if (density < hash(seed + j, i, 8)) continue;
      const x = cx + i * step - block / 2;
      const y = cy + j * step - block / 2;
      const v = hash(seed + i, j, 3);
      if (!detailed) {
        ctx.fillStyle = v < 0.08 ? PARK[1] : v < 0.5 ? '#d9cfba' : '#d0c5ae';
        ctx.fillRect(x, y, block, block);
        continue;
      }
      if (v < 0.08) {
        ctx.fillStyle = PARK[0];
        roundRect(ctx, x, y, block, block, block * 0.15);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = '#cfc7b4';
      roundRect(ctx, x, y + depth, block, block, block * 0.1);
      ctx.fill();
      ctx.fillStyle = v < 0.5 ? '#e4ddcd' : '#ddd6c5';
      roundRect(ctx, x, y, block, block, block * 0.1);
      ctx.fill();
    }
  }
}

// Район — сетка кварталов в круге; кварталы «объёмные» (тёмный нижний край), часть клеток — парки
function drawDistrict(ctx, cx, cy, mpp, d, seed) {
  const [fill, side] = DISTRICT_TINT[d.type] || DISTRICT_TINT.residential;
  const big = d.type === 'industrial' ? 1.7 : d.type === 'premium' ? 1.3 : 1;
  const block = (95 * big) / mpp;
  const street = 20 / mpp;
  const step = block + street;
  const R = d.radius / mpp;
  const rot = (hash(seed, 1) - 0.5) * 0.5;
  const n = Math.ceil(R / step) + 1;
  ctx.save();
  ctx.translate(cx, cy);
  // мягкое «пятно» района под кварталами
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(rot);
  const depth = Math.max(1, 6 / mpp);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * step - block / 2;
      const y = j * step - block / 2;
      const dist = Math.hypot(i * step, j * step);
      const edge = R - dist;
      if (edge < 0) continue;
      // по краю района кварталы реже — мягкая граница
      if (edge < step * 1.5 && hash(seed + i, j, 5) > edge / (step * 1.5)) continue;
      const v = hash(seed + i, j, 3);
      if (v < 0.11) {
        // парк с деревьями
        ctx.fillStyle = PARK[0];
        roundRect(ctx, x, y, block, block, block * 0.18);
        ctx.fill();
        ctx.fillStyle = PARK[1];
        for (let t = 0; t < 4; t++) {
          const tx = x + block * (0.2 + 0.6 * hash(seed + i, j, 10 + t));
          const ty = y + block * (0.2 + 0.6 * hash(seed + j, i, 20 + t));
          ctx.beginPath();
          ctx.arc(tx, ty, block * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      // квартал может быть разделён на 2 здания
      const split = v > 0.6;
      const parts = split ? [[x, y, block, block * 0.47], [x, y + block * 0.53, block, block * 0.47]] : [[x, y, block, block]];
      for (const [px, py, w, h] of parts) {
        ctx.fillStyle = side;
        roundRect(ctx, px, py + depth, w, h, Math.min(w, h) * 0.12);
        ctx.fill();
        ctx.fillStyle = fill;
        roundRect(ctx, px, py, w, h, Math.min(w, h) * 0.12);
        ctx.fill();
        // светлая грань сверху — как у low-poly иконок
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.moveTo(px + w * 0.1, py + h * 0.1);
        ctx.lineTo(px + w * 0.9, py + h * 0.1);
        ctx.lineTo(px + w * 0.1, py + h * 0.75);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// Сельхозугодья вокруг участка — лоскутное одеяло полей
function drawFields(ctx, cx, cy, mpp, seed) {
  const cell = 380 / mpp;
  const gap = 25 / mpp;
  const R = 1500 / mpp;
  const n = Math.ceil(R / cell);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((hash(seed, 2) - 0.5) * 0.8);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      if (Math.hypot(i, j) * cell > R) continue;
      ctx.fillStyle = FIELDS[Math.floor(hash(seed + i, j, 4) * FIELDS.length)];
      roundRect(ctx, i * cell, j * cell, cell - gap, cell - gap, cell * 0.06);
      ctx.fill();
      // борозды
      ctx.strokeStyle = 'rgba(120,100,50,0.12)';
      ctx.lineWidth = Math.max(0.5, 3 / mpp);
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(i * cell + (k * (cell - gap)) / 4, j * cell);
        ctx.lineTo(i * cell + (k * (cell - gap)) / 4, j * cell + cell - gap);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ---------- сборка ----------
export async function initBasemap(map, getState) {
  // город — над сушей, но под озёрами и реками
  const panes = [['coast', 210], ['land', 220], ['city', 225], ['water', 230], ['facet', 240], ['labels', 260]];
  for (const [name, z] of panes) {
    map.createPane(name);
    map.getPane(name).style.zIndex = z;
    map.getPane(name).style.pointerEvents = 'none';
  }
  const coastR = L.canvas({ pane: 'coast', padding: 0.3 });
  const landR = L.canvas({ pane: 'land', padding: 0.3 });
  const waterR = L.canvas({ pane: 'water', padding: 0.3 });

  new FacetLayer({ pane: 'facet', tileSize: 256, updateWhenZooming: false }).addTo(map);
  const city = new CityLayer(getState, { pane: 'city', tileSize: 256, minZoom: 9, maxZoom: 18, updateWhenZooming: false });

  const landStyle = (f) => ({ renderer: landR, fillColor: PALETTE[(f.properties.c - 1) % PALETTE.length], fillOpacity: 1, color: BORDER, weight: 1.2, interactive: false });
  const coastStyle = { renderer: coastR, fill: false, color: SHALLOW, weight: 9, opacity: 0.9, interactive: false };
  const smooth = 1.2;

  const c50 = await loadJson('assets/map/countries-50m.json');
  const coast50 = L.geoJSON(c50, { style: coastStyle, smoothFactor: smooth }).addTo(map);
  const land50 = L.geoJSON(c50, { style: landStyle, smoothFactor: smooth }).addTo(map);

  // Подписи стран (по-русски) на мелком масштабе
  const labels = L.layerGroup().addTo(map);
  const labelData = c50.features.filter((f) => f.properties.n).map((f) => f.properties);
  function drawLabels() {
    labels.clearLayers();
    const z = map.getZoom();
    if (z < 3 || z > 6) return;
    for (const p of labelData) {
      if (p.r > z) continue;
      labels.addLayer(L.marker([p.ly, p.lx], {
        pane: 'labels',
        interactive: false,
        icon: L.divIcon({ className: 'country-label', html: `<span>${p.n}</span>`, iconSize: null }),
      }));
    }
  }

  // Детальные берега, озёра и реки подгружаем при приближении
  let detail = null;
  let loading = false;
  async function ensureDetail() {
    if (detail || loading) return;
    loading = true;
    const [c10, lakes, rivers] = await Promise.all(['countries-10m', 'lakes', 'rivers'].map((n) => loadJson(`assets/map/${n}.json`)));
    setLandParts(c10);
    city.redraw();
    detail = {
      coast: L.geoJSON(c10, { style: coastStyle, smoothFactor: smooth }),
      land: L.geoJSON(c10, { style: landStyle, smoothFactor: smooth }),
      lakes: L.geoJSON(lakes, { style: { renderer: waterR, fillColor: WATER, fillOpacity: 1, color: '#9fcbd5', weight: 1, interactive: false }, smoothFactor: smooth }),
      rivers: L.geoJSON(rivers, {
        style: (f) => ({ renderer: waterR, color: WATER, weight: 1, opacity: 1, lineCap: 'round', interactive: false, rank: f.properties.r }),
        filter: (f) => f.properties.r <= 8,
        smoothFactor: smooth,
      }),
    };
    loading = false;
    update();
  }

  function update() {
    const z = map.getZoom();
    const useDetail = z >= 5 && detail;
    const toggle = (layer, on) => (on ? !map.hasLayer(layer) && layer.addTo(map) : map.hasLayer(layer) && map.removeLayer(layer));
    toggle(coast50, !useDetail);
    toggle(land50, !useDetail);
    if (detail) {
      toggle(detail.coast, useDetail);
      toggle(detail.land, useDetail);
      toggle(detail.lakes, z >= 4);
      toggle(detail.rivers, z >= 4);
      if (z >= 4) {
        detail.rivers.eachLayer((l) => {
          const r = l.options.rank;
          const w = Math.max(0, (z - 3) * 0.7 - r * 0.25);
          l.setStyle({ weight: w, opacity: w > 0.3 ? 1 : 0 });
        });
      }
    } else if (z >= 4) {
      ensureDetail();
    }
    if (z >= 9 && !detail) ensureDetail();
    toggle(city, z >= 9);
    drawLabels();
  }
  map.on('zoomend', update);
  update();
  return { redrawCity: () => city.redraw() };
}
