import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { priceIndex } from './world.js';

// Логит-модель выбора покупателя:
//   U = −βp·ln(цена/норма) + βq·(качество − 3) + βa·узнаваемость + βv·(видимость − 0.5)
//   доля продавца = e^U / (Σ e^U конкурентов + e^U0), где U0 — «ничего не покупать»
export const BETA_PRICE = 2.5;
export const BETA_QUALITY = 0.6;
export const BETA_AWARENESS = 1.5;
export const BETA_VISIBILITY = 0.5;
export const U_OUTSIDE = 1.0;
export const AI_AWARENESS = 0.5;

export function utility(priceRatio, quality, awareness, visibility) {
  return (
    -BETA_PRICE * Math.log(Math.max(priceRatio, 0.05)) +
    BETA_QUALITY * (quality - 3) +
    BETA_AWARENESS * awareness +
    BETA_VISIBILITY * (visibility - 0.5)
  );
}

export const AI_UTILITY = utility(1, 3, AI_AWARENESS, 0.5);

// Сколько покупателей категории проходит через район за день
export function districtPotential(state, district, category) {
  const def = DISTRICTS[district.type];
  const rate = def.demand[category] || 0;
  if (!rate) return 0;
  const place = state.world.places[district.placeId];
  const incomeFactor = 0.5 + 0.5 * Math.min(place.income ?? 0.5, 1.2);
  let traffic = 0;
  for (const lotId of district.lotIds) traffic += state.world.lots[lotId].traffic;
  return traffic * rate * incomeFactor;
}

// Норма цены продукта в месте
export function refPrice(place, product) {
  return Math.round(product.ref * priceIndex(place) * 100) / 100;
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

export function unitUtility(state, unit) {
  const lot = state.world.lots[unit.lotId];
  return utility(unitPriceRatio(state, unit), unit.quality, unit.awareness, lot.visibility);
}

// Распределение покупателей района между продавцами категории.
// extra — гипотетический продавец (для прогноза): { id, u }
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
  const eAi = Math.exp(AI_UTILITY);
  let total = Math.exp(U_OUTSIDE) + ai * eAi;
  for (const s of sellers) total += Math.exp(s.u);
  const result = { potential, ai, aiCustomersEach: (potential * eAi) / total, outsideShare: Math.exp(U_OUTSIDE) / total, byUnit: {} };
  for (const s of sellers) result.byUnit[s.id] = (potential * Math.exp(s.u)) / total;
  return result;
}
