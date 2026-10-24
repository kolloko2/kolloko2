import { BUSINESSES } from '../data/businesses.js';
import { COUNTRIES } from '../data/cities.js';
import { updateMarket } from './market.js';
import { districtShares } from './demand.js';
import { procureAll, sellSurplus, spoilAll } from './supply.js';
import { monthlyAI } from './ai.js';
import { dailyEvents, monthlyEvents } from './events.js';
import { checkGoals, checkVictory } from './goals.js';
import { receiveDeliveries } from './logistics.js';
import { runContracts } from './contracts.js';
import { costIndex } from './world.js';
import { dateOf, addNews, netWorth, monthLabel, activeCompanies, companyUnits } from './state.js';
import {
  emptyMonth, monthProfit, retailCapacity, productionCapacity, dailyNeed, invQty, takeInv, addInv,
  lotOf, placeOf, spend, earn, spendCompany, earnCompany, monthlyWage, monthlyRent, monthlyUpkeep, baseQuality,
} from './units.js';

const BANKRUPT_DAYS = 45;

function runProduction(state) {
  for (const unit of Object.values(state.units)) {
    const p = BUSINESSES[unit.type].production;
    if (!p) continue;
    const cap = productionCapacity(state, unit);
    let limit = cap;
    for (const [g, q] of Object.entries(p.recipe.inputs)) limit = Math.min(limit, invQty(unit, g) / q);
    const produced = Math.floor(Math.max(0, limit));
    let cost = 0;
    for (const [g, q] of Object.entries(p.recipe.inputs)) cost += takeInv(unit, g, produced * q);
    addInv(unit, p.recipe.output, produced, produced > 0 ? cost / produced : 0);
    unit.month.produced += produced;
    unit.today.produced = produced;
    unit.today.prodCap = cap;
    unit.today.inputShort = produced < cap - 1;
  }
}

function sellRetail(state, unit, potential) {
  const def = BUSINESSES[unit.type];
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
    spend(state, unit, 'wages', (unit.staff * monthlyWage(state, unit)) / 30);
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
    if (co.loan > 0) spendCompany(state, co.id, 'interest', (co.loan * co.loanRate) / 365);
  }
}

function updateBrand(state) {
  for (const unit of Object.values(state.units)) {
    if (unit.broken > 0) unit.broken--;
    if (!BUSINESSES[unit.type].retail) continue;
    const lot = lotOf(state, unit);
    const idx = costIndex(placeOf(state, unit));
    const budgetDay = unit.marketing / 30 / idx;
    const gain = 1 - Math.exp(-0.00037 * budgetDay);
    const wordOfMouth = (unit.today.customers || 0) * 0.000004 * (unit.quality - 2.5);
    const floor = 0.05 + 0.15 * lot.visibility;
    unit.awareness += (1 - unit.awareness) * gain - 0.006 * unit.awareness + wordOfMouth;
    unit.awareness = Math.min(0.95, Math.max(floor, unit.awareness));
    const q = baseQuality(unit) - unit.queue - (unit.today.stockout ? 0.4 : 0);
    unit.quality = Math.min(5, Math.max(1, unit.quality * 0.97 + q * 0.03));
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
  state.shipments = state.shipments.filter((s) => s.companyId !== co.id);
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
  for (const [c, p] of Object.entries(byCountry)) {
    if (p > 0) spendCompany(state, co.id, 'tax', p * COUNTRIES[c].tax);
  }
  const m = co.month;
  profit += (m.rentIncome || 0) - (m.interest || 0) - (m.tax || 0);
  co.history.push({
    label: monthLabel(state.day),
    revenue: Math.round(revenue),
    profit: Math.round(profit),
    interest: Math.round(m.interest || 0),
    tax: Math.round(m.tax || 0),
    rentIncome: Math.round(m.rentIncome || 0),
    cash: Math.round(co.cash),
    netWorth: Math.round(netWorth(state, co.id)),
  });
  if (co.history.length > 120) co.history.shift();
  co.month = { interest: 0, tax: 0 };
}

function monthEnd(state) {
  for (const unit of Object.values(state.units)) {
    unit.last = unit.month;
    unit.history.push(Math.round(monthProfit(unit.month)));
    if (unit.history.length > 24) unit.history.shift();
    unit.month = emptyMonth();
    unit.bookValue *= 0.99;
  }
  for (const co of activeCompanies(state)) closeCompanyMonth(state, co, companyUnits(state, co.id));
  monthlyAI(state);
  monthlyEvents(state);
  checkVictory(state);
}

// Игра идёт, пока жива хотя бы одна компания и никто не победил
export function isOver(state) {
  return Boolean(state.winner) || activeCompanies(state).length === 0;
}

export function stepDay(state) {
  if (isOver(state)) return;
  updateMarket(state);
  receiveDeliveries(state);
  for (const unit of Object.values(state.units)) unit.today = {};
  runProduction(state);
  runRetail(state);
  updateUsage(state);
  runContracts(state);
  procureAll(state);
  sellSurplus(state);
  spoilAll(state);
  dailyCosts(state);
  updateBrand(state);
  dailyEvents(state);
  checkSolvency(state);
  checkGoals(state);
  if (dateOf(state.day + 1).getUTCMonth() !== dateOf(state.day).getUTCMonth()) monthEnd(state);
  state.day++;
}

export function stepDays(state, n) {
  for (let i = 0; i < n; i++) stepDay(state);
}

