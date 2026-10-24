import { BUSINESSES } from '../data/businesses.js';
import { districtShares, utility, refPrice } from './demand.js';
import { buyPrice, sellPrice } from './market.js';
import { costIndex } from './world.js';
import { capexFor, dailyNeed } from './units.js';

const FORECAST_AWARENESS = 0.35; // узнаваемость через пару месяцев при стандартной рекламе

export function canBuildHere(state, lot, type) {
  const def = BUSINESSES[type];
  if (def.zoning !== lot.zoning) return false;
  if (lot.zoning === 'farmland') return state.world.places[lot.placeId].kinds.includes(type);
  return true;
}

export function buildableTypes(state, lot) {
  return Object.keys(BUSINESSES).filter((t) => canBuildHere(state, lot, t));
}

// Прогноз месячной экономики бизнеса типа type на участке lot.
export function forecast(state, lotId, type, companyId = null) {
  const lot = state.world.lots[lotId];
  const def = BUSINESSES[type];
  const place = state.world.places[lot.placeId];
  const idx = costIndex(place);
  const r = { type, capex: capexFor(state, lot, type), customers: 0, produced: 0, staff: def.staff.def };

  let served = 0;
  let produced = 0;
  let revenueDay = 0;
  if (def.retail) {
    const district = state.world.districts[lot.districtId];
    const u = utility(1, 3, FORECAST_AWARENESS, lot.visibility);
    const sh = districtShares(state, district, def.category, { id: '__new', u });
    const potential = sh.byUnit.__new;
    const staff = Math.min(def.staff.max, Math.max(def.staff.min, Math.ceil(potential / def.retail.perStaff)));
    r.staff = staff;
    served = Math.min(potential, staff * def.retail.perStaff, def.retail.cap[0]);
    r.customers = Math.round(served);
    r.competitors = sh.ai + Object.keys(sh.byUnit).length - 1;
    for (const p of def.retail.products) revenueDay += served * p.attach * refPrice(place, p);
  }
  if (def.production) {
    const p = def.production;
    const staff = r.staff;
    const cap = p.cap ? p.cap[0] : p.capPerArea * lot.area;
    produced = Math.min(staff * p.perStaff * (place.productivity ?? 1), cap);
    r.produced = Math.round(produced);
    const out = p.recipe.output;
    let ownUse = 0;
    if (def.retail) for (const pr of def.retail.products) ownUse += (pr.recipe[out] || 0) * pr.attach * served;
    r.output = out;
    r.outputPrice = sellPrice(state, out);
    revenueDay += Math.max(0, produced - ownUse) * r.outputPrice;
  }
  const need = dailyNeed({ type }, served, produced);
  let inputsDay = 0;
  for (const [g, q] of Object.entries(need)) inputsDay += q * buyPrice(state, g, place);

  r.revenue = Math.round(revenueDay * 30);
  r.costs = {
    inputs: Math.round(inputsDay * 30),
    wages: Math.round(r.staff * def.staff.wage * place.wage),
    rent: companyId && lot.ownerId === companyId ? 0 : lot.rent,
    upkeep: Math.round((def.upkeep.base + def.upkeep.perArea * lot.area) * idx),
    marketing: Math.round(def.marketing * idx),
  };
  const totalCosts = Object.values(r.costs).reduce((a, b) => a + b, 0);
  r.profit = r.revenue - totalCosts;
  r.payback = r.profit > 0 ? r.capex / r.profit : Infinity;
  return r;
}
