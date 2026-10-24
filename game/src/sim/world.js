import { CITIES, REGIONS } from '../data/cities.js';
import { DISTRICTS } from '../data/districts.js';
import { randInt, randRange, rand } from './rng.js';

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
  const types = ['cbd', 'historic', 'residential', 'student', 'industrial'];
  if (pop >= 4) types.push('mall', 'premium');
  if (pop >= 9) types.push('residential', 'mall');
  if (pop >= 14) types.push('residential', 'student', 'industrial');
  return types;
}

function aiScale(pop) {
  return Math.min(1.6, Math.max(0.6, 0.5 + pop / 15));
}

export function generateWorld(rng) {
  const places = {};
  const districts = {};
  const lots = {};

  const addLot = (district, place, type, distance, angle) => {
    const def = DISTRICTS[type];
    const p = offsetLatLng(district.lat, district.lng, Math.cos(angle) * distance, Math.sin(angle) * distance);
    const id = `${district.id}-${district.lotIds.length + 1}`;
    const visibility = Math.round(randRange(rng, 0.2, 1) * 100) / 100;
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
      rent = area * def.rent * place.rent * (0.8 + 0.4 * visibility);
    }
    const trafficMult = place.kind === 'city' ? 0.7 + Math.min(place.pop, 25) / 40 : 0;
    const lot = {
      id,
      districtId: district.id,
      placeId: place.id,
      lat: p.lat,
      lng: p.lng,
      zoning: def.zoning,
      area,
      traffic: Math.round(randRange(rng, def.traffic[0], def.traffic[1]) * trafficMult),
      visibility,
      rent: Math.round(rent),
      price: Math.round(rent * 110),
      ownerId: null, // компания-владелец помещения (иначе — аренда у города)
      unitId: null,
    };
    lots[id] = lot;
    district.lotIds.push(id);
  };

  for (const c of CITIES) {
    const place = { ...c, kind: 'city', districtIds: [] };
    places[c.id] = place;
    const types = cityDistrictTypes(c.pop);
    const baseAngle = rand(rng) * Math.PI * 2;
    types.forEach((type, i) => {
      const def = DISTRICTS[type];
      const ring = RING[type];
      const dist = randRange(rng, ring[0], ring[1]);
      const angle = baseAngle + (i / types.length) * Math.PI * 2 + randRange(rng, -0.3, 0.3);
      const center = offsetLatLng(c.lat, c.lng, Math.cos(angle) * dist, Math.sin(angle) * dist);
      const id = `${c.id}:${i + 1}`;
      const ai = {};
      for (const [cat, n] of Object.entries(def.ai)) {
        ai[cat] = Math.max(0, Math.round(n * aiScale(c.pop)) + randInt(rng, -1, 1));
      }
      const district = { id, placeId: c.id, type, lat: center.lat, lng: center.lng, radius: 800, lotIds: [], ai };
      districts[id] = district;
      place.districtIds.push(id);
      const n = randInt(rng, def.lots[0], def.lots[1]);
      for (let k = 0; k < n; k++) {
        addLot(district, place, type, randRange(rng, 80, 650), rand(rng) * Math.PI * 2);
      }
    });
  }

  for (const r of REGIONS) {
    const place = { ...r, kind: 'region', districtIds: [] };
    places[r.id] = place;
    const id = `${r.id}:1`;
    const district = { id, placeId: r.id, type: 'rural', lat: r.lat, lng: r.lng, radius: 20000, lotIds: [], ai: {} };
    districts[id] = district;
    place.districtIds.push(id);
    const n = randInt(rng, DISTRICTS.rural.lots[0], DISTRICTS.rural.lots[1]);
    for (let k = 0; k < n; k++) {
      addLot(district, place, 'rural', randRange(rng, 3000, 18000), rand(rng) * Math.PI * 2);
    }
  }

  return { places, districts, lots };
}

// Индекс стоимости строительства/оборудования в месте
export function costIndex(place) {
  if (place.kind === 'city') return 0.5 + 0.5 * place.rent;
  return 0.5 + 0.5 * (place.wage + 0.3);
}

// Индекс розничных цен (сколько местные готовы платить)
export function priceIndex(place) {
  return 0.35 + 0.65 * (place.income ?? 0.5);
}
