import { BUSINESSES } from '../data/businesses.js';
import { updateMarket } from './market.js';
import { districtShares } from './demand.js';
import { procureAll, sellSurplus, spoilAll } from './supply.js';
import { monthlyAI } from './ai.js';
import { dailyEvents, monthlyEvents } from './events.js';
import { checkGoals, checkVictory } from './goals.js';
import { receiveDeliveries } from './logistics.js';
import { runServices } from './services.js';
import { adGain, monthlyViral } from './ads.js';
import { ownCourier } from './bonuses.js';
import { monthlyLuck } from './luck.js';
import { monthlyServiceMood } from './services.js';
import { updateStaff, monthlyStaffEvents, managerCost, morale, STAR_WAGE } from './staff.js';
import { updateBrands } from './brands.js';
import { runContracts } from './contracts.js';
import { countryTax, monthlyCountryEvents, monthlyInflation } from './countries.js';
import { applyBrand } from './brands.js';
import { overhead } from './expansion.js';
import { runDirectors, monthlyRules } from './management.js';
import { monthlyRivals } from './rivals.js';
import { runResearch, techLevel, taxBreak } from './research.js';
import { loanRate } from './state.js';
import { monthlyFranchise } from './franchise.js';
import { updateStocks, monthlyStocks, delistCompany } from './stocks.js';
import { dateOf, addNews, netWorth, monthLabel, activeCompanies, companyUnits } from './state.js';
import {
  emptyMonth, monthProfit, retailCapacity, productionCapacity, dailyNeed, invQty, takeInv, addInv,
  lotOf, placeOf, spend, earn, spendCompany, earnCompany, monthlyWage, monthlyRent, monthlyUpkeep, baseQuality,
  WEAR_PER_DAY, condition, renovateCost, pay, recipeOf, invK, outputK,
} from './units.js';
import { GOODS } from '../data/goods.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

const BANKRUPT_DAYS = 45;

function runProduction(state) {
  for (const unit of Object.values(state.units)) {
    const recipe = recipeOf(unit);
    if (!recipe) continue;
    const cap = productionCapacity(state, unit);
    const lean = 1 - 0.05 * techLevel(state, unit.companyId, 'lean'); // бережливое производство: меньше сырья
    let limit = cap;
    for (const [g, q] of Object.entries(recipe.inputs)) limit = Math.min(limit, invQty(unit, g) / (q * lean));
    const produced = Math.floor(Math.max(0, limit));
    let cost = 0;
    // класс продукции: из какого сырья, на каком оборудовании и какими людьми сделано
    let inK = null;
    if (produced > 0 && Object.keys(recipe.inputs).length) {
      let w = 0;
      inK = 0;
      for (const [g, q] of Object.entries(recipe.inputs)) {
        const v = q * GOODS[g].base * GOODS[g].qualityWeight;
        w += v;
        inK += v * invK(unit, g);
      }
      inK = w > 0 ? inK / w : null;
    }
    for (const [g, q] of Object.entries(recipe.inputs)) cost += takeInv(unit, g, produced * q * lean);
    const k = outputK(state, unit, inK);
    addInv(unit, recipe.output, produced, produced > 0 ? cost / produced : 0, k);
    unit.today.outK = k;
    unit.month.produced += produced;
    unit.today.produced = produced;
    unit.today.prodCap = cap;
    unit.today.inputShort = produced < cap - 1;
  }
}

// Доставка еды: агрегатор приводит +35% заказов за 25% комиссии, своя служба доставки — +30% за 8%
export const DELIVERY = {
  aggregator: { extra: 0.35, fee: 0.25 },
  own: { extra: 0.3, fee: 0.08 },
};
export const DELIVERY_CATEGORIES = ['coffee', 'fastfood', 'restaurant', 'bakery'];

function deliveryMode(state, unit) {
  const mode = unit.delivery;
  if (!mode || mode === 'none' || !DELIVERY_CATEGORIES.includes(BUSINESSES[unit.type].category)) return null;
  const d = mode === 'own' && !ownCourier(state, unit.companyId, unit.placeId) ? DELIVERY.aggregator : DELIVERY[mode]; // без курьеров — через агрегатор
  const online = techLevel(state, unit.companyId, 'ecommerce');
  return online ? { ...d, extra: d.extra + 0.1 * online } : d;
}

