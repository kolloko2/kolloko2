import { BUSINESSES } from '../data/businesses.js';
import { refPrice } from './demand.js';
import { costIndex } from './world.js';

// Сети (бренды): точки одного типа с общими настройками и общей узнаваемостью.
// Цены сети задаются в долях от местной нормы — поэтому сами подстраиваются под город.
export const BRAND_TIERS = {
  eco: { name: 'Эконом', price: 0.85, quality: -0.2, upkeep: 0.9 },
  std: { name: 'Стандарт', price: 1.0, quality: 0, upkeep: 1 },
  premium: { name: 'Премиум', price: 1.35, quality: 0.5, upkeep: 1.25 },
};

export function brandOf(state, unit) {
  return unit.brandId ? state.brands[unit.brandId] || null : null;
}

export function brandUnits(state, brand) {
  return Object.values(state.units).filter((u) => u.brandId === brand.id);
}

export function newBrand(state, companyId, { name, businessType, tier }) {
  const def = BUSINESSES[businessType];
  const t = BRAND_TIERS[tier];
  const id = `b${state.nextBrandId++}`;
  const priceRatio = {};
  for (const p of def.retail?.products || []) priceRatio[p.id] = t.price;
  state.brands[id] = {
    id,
    companyId,
    name,
    type: businessType,
    tier,
    priceRatio,
    marketing: Math.round(def.marketing * (tier === 'premium' ? 1.5 : tier === 'eco' ? 0.7 : 1)), // на точку, при индексе цен 1
    wageLevel: tier === 'premium' ? 1.2 : 1,
    national: {}, // страна → бюджет национальной рекламы в месяц
    awareness: {}, // город → { p: эффект присутствия, ads: эффект нац. рекламы }
  };
  return state.brands[id];
}

// Записать настройки сети в её точки (цены — от местной нормы каждого города)
export function applyBrand(state, brand) {
  const def = BUSINESSES[brand.type];
  const t = BRAND_TIERS[brand.tier];
  for (const u of brandUnits(state, brand)) {
    const place = state.world.places[u.placeId];
    for (const p of def.retail?.products || []) u.prices[p.id] = Math.round(refPrice(place, p) * (brand.priceRatio[p.id] ?? 1) * 100) / 100;
    u.marketing = Math.round(brand.marketing * costIndex(place));
    u.wageLevel = brand.wageLevel;
    u.tierQuality = t.quality;
    u.tierUpkeep = t.upkeep;
  }
}

export function detachFromBrand(unit) {
  unit.brandId = null;
  unit.tierQuality = 0;
  unit.tierUpkeep = 1;
}

// Узнаваемость бренда в городе (0..1)
export function brandAwareness(brand, placeId) {
  const a = brand?.awareness[placeId];
  return a ? 1 - (1 - a.p) * (1 - a.ads) : 0;
}

// Итоговая узнаваемость точки: своя (вывеска, местная реклама) + бренда сети в этом городе
export function effectiveAwareness(state, unit) {
  const b = brandAwareness(brandOf(state, unit), unit.placeId);
  return 1 - (1 - unit.awareness) * (1 - b);
}

// Цель узнаваемости от присутствия: одна точка — 0, несколько в городе — заметно, точки в стране — немного
export function presenceTarget(nCity, nCountryOther) {
  return Math.min(0.75, 0.13 * Math.max(0, nCity - 1) ** 0.85 + 0.04 * nCountryOther);
}

// Раз в день: узнаваемость брендов по городам и расход на национальную рекламу
export function updateBrands(state, spendCompany) {
  for (const brand of Object.values(state.brands)) {
    const members = brandUnits(state, brand);
    const byCity = {};
    const byCountry = {};
    for (const u of members) {
      byCity[u.placeId] = (byCity[u.placeId] || 0) + 1;
      const c = state.world.places[u.placeId].country;
      byCountry[c] = (byCountry[c] || 0) + 1;
    }
    for (const [country, budget] of Object.entries(brand.national)) {
      if (budget > 0 && byCountry[country]) spendCompany(state, brand.companyId, 'brandAds', budget / 30);
    }
    const places = new Set([...Object.keys(byCity), ...Object.keys(brand.awareness)]);
    for (const placeId of places) {
      const place = state.world.places[placeId];
      const nCity = byCity[placeId] || 0;
      const nCountry = byCountry[place.country] || 0;
      const a = (brand.awareness[placeId] ||= { p: 0, ads: 0 });
      a.p += (presenceTarget(nCity, nCountry - nCity) - a.p) * 0.03;
      const budget = nCountry ? brand.national[place.country] || 0 : 0;
      const gain = 1 - Math.exp(-0.00012 * (budget / 30 / costIndex(place)));
      a.ads += (1 - a.ads) * gain - 0.006 * a.ads;
      if (!nCity && a.p < 0.01 && a.ads < 0.01) delete brand.awareness[placeId];
    }
  }
}
