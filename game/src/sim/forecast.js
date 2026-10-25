import { BUSINESSES } from '../data/businesses.js';
import { districtShares, utility, refPrice, districtBeta, seasonFactor } from './demand.js';
import { BRAND_TIERS, brandAwareness, presenceTarget, brandAds } from './brands.js';
import {
  entryFee, presenceIn, purchasingDiscount, isConsumer, marginalOverhead, FOREIGN_COST, LOCAL_TEAM_UNITS,
} from './expansion.js';
import { buyPrice, sellPrice } from './market.js';
import { costIndex } from './world.js';
import { capexFor, dailyNeed, allowedRecipes, recipeOf, techOutput } from './units.js';
import { serviceRevenuePerStaff, realEstateRentFor } from './services.js';
import { licenseNeeded, countryDemand } from './countries.js';
import { attention } from './staff.js';
import { techLevel, missingTech } from './research.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

const FORECAST_AWARENESS = 0.35; // узнаваемость через пару месяцев при стандартной рекламе

export function canBuildHere(state, lot, type) {
  const def = BUSINESSES[type];
  if (def.zoning !== lot.zoning) return false;
  if (def.minArea && lot.area < def.minArea) return false;
  if (lot.zoning === 'farmland') return state.world.places[lot.placeId].kinds.includes(type) && allowedRecipes(state.world.places[lot.placeId], type).length > 0;
  if (def.onlyPort || def.service?.onlyPort) return Boolean(state.world.places[lot.placeId].port);
  return true;
}

export function buildableTypes(state, lot) {
  return Object.keys(BUSINESSES).filter((t) => canBuildHere(state, lot, t));
}

// Сеть, в которую попадёт новая точка: brandId === undefined — первая сеть этого типа, null — без сети
export function forecastBrand(state, companyId, type, brandId) {
  if (!companyId || brandId === null) return null;
  if (brandId) return state.brands[brandId] || null;
  return Object.values(state.brands).find((b) => b.companyId === companyId && b.type === type) || null;
}