function sellRetail(state, unit, basePotential) {
  const def = BUSINESSES[unit.type];
  const d = deliveryMode(state, unit);
  const potential = basePotential * (1 + (d?.extra ?? 0));
  const cap = retailCapacity(state, unit);
  const [main, ...extras] = def.retail.products;
  let stockMain = Infinity;
  for (const [g, q] of Object.entries(main.recipe)) stockMain = Math.min(stockMain, invQty(unit, g) / q);
  const served = Math.floor(Math.max(0, Math.min(potential, cap, stockMain)));
  let cost = 0;
  let revenue = served * unit.prices[main.id];
  for (const [g, q] of Object.entries(main.recipe)) cost += takeInv(unit, g, served * q);
  for (const p of extras) {
    let can = served * p.attach;
    for (const [g, q] of Object.entries(p.recipe)) can = Math.min(can, invQty(unit, g) / q);
    can = Math.floor(Math.max(0, can));
    for (const [g, q] of Object.entries(p.recipe)) cost += takeInv(unit, g, can * q);
    revenue += can * unit.prices[p.id];
  }
  earn(state, unit, revenue);
  if (d) {
    const share = d.extra / (1 + d.extra); // доля заказов с доставкой
    spend(state, unit, 'commission', revenue * share * d.fee);
    unit.today.delivered = Math.round(served * share);
  }
  unit.month.cogs += cost;
  unit.month.customers += served;
  const lost = Math.max(0, Math.round(potential - served));
  unit.month.lost += lost;
  unit.today.customers = served;
  unit.today.potential = potential;
  unit.today.lost = lost;
  unit.today.cap = cap;
  unit.today.stockout = stockMain < Math.min(potential, cap) - 1;
  unit.today.revenue = revenue;
  unit.queue = cap > 0 ? Math.min(1, Math.max(0, (potential / cap - 0.95) * 1.5)) : 0;
}

function runRetail(state) {
  const done = new Set();
  for (const unit of Object.values(state.units)) {
    const def = BUSINESSES[unit.type];
    if (!def.retail) continue;
    const lot = lotOf(state, unit);
    const key = `${lot.districtId}|${def.category}`;
    if (done.has(key)) continue;
    done.add(key);
    const shares = districtShares(state, state.world.districts[lot.districtId], def.category);
    for (const [id, potential] of Object.entries(shares.byUnit)) sellRetail(state, state.units[id], potential);
  }
}

function updateUsage(state) {
  for (const unit of Object.values(state.units)) {
    const def = BUSINESSES[unit.type];
    const customers = def.retail ? Math.min(unit.today.potential ?? 0, retailCapacity(state, unit)) : 0;
    const produced = def.production ? productionCapacity(state, unit) : 0;
    if (unit.broken > 0) continue; // поломка — не меняем привычный объём закупок
    const need = dailyNeed(unit, customers, produced);
    for (const g of Object.keys(need)) unit.usage[g] = (unit.usage[g] || 0) * 0.7 + need[g] * 0.3;
  }
}

function dailyCosts(state) {
  for (const unit of Object.values(state.units)) {
    const staffCount = unit.staff + (unit.star ? STAR_WAGE : 0);
    spend(state, unit, 'wages', (staffCount * monthlyWage(state, unit) + (unit.manager ? managerCost(placeOf(state, unit), unit.type) : 0)) / 30);
    const rent = monthlyRent(state, unit) / 30;
    spend(state, unit, 'rent', rent);
    // помещение принадлежит другой компании — аренда идёт ей
    const owner = lotOf(state, unit).ownerId;
    if (owner && owner !== unit.companyId && state.companies[owner]) earnCompany(state, owner, 'rentIncome', rent);
    spend(state, unit, 'upkeep', monthlyUpkeep(state, unit) / 30);
    spend(state, unit, 'marketing', unit.marketing / 30);
    unit.month.days++;
  }
  for (const co of activeCompanies(state)) {
    if (co.loan > 0) spendCompany(state, co.id, 'interest', (co.loan * loanRate(state, co.id)) / 365);
  }
}

