import { CITIES, REGIONS } from '../data/cities.js';
import { DISTRICTS } from '../data/districts.js';
import { randInt, randRange, rand } from './rng.js';
import { LAND_MASK } from '../data/landmask.js';

const M_PER_DEG = 111320;

export function offsetLatLng(lat, lng, dxMeters, dyMeters) {
  return {
    lat: lat + dyMeters / M_PER_DEG,
    lng: lng + dxMeters / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)),
  };
}

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------- суша/вода (маска из Natural Earth, см. tools/map/build_map.py) ----------
const decoded = {};
function maskBits(placeId) {
  if (!decoded[placeId]) {
    const b64 = LAND_MASK[placeId]?.bits;
    if (!b64) return null;
    decoded[placeId] = typeof atob === 'function'
      ? Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
      : Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  return decoded[placeId];
}

export function isLand(place, lat, lng) {
  const m = LAND_MASK[place.id];
  const bits = maskBits(place.id);
  if (!m || !bits) return true;
  const half = Math.floor(m.n / 2);
  const i = Math.round(((lng - place.lng) * M_PER_DEG * Math.cos((place.lat * Math.PI) / 180)) / m.step) + half;
  const j = half - Math.round(((lat - place.lat) * M_PER_DEG) / m.step);
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return true;
  const k = j * m.n + i;
  return (bits[k >> 3] & (1 << (k & 7))) !== 0;
}

// Доля суши в круге (по 9 точкам): район должен стоять в основном на земле
function landShare(place, lat, lng, radius) {
  let n = 0;
  for (let a = 0; a < 8; a++) {
    const p = offsetLatLng(lat, lng, Math.cos((a * Math.PI) / 4) * radius, Math.sin((a * Math.PI) / 4) * radius);
    if (isLand(place, p.lat, p.lng)) n++;
  }
  return (n + (isLand(place, lat, lng) ? 1 : 0)) / 9;
}

// Расстояние центра района от центра города, м
const RING = {
  cbd: [0, 300],
  historic: [1700, 2700],
  premium: [2600, 5000],
  residential: [4000, 9000],
  student: [3000, 6000],
  mall: [3500, 7500],
  industrial: [8000, 13000],
};

function cityDistrictTypes(pop) {
  /** @type {string[]} */
  const types = ['cbd', 'historic', 'residential', 'student', 'industrial'];
  if (pop >= 4) types.push('mall', 'premium');
  if (pop >= 9) types.push('residential', 'mall');
  if (pop >= 14) types.push('residential', 'student', 'industrial');
  return types;
}

function aiScale(pop) {
  return Math.min(1.6, Math.max(0.6, 0.5 + pop / 15));
}

// Категории фоновых конкурентов, которые были в мире с самого начала (для них — общий ГСЧ)
const LEGACY_AI = new Set(['coffee', 'fastfood', 'grocery', 'bakery', 'restaurant', 'fuel', 'electronics', 'hotel', 'fitness', 'beauty', 'pharmacy', 'cars', 'autoservice']);
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function generateWorld(rng) {
  /** @type {Record<string, any>} */
  const places = {};
  /** @type {Record<string, any>} */
  const districts = {};
  /** @type {Record<string, import('./types.js').Lot>} */
  const lots = {};

  const addLot = (district, place, type, [minDist, maxDist]) => {
    const def = DISTRICTS[type];
    // участок — только на суше (несколько попыток)
    let p = { lat: district.lat, lng: district.lng };
    for (let t = 0; t < 30; t++) {
      const distance = randRange(rng, minDist, maxDist);
      const angle = rand(rng) * Math.PI * 2;
      p = offsetLatLng(district.lat, district.lng, Math.cos(angle) * distance, Math.sin(angle) * distance);
      if (isLand(place, p.lat, p.lng)) break;
    }
    const id = `${district.id}-${district.lotIds.length + 1}`;
    const visibility = Math.round(randRange(rng, 0.2, 1) * 100) / 100;
    const trafficMult = place.kind === 'city' ? 0.7 + Math.min(place.pop, 25) / 40 : 0;
    const traffic = Math.round(randRange(rng, def.traffic[0], def.traffic[1]) * trafficMult);
    // рынок недвижимости учитывает поток людей: проходное место стоит дороже
    const trafficRent = def.traffic[1] > 0 ? 0.4 + 0.6 * traffic / (((def.traffic[0] + def.traffic[1]) / 2) * trafficMult) : 1;
    let area;
    let rent;
    if (def.zoning === 'farmland') {
      area = randInt(rng, 6, 30) * 10; // га
      rent = area * place.landRent;
    } else if (def.zoning === 'industrial') {
      area = randInt(rng, 6, 30) * 50; // м²
      rent = area * def.rent * place.rent;
    } else {
      area = randInt(rng, 7, 36) * 5; // м²
      rent = area * def.rent * place.rent * (0.8 + 0.4 * visibility) * trafficRent;
    }
    const lot = {
      id,
      districtId: district.id,
      placeId: place.id,
      lat: p.lat,
      lng: p.lng,
      zoning: def.zoning,
      area,
      traffic,
      visibility,
      rent: Math.round(rent),
      price: Math.round(rent * 110),
      ownerId: null, // компания-владелец помещения (иначе — аренда у города)
      unitId: null,
    };
    lots[id] = lot;
    district.lotIds.push(id);
  };

  /** @param {any} r */
  function addRegion(r) {
    const place = { ...r, kind: 'region', districtIds: /** @type {string[]} */ ([]) };
    places[r.id] = place;
    const id = `${r.id}:1`;
    const district = { id, placeId: r.id, type: 'rural', lat: r.lat, lng: r.lng, radius: 20000, lotIds: [], ai: {} };
    districts[id] = district;
    place.districtIds.push(id);
    const n = randInt(rng, DISTRICTS.rural.lots[0], DISTRICTS.rural.lots[1]);
    for (let k = 0; k < n; k++) addLot(district, place, 'rural', [3000, 18000]);
  }

  // Порядок важен для старых партий: сначала первые 26 городов и 16 регионов (как раньше), потом новые —
  // так у сохранённых комнат мир из сида получается прежним, а новые места просто добавляются.
  const order = [...CITIES.slice(0, 26), ...REGIONS.slice(0, 16), ...CITIES.slice(26), ...REGIONS.slice(16)];
  for (const c of order) {
    if (!('pop' in c)) {
      addRegion(c);
      continue;
    }
    const place = { ...c, kind: 'city', districtIds: /** @type {string[]} */ ([]) };
    places[c.id] = place;
    const types = cityDistrictTypes(c.pop);
    const baseAngle = rand(rng) * Math.PI * 2;
    types.forEach((type, i) => {
      const def = DISTRICTS[type];
      const ring = RING[type];
      // центр района: на суше, в основном окружён сушей и не наезжает на соседние районы
      let center = { lat: c.lat, lng: c.lng };
      let best = -1;
      for (let t = 0; t < 40; t++) {
        const spread = 1 + t / 15; // если долго не выходит — ищем дальше и под любым углом
        const dist = randRange(rng, ring[0], ring[1] * spread);
        const angle = baseAngle + (i / types.length) * Math.PI * 2 + randRange(rng, -0.3, 0.3) * spread * 3;
        const p = offsetLatLng(c.lat, c.lng, Math.cos(angle) * dist, Math.sin(angle) * dist);
        const crowd = place.districtIds.some((id) => {
          const o = districts[id];
          return Math.hypot((o.lat - p.lat) * M_PER_DEG, (o.lng - p.lng) * M_PER_DEG * Math.cos((p.lat * Math.PI) / 180)) < 1500;
        });
        const score = landShare(place, p.lat, p.lng, 600) - (crowd ? 0.5 : 0);
        if (score > best) {
          best = score;
          center = p;
        }
        if (score >= 0.85) break;
      }
      const id = `${c.id}:${i + 1}`;
      const ai = {};
      for (const [cat, n] of Object.entries(def.ai)) {
        // новые категории не трогают общий ГСЧ, чтобы мир старых партий не поменялся
        const jitter = LEGACY_AI.has(cat) ? randInt(rng, -1, 1) : (hashStr(`${id}|${cat}`) % 3) - 1;
        ai[cat] = Math.max(0, Math.round(n * aiScale(c.pop)) + jitter);
      }
      const district = { id, placeId: c.id, type, lat: center.lat, lng: center.lng, radius: 800, lotIds: [], ai };
      districts[id] = district;
      place.districtIds.push(id);
      const n = randInt(rng, def.lots[0], def.lots[1]);
      for (let k = 0; k < n; k++) addLot(district, place, type, [80, 650]);
    });
  }

  return { places, districts, lots };
}

// Индекс стоимости строительства/оборудования в месте
// cpi — накопленная инфляция страны (см. countries.js)
export function costIndex(place) {
  const base = place.kind === 'city' ? 0.5 + 0.5 * place.rent : 0.5 + 0.5 * (place.wage + 0.3);
  return base * (place.cpi ?? 1);
}

// Индекс розничных цен (сколько местные готовы платить)
export function priceIndex(place) {
  return 0.35 + 0.65 * (place.income ?? 0.5);
}
