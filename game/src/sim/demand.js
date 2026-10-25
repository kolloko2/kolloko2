import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS, SEGMENTS } from '../data/districts.js';
import { priceIndex } from './world.js';
import { effectiveAwareness } from './brands.js';
import { countryDemand } from './countries.js';
import { dateOf } from './state.js';
import { trendOf, districtEventOf } from './luck.js';
import { shopsIn } from './shops.js';
import { activeProducts } from './units.js';

// Логит-модель выбора покупателя:
//   U = −βp·ln(цена/норма) + βq·(качество − 3) + βa·узнаваемость + βv·(видимость − 0.5)
//   доля продавца = e^U / (Σ e^U конкурентов + e^U0), где U0 — «ничего не покупать»
export const BETA_PRICE = 2.5;
export const BETA_QUALITY = 0.6;
export const BETA_AWARENESS = 1.5;
export const BETA_VISIBILITY = 0.5;
export const U_OUTSIDE = 1.0;
export const AI_AWARENESS = 0.5;
export const BETA_ASSORTMENT = 0.08; // за каждый товар сверх основного
export const BETA_LOYALTY = 1.0; // лояльные покупатели возвращаются, даже если рядом дешевле
export const SHOP_LOYALTY = 0.3; // лояльность у фоновых конкурентов

// Полезность для сегмента покупателей: t — слагаемые продавца (цена к норме, рейтинг, известность, видимость, бонус)
export function segUtility(t, beta, seg) {
  return -beta * seg.p * Math.log(Math.max(t.pr, 0.05)) + BETA_QUALITY * seg.q * (t.q - 3) + BETA_AWARENESS * t.a
    + BETA_VISIBILITY * (t.vis - 0.5) + (t.bonus || 0);
}

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
  clothing: [1.1, 0.85, 0.95, 1.0, 1.0, 0.95, 1.05, 1.1, 1.05, 0.95, 1.05, 1.3],
  kids: [0.7, 0.75, 0.85, 0.9, 0.95, 1.0, 0.95, 1.05, 1.05, 0.95, 1.15, 1.7],
  sports: [1.15, 0.9, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.85, 0.85, 1.05],
  diy: [0.75, 0.8, 1.0, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.85, 0.75],
  home: [0.9, 0.9, 1.0, 1.0, 1.0, 0.95, 0.95, 1.0, 1.05, 1.0, 1.1, 1.15],
  luxury: [0.8, 1.1, 1.0, 0.9, 1.0, 0.95, 0.9, 0.9, 0.95, 1.0, 1.05, 1.5],
  bar: [0.85, 0.9, 0.95, 1.0, 1.05, 1.12, 1.18, 1.15, 1.0, 0.95, 0.92, 1.15],
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
  const traffic = district.footfall ?? 0;
  const event = districtEventOf(state, district.id)?.mult ?? 1;
  const econ = countryDemand(state, place.country);
  // отелям нужны туристы; дорогие покупки (машины) сильнее страдают в кризис
  const special = category === 'hotel' ? 1.5 * (place.tourism ?? 0.3) : category === 'cars' || category === 'luxury' ? econ : category === 'bar' ? 0.7 + 0.6 * (place.tourism ?? 0.3) : 1;
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
  const place = state.world.places[unit.placeId];
  let num = 0;
  let den = 0;
  for (const p of activeProducts(unit)) {
    const ref = refPrice(place, p);
    num += p.attach * (unit.prices[p.id] ?? ref);
    den += p.attach * ref;
  }
  return num / den;
}

export function districtBeta(district) {
  return DISTRICTS[district.type].priceSensitivity ?? BETA_PRICE;
}

// Слагаемые полезности точки: цена к норме, рейтинг, известность (с брендом сети), видимость,
// бонус за ассортимент и лояльность покупателей
export function unitTerms(state, unit) {
  const lot = state.world.lots[unit.lotId];
  return {
    pr: unitPriceRatio(state, unit), q: unit.quality, a: effectiveAwareness(state, unit), vis: lot.visibility,
    bonus: BETA_ASSORTMENT * (activeProducts(unit).length - 1) + BETA_LOYALTY * (unit.loyalty ?? SHOP_LOYALTY),
  };
}

export function unitUtility(state, unit) {
  const d = state.world.districts[state.world.lots[unit.lotId].districtId];
  return segUtility(unitTerms(state, unit), districtBeta(d), SEGMENTS.mid);
}

export const shopTerms = (sh) => ({ pr: sh.p, q: sh.q, a: sh.a, vis: 0.5, bonus: BETA_LOYALTY * SHOP_LOYALTY });

// Распределение покупателей района между продавцами категории — отдельно по сегментам (эконом, средний, премиум).
// extra — гипотетический продавец (для прогноза): { id, t } (слагаемые) или { id, u }
/** @param {any} state @param {any} district @param {string} category @param {{ id: string, t?: any, u?: number }|null} [extra] */
export function districtShares(state, district, category, extra = null) {
  const potential = districtPotential(state, district, category);
  /** @type {{ id: string, t?: any, u?: number }[]} */
  const sellers = [];
  for (const lotId of district.lotIds) {
    const lot = state.world.lots[lotId];
    if (!lot.unitId) continue;
    const unit = state.units[lot.unitId];
    if (!unit || !BUSINESSES[unit.type].retail || BUSINESSES[unit.type].category !== category) continue;
    if (unit.broken > 0) continue;
    sellers.push({ id: unit.id, t: unitTerms(state, unit) });
  }
  if (extra) sellers.push(extra);
  const beta = districtBeta(district);
  const shops = shopsIn(state, district, category);
  const shopT = shops.map(shopTerms);
  const mix = DISTRICTS[district.type].segments || { mid: 1 };
  const result = { potential, ai: shops.length, aiCustomersEach: 0, outsideShare: 0, byUnit: {}, byShop: {}, bySeg: {} };
  for (const s of sellers) {
    result.byUnit[s.id] = 0;
    result.bySeg[s.id] = {};
  }
  for (const sh of shops) result.byShop[sh.id] = 0;
  let shopSum = 0;
  for (const [segId, share] of Object.entries(mix)) {
    if (!share) continue;
    const seg = SEGMENTS[segId];
    const pot = potential * share;
    const eOut = Math.exp(U_OUTSIDE);
    const eShops = shopT.map((t) => Math.exp(segUtility(t, beta, seg)));
    const eSellers = sellers.map((s) => Math.exp(s.t ? segUtility(s.t, beta, seg) : (s.u ?? 0)));
    const total = eOut + eShops.reduce((a, b) => a + b, 0) + eSellers.reduce((a, b) => a + b, 0);
    result.outsideShare += share * (eOut / total);
    shops.forEach((sh, i) => {
      const v = (pot * eShops[i]) / total;
      result.byShop[sh.id] += v;
      shopSum += v;
    });
    sellers.forEach((s, i) => {
      const v = (pot * eSellers[i]) / total;
      result.byUnit[s.id] += v;
      result.bySeg[s.id][segId] = v;
    });
  }
  result.aiCustomersEach = shops.length ? shopSum / shops.length : 0;
  return result;
}
