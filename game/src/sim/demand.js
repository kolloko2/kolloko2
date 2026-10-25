import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { priceIndex } from './world.js';
import { effectiveAwareness } from './brands.js';
import { countryDemand } from './countries.js';
import { dateOf } from './state.js';
import { trendOf, districtEventOf } from './luck.js';

// Логит-модель выбора покупателя:
//   U = −βp·ln(цена/норма) + βq·(качество − 3) + βa·узнаваемость + βv·(видимость − 0.5)
//   доля продавца = e^U / (Σ e^U конкурентов + e^U0), где U0 — «ничего не покупать»
export const BETA_PRICE = 2.5;
export const BETA_QUALITY = 0.6;
export const BETA_AWARENESS = 1.5;
export const BETA_VISIBILITY = 0.5;
export const U_OUTSIDE = 1.0;
export const AI_AWARENESS = 0.5;

export function utility(priceRatio, quality, awareness, visibility, betaPrice = BETA_PRICE) {
  return (
    -betaPrice * Math.log(Math.max(priceRatio, 0.05)) +
    BETA_QUALITY * (quality - 3) +
    BETA_AWARENESS * awareness +
    BETA_VISIBILITY * (visibility - 0.5)
  );
}

export const AI_UTILITY = utility(1, 3, AI_AWARENESS, 0.5);

// Фоновые конкуренты со временем становятся сильнее: рынок взрослеет, сети учатся.
// Через 30 лет средний конкурент — 3.5★ и узнаваемость 60%: старые точки без обновлений проигрывают.
// (Настоящих соперников теперь дают ИИ-корпорации, поэтому фон взрослеет мягко.)
export function aiUtility(state) {
  const years = state.day / 365;
  return utility(1, 3 + Math.min(0.5, years * 0.015), AI_AWARENESS + Math.min(0.1, years * 0.004), 0.5);
}

// Сезонность спроса по месяцам (северное полушарие; в южном — со сдвигом на полгода)
const SEASON = {
  coffee: [1.12, 1.1, 1.04, 0.98, 0.93, 0.88, 0.85, 0.87, 0.97, 1.04, 1.09, 1.13],
  fastfood: [0.9, 0.9, 0.95, 1.0, 1.06, 1.1, 1.13, 1.12, 1.02, 0.97, 0.92, 0.93],
  grocery: [0.96, 0.95, 0.98, 1.0, 1.0, 0.99, 0.98, 0.99, 1.0, 1.0, 1.02, 1.13],
  bakery: [1.04, 1.02, 1.02, 1.0, 0.97, 0.95, 0.94, 0.95, 1.0, 1.02, 1.03, 1.06],
  restaurant: [0.85, 0.9, 0.97, 1.0, 1.05, 1.06, 1.04, 1.0, 1.0, 1.0, 1.0, 1.25],
  electronics: [0.9, 0.85, 0.9, 0.92, 0.95, 0.95, 0.95, 1.0, 1.05, 1.0, 1.15, 1.4],
  hotel: [0.7, 0.72, 0.85, 0.95, 1.05, 1.25, 1.4, 1.4, 1.1, 0.95, 0.8, 0.95],
  fitness: [1.3, 1.15, 1.05, 1.05, 1.1, 0.95, 0.8, 0.8, 1.0, 1.0, 0.95, 0.85],
  pharmacy: [1.15, 1.15, 1.05, 1.0, 0.95, 0.9, 0.9, 0.9, 0.95, 1.0, 1.05, 1.1],
  cars: [0.8, 0.85, 1.05, 1.1, 1.1, 1.05, 1.0, 0.95, 1.0, 1.0, 0.95, 1.1],
  fuel: [0.92, 0.92, 0.96, 1.0, 1.05, 1.1, 1.14, 1.12, 1.0, 0.97, 0.94, 0.98],
};

export function seasonFactor(state, category, place) {
  const s = SEASON[category];
  if (!s) return 1;
  const m = dateOf(state.day).getUTCMonth();
  return s[place.lat < 0 ? (m + 6) % 12 : m];
}

// Сколько покупателей категории проходит через район за день
export function districtPotential(state, district, category) {
  const def = DISTRICTS[district.type];
  const rate = def.demand[category] || 0;
  if (!rate) return 0;
  const place = state.world.places[district.placeId];
  const incomeFactor = 0.5 + 0.5 * Math.min(place.income ?? 0.5, 1.2);
  let traffic = 0;
  for (const lotId of district.lotIds) traffic += state.world.lots[lotId].traffic;
  const event = districtEventOf(state, district.id)?.mult ?? 1;
  const econ = countryDemand(state, place.country);
  // отелям нужны туристы; дорогие покупки (машины) сильнее страдают в кризис
  const special = category === 'hotel' ? 1.5 * (place.tourism ?? 0.3) : category === 'cars' ? econ : 1;
  return traffic * rate * incomeFactor * econ * special * seasonFactor(state, category, place)
    * trendOf(state, place.country, category) * event * (state.growth?.[place.id] ?? 1);
}

// Норма цены продукта в месте
export function refPrice(place, product) {
  const t = product.tradable ?? 0;
  return Math.round(product.ref * (t + (1 - t) * priceIndex(place)) * (place.cpi ?? 1) * 100) / 100;
}

// Взвешенное отношение цен юнита к местной норме
export function unitPriceRatio(state, unit) {
  const def = BUSINESSES[unit.type];
  const place = state.world.places[unit.placeId];
  let num = 0;
  let den = 0;
  for (const p of def.retail.products) {
    const ref = refPrice(place, p);
    num += p.attach * (unit.prices[p.id] ?? ref);
    den += p.attach * ref;
  }
  return num / den;
}

export function districtBeta(district) {
  return DISTRICTS[district.type].priceSensitivity ?? BETA_PRICE;
}

// Узнаваемость точки учитывает бренд сети в этом городе
export function unitUtility(state, unit) {
  const lot = state.world.lots[unit.lotId];
  const beta = districtBeta(state.world.districts[lot.districtId]);
  return utility(unitPriceRatio(state, unit), unit.quality, effectiveAwareness(state, unit), lot.visibility, beta);
}

// Распределение покупателей района между продавцами категории.
// extra — гипотетический продавец (для прогноза): { id, u }
/** @param {any} state @param {any} district @param {string} category @param {{ id: string, u: number }|null} [extra] */
export function districtShares(state, district, category, extra = null) {
  const potential = districtPotential(state, district, category);
  const sellers = [];
  for (const lotId of district.lotIds) {
    const lot = state.world.lots[lotId];
    if (!lot.unitId) continue;
    const unit = state.units[lot.unitId];
    if (!unit || !BUSINESSES[unit.type].retail || BUSINESSES[unit.type].category !== category) continue;
    if (unit.broken > 0) continue;
    sellers.push({ id: unit.id, u: unitUtility(state, unit) });
  }
  if (extra) sellers.push(extra);
  const ai = district.ai[category] || 0;
  const eAi = Math.exp(aiUtility(state));
  let total = Math.exp(U_OUTSIDE) + ai * eAi;
  for (const s of sellers) total += Math.exp(s.u);
  const result = { potential, ai, aiCustomersEach: (potential * eAi) / total, outsideShare: Math.exp(U_OUTSIDE) / total, byUnit: {} };
  for (const s of sellers) result.byUnit[s.id] = (potential * Math.exp(s.u)) / total;
  return result;
}