// Износ: чем выше загрузка, тем быстрее
function wearAll(state) {
  for (const unit of Object.values(state.units)) {
    const t = unit.today;
    let load = 0.5;
    if (t.cap) load = (t.customers || 0) / t.cap;
    else if (t.prodCap) load = (t.produced || 0) / t.prodCap;
    const durable = 1 - 0.2 * techLevel(state, unit.companyId, 'durability');
    unit.condition = Math.max(0, condition(unit) - WEAR_PER_DAY * (0.6 + 0.6 * Math.min(1, load)) * durable);
  }
}

// Сети с автообновлением сами ремонтируют изношенные точки (если в кассе есть деньги)
function autoRenovate(state) {
  for (const unit of Object.values(state.units)) {
    const brand = unit.brandId ? state.brands[unit.brandId] : null;
    if (!brand?.autoRenew || condition(unit) > 65) continue;
    const cost = renovateCost(state, unit);
    if (state.companies[unit.companyId].cash < cost * 2) continue;
    pay(state, unit.companyId, cost);
    unit.bookValue += cost;
    unit.condition = 100;
    addNews(state, 'info', `Сеть «${brand.name}» обновила «${unit.name}» за $${cost.toLocaleString('ru-RU')}.`, { unitId: unit.id }, unit.companyId);
  }
}

function updateBrand(state) {
  for (const unit of Object.values(state.units)) {
    if (unit.broken > 0) unit.broken--;
    if (!BUSINESSES[unit.type].retail) continue;
    const lot = lotOf(state, unit);
    const gain = adGain(state, unit);
    const wordOfMouth = (unit.today.customers || 0) * 0.000004 * (unit.quality - 2.5);
    const floor = 0.05 + 0.15 * lot.visibility;
    unit.awareness += gain - 0.006 * unit.awareness + wordOfMouth;
    unit.awareness = Math.min(0.95, Math.max(floor, unit.awareness));
    const q = baseQuality(unit, state) - unit.queue - (unit.today.stockout ? 0.4 : 0) - (morale(unit) < 40 ? 0.3 : 0);
    unit.quality = Math.min(5, Math.max(1, unit.quality * 0.97 + q * 0.03));
  }
}

// Застройщики каждый год делают свои города многолюднее
function yearlyGrowth(state) {
  state.growth ||= {};
  for (const u of Object.values(state.units)) {
    if (u.type !== 'developer' || u.broken > 0) continue;
    state.growth[u.placeId] = Math.round(Math.min(1.2, (state.growth[u.placeId] ?? 1) * 1.02) * 1000) / 1000;
  }
}

// Банкротство: бизнесы компании закрываются, помещения возвращаются городу
function liquidate(state, co) {
  co.bankrupt = true;
  for (const unit of companyUnits(state, co.id)) {
    state.world.lots[unit.lotId].unitId = null;
    delete state.units[unit.id];
  }
  for (const lot of Object.values(state.world.lots)) if (lot.ownerId === co.id) lot.ownerId = null;
  state.contracts = state.contracts.filter((c) => c.companyId !== co.id);
  for (const b of Object.values(state.brands)) if (b.companyId === co.id) delete state.brands[b.id];
  state.shipments = state.shipments.filter((s) => s.companyId !== co.id);
  delistCompany(state, co.id);
  state.mapVersion++;
  const others = state.mode === 'pvp' ? null : co.id;
  addNews(state, 'bad', state.mode === 'pvp' ? `Компания «${co.name}» обанкротилась! Её точки закрыты.` : 'Компания объявлена банкротом. Игра окончена.', null, others);
}

function checkSolvency(state) {
  for (const co of activeCompanies(state)) {
    if (co.cash < 0) {
      co.negativeDays++;
      if (co.negativeDays === 1) addNews(state, 'bad', 'Касса ушла в минус! Возьмите кредит или сократите расходы.', null, co.id);
      if (co.negativeDays === 30) addNews(state, 'bad', `Касса в минусе 30 дней. Через ${BANKRUPT_DAYS - 30} дней — банкротство.`, null, co.id);
      if (co.negativeDays >= BANKRUPT_DAYS) liquidate(state, co);
    } else {
      co.negativeDays = 0;
    }
  }
}

