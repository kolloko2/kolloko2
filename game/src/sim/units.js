import { BUSINESSES, QUALITY_PER_LEVEL } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { itCapacityBoost } from './bonuses.js';

export function emptyMonth() {
  return {
    revenue: 0, revInternal: 0, cogs: 0, wages: 0, rent: 0, upkeep: 0, marketing: 0,
    transport: 0, spoilage: 0, other: 0, customers: 0, lost: 0, produced: 0, days: 0,
  };
}

export function monthProfit(m) {
  return m.revenue + m.revInternal - m.cogs - m.wages - m.rent - m.upkeep - m.marketing - m.transport - m.spoilage - m.other;
}

export function placeOf(state, unit) {
  return state.world.places[unit.placeId];
}

export function lotOf(state, unit) {
  return state.world.lots[unit.lotId];
}

export function capexFor(state, lot, type) {
  const def = BUSINESSES[type];
  const place = state.world.places[lot.placeId];
  const renov = lot.zoning === 'farmland' ? 0 : lot.area * def.renovPerM2 * (place.rent ?? 1);
  return Math.round(def.capex * costIndex(place) + renov);
}

export function monthlyWage(state, unit) {
  return BUSINESSES[unit.type].staff.wage * placeOf(state, unit).wage;
}

export function monthlyUpkeep(state, unit) {
  const u = BUSINESSES[unit.type].upkeep;
  const place = placeOf(state, unit);
  return (u.base + u.perArea * lotOf(state, unit).area) * costIndex(place);
}

// Аренда: не платим, если помещение принадлежит своей компании.
// Если владелец — другая компания (PvP), аренда уходит ей.
export function monthlyRent(state, unit) {
  const lot = lotOf(state, unit);
  return lot.ownerId === unit.companyId ? 0 : lot.rent;
}

export function retailCapacity(state, unit) {
  const r = BUSINESSES[unit.type].retail;
  if (!r || unit.broken > 0) return 0;
  return Math.min(unit.staff * r.perStaff, r.cap[unit.level - 1]) * itCapacityBoost(state, unit.companyId);
}

export function productionCapacity(state, unit) {
  const p = BUSINESSES[unit.type].production;
  if (!p || unit.broken > 0) return 0;
  const place = placeOf(state, unit);
  const byStaff = unit.staff * p.perStaff * (place.productivity ?? 1);
  const cap = p.cap ? p.cap[unit.level - 1] : p.capPerArea * lotOf(state, unit).area * (1 + 0.5 * (unit.level - 1));
  return Math.min(byStaff, cap);
}

// Товары, которые юнит потребляет: { good: количество на 1 единицу «активности» }
export function inputGoods(unit) {
  const def = BUSINESSES[unit.type];
  const goods = new Set();
  if (def.retail) for (const p of def.retail.products) for (const g of Object.keys(p.recipe)) goods.add(g);
  if (def.production) for (const g of Object.keys(def.production.recipe.inputs)) goods.add(g);
  if (def.service) for (const g of Object.keys(def.service.inputs)) goods.add(g);
  return [...goods];
}

export function outputGood(unit) {
  const def = BUSINESSES[unit.type];
  return def.production ? def.production.recipe.output : null;
}

// Сколько товара юнит тратит в день при заданном числе клиентов/выпуске
export function dailyNeed(unit, customers, produced) {
  const def = BUSINESSES[unit.type];
  const need = {};
  if (def.retail) {
    for (const p of def.retail.products) {
      for (const [g, q] of Object.entries(p.recipe)) need[g] = (need[g] || 0) + customers * p.attach * q;
    }
  }
  if (def.production) {
    for (const [g, q] of Object.entries(def.production.recipe.inputs)) need[g] = (need[g] || 0) + produced * q;
  }
  if (def.service) {
    for (const [g, q] of Object.entries(def.service.inputs)) need[g] = (need[g] || 0) + (unit.staff || 0) * q;
  }
  // Собственный выпуск покрывает свою потребность (пекарня печёт выпечку для своей витрины)
  const out = outputGood(unit);
  if (out && need[out]) need[out] = Math.max(0, need[out] - produced);
  return need;
}

export function coverDays(good) {
  return GOODS[good].spoil >= 0.05 ? 2 : 6;
}

export function invQty(unit, good) {
  return unit.inv[good]?.q ?? 0;
}

export function addInv(unit, good, qty, unitCost) {
  if (qty <= 0) return;
  const s = unit.inv[good] || (unit.inv[good] = { q: 0, c: 0 });
  s.c = (s.q * s.c + qty * unitCost) / (s.q + qty);
  s.q += qty;
}

// Списывает товар со склада, возвращает его себестоимость
export function takeInv(unit, good, qty) {
  const s = unit.inv[good];
  if (!s || qty <= 0) return 0;
  const q = Math.min(qty, s.q);
  s.q -= q;
  const cost = q * s.c;
  if (s.q < 1e-6) s.q = 0;
  return cost;
}

export function defaultPrices(state, lot, type) {
  const def = BUSINESSES[type];
  const prices = {};
  if (def.retail) {
    const place = state.world.places[lot.placeId];
    for (const p of def.retail.products) prices[p.id] = refPrice(place, p);
  }
  return prices;
}

export function baseQuality(unit) {
  return (BUSINESSES[unit.type].baseQuality ?? 3) + QUALITY_PER_LEVEL * (unit.level - 1);
}

// Деньги: все движения кассы проходят через эти функции (для учёта и тестов).
// Расход/доход бизнеса записывается в его месячный отчёт, расход/доход компании — в отчёт компании.
export function pay(state, companyId, amount) {
  const co = state.companies[companyId];
  co.cash -= amount;
  co.totals.out += amount;
}

export function receive(state, companyId, amount) {
  const co = state.companies[companyId];
  co.cash += amount;
  co.totals.in += amount;
}

export function spend(state, unit, field, amount) {
  if (amount <= 0) return;
  pay(state, unit.companyId, amount);
  unit.month[field] += amount;
}

export function earn(state, unit, amount) {
  if (amount <= 0) return;
  receive(state, unit.companyId, amount);
  unit.month.revenue += amount;
}

export function spendCompany(state, companyId, field, amount) {
  if (amount <= 0) return;
  pay(state, companyId, amount);
  const m = state.companies[companyId].month;
  m[field] = (m[field] || 0) + amount;
}

export function earnCompany(state, companyId, field, amount) {
  if (amount <= 0) return;
  receive(state, companyId, amount);
  const m = state.companies[companyId].month;
  m[field] = (m[field] || 0) + amount;
}

export function unitAssetValue(state, unit) {
  let inv = 0;
  for (const s of Object.values(unit.inv)) inv += s.q * s.c;
  return unit.bookValue + inv;
}
