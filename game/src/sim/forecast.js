import { BUSINESSES } from '../data/businesses.js';
import { districtShares, utility, refPrice, districtBeta } from './demand.js';
import { BRAND_TIERS, brandAwareness, presenceTarget } from './brands.js';
import { entryFee, presenceIn, purchasingDiscount, isConsumer, FOREIGN_COST, LOCAL_TEAM_UNITS } from './expansion.js';
import { buyPrice, sellPrice } from './market.js';
import { costIndex } from './world.js';
import { capexFor, dailyNeed } from './units.js';
import { serviceRevenuePerStaff } from './services.js';
import { licenseNeeded } from './countries.js';

const FORECAST_AWARENESS = 0.35; // узнаваемость через пару месяцев при стандартной рекламе

export function canBuildHere(state, lot, type) {
  const def = BUSINESSES[type];
  if (def.zoning !== lot.zoning) return false;
  if (def.minArea && lot.area < def.minArea) return false;
  if (lot.zoning === 'farmland') return state.world.places[lot.placeId].kinds.includes(type);
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
export function forecast(state, lotId, type, companyId = null, brandId = undefined) {
  const lot = state.world.lots[lotId];
  const def = BUSINESSES[type];
  const place = state.world.places[lot.placeId];
  const idx = costIndex(place);
  const r = { type, capex: capexFor(state, lot, type), customers: 0, produced: 0, staff: def.staff.def };
  const brand = forecastBrand(state, companyId, type, brandId);
  const tier = brand ? BRAND_TIERS[brand.tier] : null;
  r.brandId = brand?.id ?? null;
  r.entryFee = companyId ? entryFee(state, companyId, place, type) : 0;
  r.license = licenseNeeded(state, companyId, place, type);
  r.extra = r.entryFee + (r.license?.cost ?? 0); // разовые платежи сверх вложений
  // без местной команды (меньше 3 точек в чужой стране) зарплаты и содержание дороже
  const co = companyId ? state.companies[companyId] : null;
  const foreign = co && co.homeCountry && co.homeCountry !== place.country && isConsumer(type)
    && presenceIn(state, companyId, place.country).consumer + 1 < LOCAL_TEAM_UNITS ? FOREIGN_COST : 1;
  r.foreign = foreign > 1;

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
    const u = utility(ratio, 3 + (tier?.quality ?? 0), awareness, lot.visibility, districtBeta(district));
    const sh = districtShares(state, district, def.category, { id: '__new', u });
    const potential = sh.byUnit.__new;
    const staff = Math.min(def.staff.max, Math.max(def.staff.min, Math.ceil(potential / def.retail.perStaff)));
    r.staff = staff;
    served = Math.min(potential, staff * def.retail.perStaff, def.retail.cap[0]);
    r.customers = Math.round(served);
    r.competitors = sh.ai + Object.keys(sh.byUnit).length - 1;
    for (const p of def.retail.products) revenueDay += served * p.attach * refPrice(place, p) * (brand?.priceRatio[p.id] ?? 1);
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
    r.outputPrice = sellPrice(state, out, place);
    revenueDay += Math.max(0, produced - ownUse) * r.outputPrice;
  }
  if (def.service) {
    revenueDay += r.staff * serviceRevenuePerStaff(state, def, place, type);
    r.service = true;
  }
  const need = dailyNeed({ type, staff: r.staff }, served, produced);
  let inputsDay = 0;
  const discount = companyId ? purchasingDiscount(state, companyId, place) : 0;
  for (const [g, q] of Object.entries(need)) inputsDay += q * buyPrice(state, g, place) * (1 - discount);

  r.revenue = Math.round(revenueDay * 30);
  r.costs = {
    inputs: Math.round(inputsDay * 30),
    wages: Math.round(r.staff * def.staff.wage * place.wage * (brand?.wageLevel ?? 1) * foreign),
    rent: companyId && lot.ownerId === companyId ? 0 : lot.rent,
    upkeep: Math.round((def.upkeep.base + def.upkeep.perArea * lot.area) * idx * foreign * (tier?.upkeep ?? 1)),
    marketing: Math.round((brand?.marketing ?? def.marketing) * idx),
  };
  const totalCosts = Object.values(r.costs).reduce((a, b) => a + b, 0);
  r.profit = r.revenue - totalCosts;
  r.payback = r.profit > 0 ? (r.capex + r.extra) / r.profit : Infinity;
  return r;
}
