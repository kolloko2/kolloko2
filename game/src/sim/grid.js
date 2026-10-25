// План города клетками: каждая клетка суши — участок, где можно поставить почти любой бизнес.
// Клетка относится к ближайшему району; чем дальше от его центра, тем меньше прохожих и дешевле аренда.
// Участки создаются при постройке и детерминированы (сид, место, клетка) — одинаково на сервере и у клиентов.
import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { isLand, offsetLatLng } from './world.js';

const M_PER_DEG = 111320;
export const CITY_GRID = { n: 48, step: 420 }; // ~20 × 20 км
export const REGION_GRID = { n: 36, step: 1000 }; // ~36 × 36 км
const FALLOFF_M = 2200; // за столько метров от центра района поток людей падает до минимума

export const gridOf = (place) => (place.kind === 'city' ? CITY_GRID : REGION_GRID);

export function cellCenter(place, x, y) {
  const { n, step } = gridOf(place);
  const half = (n - 1) / 2;
  return offsetLatLng(place.lat, place.lng, (x - half) * step, (half - y) * step);
}

export function cellOf(place, lat, lng) {
  const { n, step } = gridOf(place);
  const half = (n - 1) / 2;
  const x = Math.round(((lng - place.lng) * M_PER_DEG * Math.cos((place.lat * Math.PI) / 180)) / step + half);
  const y = Math.round(half - ((lat - place.lat) * M_PER_DEG) / step);
  return [x, y];
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const metersBetween = (a, b) => Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lng - b.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180));

// Свойства клетки: суша ли, какой район, насколько людно (0.1…1.1 от нормы района)
const infoCache = new Map();
export function cellInfo(state, place, x, y) {
  const key = `${state.seed}|${place.id}|${x}|${y}`;
  let c = infoCache.get(key);
  if (c) return c;
  const p = cellCenter(place, x, y);
  let best = null;
  let bestD = Infinity;
  for (const id of place.districtIds) {
    const d = state.world.districts[id];
    const m = metersBetween(p, d);
    if (m < bestD) {
      bestD = m;
      best = d;
    }
  }
  const land = isLand(place, p.lat, p.lng);
  const crowd = place.kind === 'city' ? Math.max(0.1, Math.min(1.1, 1.15 - bestD / FALLOFF_M)) : 1;
  c = { x, y, lat: p.lat, lng: p.lng, land, districtId: best?.id ?? null, distM: bestD, crowd, seed: hash(`${place.id}|${x}|${y}`) };
  infoCache.set(key, c);
  return c;
}

export const cellLotId = (placeId, x, y) => `${placeId}@${x}_${y}`;

// Участки по клеткам (заранее сгенерированные участки тоже лежат в клетках)
const lotIndex = new WeakMap();
export function lotAtCell(state, place, x, y) {
  let c = lotIndex.get(state);
  if (!c || c.version !== state.mapVersion || c.n !== Object.keys(state.world.lots).length) {
    c = { version: state.mapVersion, n: Object.keys(state.world.lots).length, map: new Map() };
    for (const lot of Object.values(state.world.lots)) {
      const pl = state.world.places[lot.placeId];
      const [cx, cy] = cellOf(pl, lot.lat, lot.lng);
      const k = `${lot.placeId}|${cx}|${cy}`;
      // в одной клетке может оказаться несколько старых участков — берём занятый, иначе первый
      const prev = c.map.get(k);
      if (!prev || (!prev.unitId && lot.unitId)) c.map.set(k, lot);
    }
    lotIndex.set(state, c);
  }
  return c.map.get(`${place.id}|${x}|${y}`) || null;
}

// Площадь под тип бизнеса на свободной клетке: магазину — помещение, заводу — цех, ферме — поле
export function cellArea(place, type, seed) {
  const def = BUSINESSES[type];
  if (def.zoning === 'farmland') return Math.round(100 + 200 * seed); // га
  if (def.zoning === 'industrial') return Math.round((400 + 900 * seed) / 50) * 50; // м²
  return Math.max(def.minArea ?? 0, Math.round((50 + 110 * seed) / 5) * 5); // м²
}

// Участок в клетке под тип бизнеса (ещё не записан в мир — см. registerLot)
export function makeCellLot(state, place, x, y, type) {
  const info = cellInfo(state, place, x, y);
  const district = state.world.districts[info.districtId];
  const def = DISTRICTS[district.type];
  const bdef = BUSINESSES[type];
  const area = cellArea(place, type, info.seed);
  const visibility = Math.round((0.25 + 0.75 * ((info.seed * 7.13) % 1)) * 100) / 100;
  const trafficMult = place.kind === 'city' ? 0.7 + Math.min(place.pop, 25) / 40 : 0;
  const traffic = Math.round(((def.traffic[0] + def.traffic[1]) / 2) * trafficMult * info.crowd);
  let rent;
  if (bdef.zoning === 'farmland') rent = area * place.landRent;
  else {
    // аренда — по ставке района с поправкой на людность; промышленный цех в центре стоит дорого
    const rate = (bdef.zoning === 'industrial' ? Math.max(def.rent * 0.35, 9) : def.rent) * place.rent * (0.35 + 0.65 * info.crowd);
    rent = area * rate * (bdef.zoning === 'industrial' ? 1 : 0.8 + 0.4 * visibility);
  }
  const lot = {
    id: cellLotId(place.id, x, y),
    districtId: district.id,
    placeId: place.id,
    lat: info.lat,
    lng: info.lng,
    zoning: bdef.zoning,
    area,
    traffic,
    visibility,
    rent: Math.round(rent),
    price: Math.round(rent * 110),
    ownerId: null,
    unitId: null,
  };
  return lot;
}

export function registerLot(state, lot) {
  state.world.lots[lot.id] = lot;
  state.world.districts[lot.districtId].lotIds.push(lot.id);
}

// Можно ли строить в клетке тип type (без денег и технологий — это проверяет команда)
export function cellBuildable(state, place, x, y, type) {
  const { n } = gridOf(place);
  if (x < 0 || y < 0 || x >= n || y >= n) return 'Вне плана города';
  const info = cellInfo(state, place, x, y);
  if (!info.land) return 'Вода';
  const def = BUSINESSES[type];
  if (place.kind === 'region') {
    if (def.zoning !== 'farmland') return 'Здесь только сельхозземля и недра';
    if (!place.kinds.includes(type)) return 'В этом регионе так нельзя';
  } else if (def.zoning === 'farmland') return 'Фермы, шахты и плантации — только в сельских регионах';
  if ((def.onlyPort || def.service?.onlyPort) && !place.port) return 'Нужен морской порт';
  const lot = lotAtCell(state, place, x, y);
  if (lot?.unitId) return 'Клетка занята';
  if (lot && def.minArea && lot.area < def.minArea) return `Здание мало: ${lot.area} м², нужно от ${def.minArea}`;
  return null;
}
