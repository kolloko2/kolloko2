import { BUSINESSES, EQUIPMENT, STAFF_CLASSES } from '../data/businesses.js';
import { GOODS, GRADES } from '../data/goods.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { itCapacityBoost } from './bonuses.js';
import { efficiency, laborFactor, wageLevel } from './staff.js';
import { foreignFactor } from './expansion.js';
import { techLevel } from './research.js';
import { energyFactor, mallDiscount } from './bonuses.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

export function emptyMonth() {
  return {
    revenue: 0, revInternal: 0, cogs: 0, wages: 0, rent: 0, upkeep: 0, marketing: 0,
    transport: 0, duty: 0, commission: 0, spoilage: 0, other: 0, customers: 0, lost: 0, produced: 0, days: 0,
  };
}

export function monthProfit(m) {
  return m.revenue + m.revInternal - m.cogs - m.wages - m.rent - m.upkeep - m.marketing - m.transport - (m.duty || 0) - (m.commission || 0) - m.spoilage - m.other;
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

// Зарплата одного сотрудника: ставка профессии × уровень зарплат города × выбранный уровень × рынок труда
/** @param {State} state @param {Unit} unit */
export function monthlyWage(state, unit) {
  const place = placeOf(state, unit);
  return BUSINESSES[unit.type].staff.wage * place.wage * (place.cpi ?? 1) * wageLevel(unit) * laborFactor(state, place) * foreignFactor(state, unit);
}

/** @param {State} state @param {Unit} unit */
export function monthlyUpkeep(state, unit) {
  const u = BUSINESSES[unit.type].upkeep;
  const place = placeOf(state, unit);
  return (u.base + u.perArea * lotOf(state, unit).area) * costIndex(place) * foreignFactor(state, unit) * (unit.tierUpkeep ?? 1) * wearUpkeep(unit)
    * (1 - 0.08 * techLevel(state, unit.companyId, 'energy')) * energyFactor(state, unit.companyId, place);
}

// Аренда: не платим, если помещение принадлежит своей компании.
// Если владелец — другая компания (PvP), аренда уходит ей.
/** @param {State} state @param {Unit} unit */
export function monthlyRent(state, unit) {
  const lot = lotOf(state, unit);
  if (lot.ownerId === unit.companyId) return 0;
  return BUSINESSES[unit.type].service?.realEstate ? lot.rent : lot.rent * mallDiscount(state, unit.companyId, lot.districtId);
}

// ---------- износ ----------
// Оборудование и интерьер стареют: ~1% в месяц (быстрее при полной загрузке). Изношенная точка
// хуже выглядит (рейтинг), чаще ломается, медленнее производит и дороже в обслуживании. Лечится обновлением.
export const WEAR_PER_DAY = 0.028;
export const RENOVATE_SHARE = 0.25; // полное обновление стоит 25% вложений

export const condition = (unit) => unit.condition ?? 100;

export function wearQuality(unit) {
  return (100 - condition(unit)) / 40; // 60% — минус звезда
}

export function wearEfficiency(unit) {
  return 0.8 + 0.2 * (condition(unit) / 100);
}

export function wearUpkeep(unit) {
  return 1 + (100 - condition(unit)) / 200;
}

/** @param {State} state @param {Unit} unit */
export function renovateCost(state, unit) {
  const lot = lotOf(state, unit);
  const base = capexFor(state, lot, unit.type) * (1 + 0.5 * (unit.level - 1));
  return Math.round(base * RENOVATE_SHARE * (100 - condition(unit)) / 100);
}

/** @param {State} state @param {Unit} unit */
export function retailCapacity(state, unit) {
  const r = BUSINESSES[unit.type].retail;
  if (!r || unit.broken > 0) return 0;
  const pos = (1 + 0.08 * techLevel(state, unit.companyId, 'pos')) * (1 + 0.05 * techLevel(state, unit.companyId, 'ai'));
  return Math.min(unit.staff * r.perStaff * efficiency(state, unit) * pos, r.cap[unit.level - 1]) * itCapacityBoost(state, unit.companyId);
}

// Заводы с выбором продукции: production.variants = { товар: { inputs, rate, res } }.
// rate — множитель выпуска (в штуках) относительно perStaff/cap; res — только там, где есть такое сырьё (place.resources).
/** @typedef {{ output: string, inputs: Record<string, number>, rate: number, res?: boolean }} Recipe */
for (const def of Object.values(BUSINESSES)) {
  const p = def.production;
  if (!p?.variants) continue;
  p.recipes = Object.fromEntries(Object.entries(p.variants).map(([output, v]) => [output, { output, inputs: v.inputs || {}, rate: v.rate ?? 1, res: v.res }]));
}

/** Рецепт выпуска бизнеса (у заводов с вариантами — выбранный) @returns {Recipe|null} */
export function recipeOf(unit) {
  const p = BUSINESSES[unit.type].production;
  if (!p) return null;
  if (!p.recipes) return p.recipe;
  return p.recipes[unit.recipe] || Object.values(p.recipes)[0];
}

/** Какие варианты продукции доступны в этом месте @returns {string[]} */
export function allowedRecipes(place, type) {
  const p = BUSINESSES[type].production;
  if (!p?.recipes) return p ? [p.recipe.output] : [];
  return Object.values(p.recipes).filter((r) => !r.res || (place.resources || []).includes(r.output)).map((r) => r.output);
}

// Бонусы исследований к выработке: автоматизация и ИИ везде, агрономия — на земле, геология — в недрах
/** @param {State} state @param {string} companyId @param {string} type */
export function techOutput(state, companyId, type) {
  const cat = BUSINESSES[type].category;
  const extra = cat === 'farm' ? 0.1 * techLevel(state, companyId, 'agro')
    : cat === 'mining' || cat === 'oil' ? 0.1 * techLevel(state, companyId, 'mining') : 0;
  return (1 + 0.12 * techLevel(state, companyId, 'automation')) * (1 + 0.05 * techLevel(state, companyId, 'ai')) * (1 + extra);
}

/** @param {State} state @param {Unit} unit */
export function productionCapacity(state, unit) {
  const p = BUSINESSES[unit.type].production;
  if (!p || unit.broken > 0) return 0;
  const place = placeOf(state, unit);
  const rate = recipeOf(unit)?.rate ?? 1;
  const byStaff = unit.staff * p.perStaff * rate * (place.productivity ?? 1) * efficiency(state, unit) * wearEfficiency(unit)
    * techOutput(state, unit.companyId, unit.type);
  const cap = (p.cap ? p.cap[unit.level - 1] : p.capPerArea * lotOf(state, unit).area * (1 + 0.5 * (unit.level - 1))) * rate;
  return Math.min(byStaff, cap);
}

// Товары, которые юнит потребляет: { good: количество на 1 единицу «активности» }
export function inputGoods(unit) {
  const def = BUSINESSES[unit.type];
  const goods = new Set();
  if (def.retail) for (const p of def.retail.products) for (const g of Object.keys(p.recipe)) goods.add(g);
  if (def.production) for (const g of Object.keys(recipeOf(unit)?.inputs || {})) goods.add(g);
  if (def.service) for (const g of Object.keys(def.service.inputs)) goods.add(g);
  return [...goods];
}

export function outputGood(unit) {
  return recipeOf(unit)?.output ?? null;
}

// Сколько товара юнит тратит в день при заданном числе клиентов/выпуске
export function dailyNeed(unit, customers, produced) {
  const def = BUSINESSES[unit.type];
  /** @type {Record<string, number>} */
  const need = {};
  if (def.retail) {
    for (const p of def.retail.products) {
      for (const [g, q] of Object.entries(p.recipe)) need[g] = (need[g] || 0) + customers * p.attach * q;
    }
  }
  if (def.production) {
    for (const [g, q] of Object.entries(recipeOf(unit)?.inputs || {})) need[g] = (need[g] || 0) + produced * q;
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

// k — класс (качество 1–5) поступившего товара: в запасе держится средний класс
export function addInv(unit, good, qty, unitCost, k = 3) {
  if (qty <= 0) return;
  const s = unit.inv[good] || (unit.inv[good] = { q: 0, c: 0, k });
  s.c = (s.q * s.c + qty * unitCost) / (s.q + qty);
  s.k = ((s.k ?? 3) * s.q + k * qty) / (s.q + qty);
  s.q += qty;
}

// Класс товара в запасе (если запаса нет — класс, который точка закупает на рынке)
export function invK(unit, good) {
  const s = unit.inv[good];
  return s && s.q > 0 ? s.k ?? 3 : gradeK(unit, good);
}

export function gradeK(unit, good) {
  return GRADES[unit.grades?.[good] ?? 'std']?.k ?? 3;
}

// Качество оборудования (с учётом износа) и персонала (квалификация, обучение, звезда, настроение)
export function equipmentK(unit, wear = true) {
  return EQUIPMENT[unit.level - 1].k - (wear ? wearQuality(unit) : 0);
}
export function staffK(unit) {
  const cls = STAFF_CLASSES[unit.wageLevel ?? 1] ?? STAFF_CLASSES[1];
  return cls.k + 0.15 * (unit.training || 0) + (unit.star ? 0.4 : 0) - ((unit.morale ?? 65) < 40 ? 0.4 : 0);
}

// Класс товара, который выпускает производство: сырьё, оборудование, люди (+ исследования)
/** @param {State} state @param {Unit} unit @param {number|null} [inputsK] */
export function outputK(state, unit, inputsK = null) {
  const tech = 0.1 * techLevel(state, unit.companyId, 'quality');
  const k = inputsK === null ? 0.55 * equipmentK(unit) + 0.45 * staffK(unit) : 0.4 * inputsK + 0.35 * equipmentK(unit) + 0.25 * staffK(unit);
  return Math.max(1, Math.min(5, k + tech));
}

// Средний класс товаров, из которых точка делает основной продукт (взвешено по цене)
export function productK(unit) {
  const def = BUSINESSES[unit.type];
  const recipe = def.retail ? def.retail.products[0].recipe : recipeOf(unit)?.inputs;
  if (!recipe || !Object.keys(recipe).length) return null;
  let w = 0;
  let sum = 0;
  for (const [g, q] of Object.entries(recipe)) {
    const v = q * GOODS[g].base * GOODS[g].qualityWeight;
    w += v;
    sum += v * invK(unit, g);
  }
  return w > 0 ? sum / w : null;
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
  /** @type {Record<string, number>} */
  const prices = {};
  if (def.retail) {
    const place = state.world.places[lot.placeId];
    for (const p of def.retail.products) prices[p.id] = refPrice(place, p);
  }
  return prices;
}

// Рейтинг точки для покупателей: товар (класс того, что на полках), оборудование и интерьер, персонал
export function baseQuality(unit, state = null) {
  const tech = state && BUSINESSES[unit.type].retail ? 0.15 * techLevel(state, unit.companyId, 'quality') : 0;
  const product = productK(unit);
  const service = 0.5 * equipmentK(unit, false) + 0.5 * staffK(unit);
  const q = product === null ? service : 0.5 * product + 0.5 * service;
  return q + ((BUSINESSES[unit.type].baseQuality ?? 3) - 3) + (unit.tierQuality ?? 0) + tech - wearQuality(unit);
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

/** @param {State} state @param {Unit} unit */
export function unitAssetValue(state, unit) {
  let inv = 0;
  for (const s of Object.values(unit.inv)) inv += s.q * s.c;
  return unit.bookValue + inv;
}