// Прогноз месячной экономики бизнеса типа type на участке lot.
// У заводов с выбором продукции без recipe — лучший из доступных вариантов (r.variants — все варианты).
/** @param {any} state @param {string} lotId @param {string} type @param {string|null} [companyId] @param {string|null} [brandId] @param {string} [recipe] @returns {any} */
export function forecast(state, lotId, type, companyId = null, brandId = undefined, recipe = undefined) {
  const lot = state.world.lots[lotId];
  const def = BUSINESSES[type];
  const place = state.world.places[lot.placeId];
  if (def.production?.recipes && !recipe) {
    const all = allowedRecipes(place, type).map((out) => forecast(state, lotId, type, companyId, brandId, out));
    if (!all.length) return forecast(state, lotId, type, companyId, brandId, Object.keys(def.production.recipes)[0]);
    const best = all.reduce((a, b) => (b.profit > a.profit ? b : a));
    best.variants = all.map((f) => ({ output: f.recipe, profit: f.profit, payback: f.payback }));
    return best;
  }
  const idx = costIndex(place);
  /** @type {any} */
  const r = { type, capex: capexFor(state, lot, type), customers: 0, produced: 0, staff: def.staff.def, recipe: recipe ?? null };
  const brand = forecastBrand(state, companyId, type, brandId);
  const tier = brand ? BRAND_TIERS[brand.tier] : null;
  r.brandId = brand?.id ?? null;
  r.entryFee = companyId ? entryFee(state, companyId, place, type) : 0;
  r.license = licenseNeeded(state, companyId, place, type);
  r.locked = missingTech(state, companyId, type); // нужна технология
  r.extra = r.entryFee + (r.license?.cost ?? 0); // разовые платежи сверх вложений
  // без местной команды (меньше 3 точек в чужой стране) зарплаты и содержание дороже
  const co = companyId ? state.companies[companyId] : null;
  const foreign = co && co.homeCountry && co.homeCountry !== place.country && isConsumer(type)
    && presenceIn(state, companyId, place.country).consumer + 1 < LOCAL_TEAM_UNITS ? FOREIGN_COST : 1;
  r.foreign = foreign > 1;

  // без управляющего точка делит внимание владельца с остальными: если его не хватает — работает медленнее
  let eff = 1.06; // мораль новичков 65
  if (co) {
    const att = attention(state, companyId);
    const excess = Math.max(0, Math.ceil(att.used + (brand ? 0.5 : 1) - att.limit));
    eff *= Math.max(0.6, 1 - 0.04 * excess);
    r.efficiency = eff;
    if (def.retail) eff *= (1 + 0.08 * techLevel(state, companyId, 'pos')) * (1 + 0.05 * techLevel(state, companyId, 'ai'));
    if (def.production) eff *= techOutput(state, co.id, type);
  }
  let served = 0;
  let produced = 0;
  let revenueDay = 0;
  if (def.retail) {
    const district = state.world.districts[lot.districtId];
    let ratio = 1;
    let awareness = FORECAST_AWARENESS;
    if (brand) {
      let num = 0;
      let den = 0;
      for (const p of def.retail.products) {
        num += p.attach * (brand.priceRatio[p.id] ?? 1);
        den += p.attach;
      }
      ratio = num / den;
      // узнаваемость сети в городе с учётом новой точки
      let nCity = 0;
      let nCountry = 0;
      for (const u of Object.values(state.units)) {
        if (u.brandId !== brand.id) continue;
        if (u.placeId === place.id) nCity++;
        else if (state.world.places[u.placeId].country === place.country) nCountry++;
      }
      const b = Math.max(brandAwareness(brand, place.id), presenceTarget(nCity + 1, nCountry));
      awareness = 1 - (1 - FORECAST_AWARENESS) * (1 - b);
      r.brandAwareness = b;
    }
    const techQ = companyId ? 0.15 * techLevel(state, companyId, 'quality') : 0;
    const u = utility(ratio, (def.baseQuality ?? 3) + (tier?.quality ?? 0) + techQ, awareness, lot.visibility, districtBeta(district));
    const sh = districtShares(state, district, def.category, { id: '__new', u });
    const potential = sh.byUnit.__new / seasonFactor(state, def.category, place); // прогноз — в среднем за год, без сезона
    const staff = Math.min(def.staff.max, Math.max(def.staff.min, Math.ceil(potential / (def.retail.perStaff * eff))));
    r.staff = staff;
    served = Math.min(potential, staff * def.retail.perStaff * eff, def.retail.cap[0]);
    r.customers = Math.round(served);
    r.competitors = sh.ai + Object.keys(sh.byUnit).length - 1;
    for (const p of def.retail.products) revenueDay += served * p.attach * refPrice(place, p) * (brand?.priceRatio[p.id] ?? 1);
  }
  if (def.production) {
    const p = def.production;
    const rec = /** @type {import("./units.js").Recipe} */ (recipeOf({ type, recipe }));
    const rate = rec.rate ?? 1;
    const cap = (p.cap ? p.cap[0] : p.capPerArea * lot.area) * rate;
    // производство без витрины — штат под полную мощность первого уровня
    if (!def.retail) r.staff = Math.min(def.staff.max, Math.max(def.staff.min, Math.ceil(cap / (p.perStaff * rate * (place.productivity ?? 1)))));
    const staff = r.staff;
    produced = Math.min(staff * p.perStaff * rate * (place.productivity ?? 1) * eff, cap);
    r.produced = Math.round(produced);
    const out = rec.output;
    let ownUse = 0;
    if (def.retail) for (const pr of def.retail.products) ownUse += (pr.recipe[out] || 0) * pr.attach * served;
    r.output = out;
    r.outputPrice = sellPrice(state, out, place);
    revenueDay += Math.max(0, produced - ownUse) * r.outputPrice;
  }
  if (def.service?.realEstate) {
    revenueDay += (realEstateRentFor(state, lot, type) / 30) * 0.88;
    r.service = true;
  } else if (def.service) {
    revenueDay += r.staff * serviceRevenuePerStaff(state, def, place, type) * countryDemand(state, place.country) ** (def.service.cycle ?? 1);
    r.service = true;
  }
  const need = dailyNeed({ type, staff: r.staff, recipe }, served, produced);
  let inputsDay = 0;
  const discount = companyId ? purchasingDiscount(state, companyId, place) : 0;
  for (const [g, q] of Object.entries(need)) inputsDay += q * buyPrice(state, g, place) * (1 - discount);

  r.revenue = Math.round(revenueDay * 30);
  r.costs = {
    inputs: Math.round(inputsDay * 30),
    wages: Math.round(r.staff * def.staff.wage * place.wage * (brand?.wageLevel ?? 1) * foreign),
    rent: companyId && lot.ownerId === companyId ? 0 : lot.rent,
    upkeep: Math.round((def.upkeep.base + def.upkeep.perArea * lot.area) * idx * foreign * (tier?.upkeep ?? 1) * (1 - 0.08 * (companyId ? techLevel(state, companyId, 'energy') : 0))),
    marketing: Math.round((brand ? Object.values(brandAds(brand)).reduce((a, b) => a + b, 0) : def.marketing) * idx),
    overhead: companyId ? Math.round(marginalOverhead(state, companyId, Boolean(brand))) : 0, // рост расходов штаба
  };
  const totalCosts = Object.values(r.costs).reduce((a, b) => a + b, 0);
  r.profit = r.revenue - totalCosts;
  r.payback = r.profit > 0 ? (r.capex + r.extra) / r.profit : Infinity;
  return r;
}

// Поиск мест: лучшие свободные участки для типа бизнеса в стране (или во всём мире) по окупаемости
export function searchLots(state, companyId, type, country = null, limit = 15) {
  const out = [];
  for (const lot of Object.values(state.world.lots)) {
    if (lot.unitId || (lot.ownerId && lot.ownerId !== companyId)) continue;
    const place = state.world.places[lot.placeId];
    if (country && place.country !== country) continue;
    if (!canBuildHere(state, lot, type)) continue;
    const f = forecast(state, lot.id, type, companyId);
    if (f.profit <= 0) continue;
    out.push({ lotId: lot.id, placeId: lot.placeId, districtId: lot.districtId, profit: f.profit, payback: f.payback, cost: f.capex + f.extra, locked: f.locked });
  }
  return out.sort((a, b) => a.payback - b.payback).slice(0, limit);
}