function closeCompanyMonth(state, co, units) {
  const byCountry = {};
  let revenue = 0;
  let profit = 0;
  for (const unit of units) {
    const p = monthProfit(unit.last);
    const c = placeOf(state, unit).country;
    byCountry[c] = (byCountry[c] || 0) + p;
    revenue += unit.last.revenue;
    profit += p;
  }
  spendCompany(state, co.id, 'overhead', overhead(state, co.id));
  const m = co.month;
  // роялти и взносы франчайзи облагаются налогом в домашней стране
  const franchise = (m.royalty || 0) + (m.franchiseFees || 0);
  if (franchise && co.homeCountry) byCountry[co.homeCountry] = (byCountry[co.homeCountry] || 0) + franchise;
  for (const [c, p] of Object.entries(byCountry)) {
    if (p > 0) spendCompany(state, co.id, 'tax', p * Math.max(0, countryTax(state, c) - taxBreak(state, co.id, c)));
  }
  // дивиденды полученные — доход; выплаченные — распределение прибыли, а не расход
  profit += franchise + (m.dividendsIn || 0) + (m.rentIncome || 0) - (m.interest || 0) - (m.tax || 0) - (m.brandAds || 0) - (m.overhead || 0) - (m.directors || 0) - (m.research || 0);
  co.history.push({
    label: monthLabel(state.day),
    revenue: Math.round(revenue),
    profit: Math.round(profit),
    interest: Math.round(m.interest || 0),
    tax: Math.round(m.tax || 0),
    rentIncome: Math.round(m.rentIncome || 0),
    brandAds: Math.round(m.brandAds || 0),
    overhead: Math.round(m.overhead || 0),
    directors: Math.round(m.directors || 0),
    research: Math.round(m.research || 0),
    royalty: Math.round(franchise),
    dividendsIn: Math.round(m.dividendsIn || 0),
    cash: Math.round(co.cash),
    netWorth: Math.round(netWorth(state, co.id)),
  });
  if (co.history.length > 120) co.history.shift();
  co.month = { interest: 0, tax: 0 };
}

function monthEnd(state) {
  const newYear = dateOf(state.day + 1).getUTCFullYear() !== dateOf(state.day).getUTCFullYear();
  monthlyInflation(state, newYear);
  // сети пересчитывают цены, рекламу по новому уровню цен
  for (const brand of Object.values(state.brands)) applyBrand(state, brand);
  autoRenovate(state);
  for (const unit of Object.values(state.units)) {
    unit.last = unit.month;
    unit.history.push(Math.round(monthProfit(unit.month)));
    if (unit.history.length > 24) unit.history.shift();
    unit.month = emptyMonth();
    unit.bookValue *= 0.995; // амортизация ~6% в год
  }
  monthlyFranchise(state);
  for (const co of activeCompanies(state)) closeCompanyMonth(state, co, companyUnits(state, co.id));
  monthlyStocks(state);
  monthlyRivals(state);
  monthlyAI(state);
  monthlyCountryEvents(state);
  monthlyViral(state);
  monthlyLuck(state);
  monthlyServiceMood(state);
  monthlyRules(state);
  if (newYear) yearlyGrowth(state);
  monthlyEvents(state);
  monthlyStaffEvents(state);
  checkVictory(state);
}

// Игра идёт, пока жива хотя бы одна компания и никто не победил
export function isOver(state) {
  return Boolean(state.winner) || !activeCompanies(state).some((c) => !c.ai);
}

/** @param {State} state */
export function stepDay(state) {
  if (isOver(state)) return;
  updateMarket(state);
  updateStocks(state);
  receiveDeliveries(state);
  for (const unit of Object.values(state.units)) unit.today = {};
  runProduction(state);
  runRetail(state);
  runServices(state);
  updateUsage(state);
  runContracts(state);
  procureAll(state);
  sellSurplus(state);
  spoilAll(state);
  dailyCosts(state);
  wearAll(state);
  updateBrand(state);
  updateStaff(state);
  updateBrands(state, spendCompany);
  runDirectors(state, dateOf(state.day).getUTCDate() === 1);
  runResearch(state);
  dailyEvents(state);
  checkSolvency(state);
  checkGoals(state);
  if (dateOf(state.day + 1).getUTCMonth() !== dateOf(state.day).getUTCMonth()) monthEnd(state);
  state.day++;
}

export function stepDays(state, n) {
  for (let i = 0; i < n; i++) stepDay(state);
}

