import { BUSINESSES } from '../data/businesses.js';
import { COUNTRIES, CITIES } from '../data/cities.js';
import { refPrice, unitPriceRatio } from './demand.js';
import { costIndex as costIndexOf } from './world.js';
import { setAds as setAdsOf } from './ads.js';
import { addNews, companyUnits } from './state.js';
import { attention, autoStaff, efficiency, managerCost } from './staff.js';
import {
  condition, renovateCost, monthProfit, pay, receive, spendCompany, placeOf, takeInv,
} from './units.js';
import { sellPrice, recordTrade, qualityPrice } from './market.js';
import { endContract } from './contracts.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

// Инструменты управления большой компанией: региональные директора (автопилот по стране),
// список проблем с исправлением в один клик и массовые действия.

export const DIRECTOR_WAGE = 7000; // в месяц при уровне зарплат 1
export const DIRECTOR_ATTENTION = 0.3; // точка под присмотром директора требует 30% внимания владельца
export const WORN = 60; // износ, при котором точку пора обновлять
const CHEAP = 0.95; // цена ниже 95% нормы — инфляция «съела» наценку

export function directorCost(state, country) {
  const cities = CITIES.filter((c) => c.country === country);
  const wage = cities.length ? cities.reduce((s, c) => s + c.wage, 0) / cities.length : 0.5;
  return DIRECTOR_WAGE * wage * (state.countries?.[country]?.cpi ?? 1);
}

export function directorOf(state, unit) {
  return state.companies[unit.companyId]?.directors?.[placeOf(state, unit).country] || null;
}

export function newDirector() {
  return { staff: true, renovate: true, prices: true, priceRatio: 1 };
}

// Каждый день: зарплата директоров. Раз в неделю — штат, раз в месяц — цены и обновление точек.
export function runDirectors(state, monthStart) {
  for (const co of Object.values(state.companies)) {
    if (co.bankrupt || !co.directors) continue;
    for (const country of Object.keys(co.directors)) spendCompany(state, co.id, 'directors', directorCost(state, country) / 30);
  }
  const weekly = state.day % 7 === 3;
  if (!weekly && !monthStart) return;
  for (const unit of Object.values(state.units)) {
    const d = directorOf(state, unit);
    if (!d) continue;
    if (weekly && d.staff && !(unit.manager && unit.autoStaff)) autoStaff(state, unit, efficiency(state, unit));
    if (!monthStart) continue;
    if (d.prices && !unit.brandId && BUSINESSES[unit.type].retail) setPriceRatio(state, unit, d.priceRatio);
    if (d.renovate && condition(unit) < WORN) {
      const cost = renovateCost(state, unit);
      if (state.companies[unit.companyId].cash > cost * 3) renovateUnit(state, unit, cost);
    }
  }
}

export function setPriceRatio(state, unit, ratio) {
  const place = placeOf(state, unit);
  for (const p of BUSINESSES[unit.type].retail.products) unit.prices[p.id] = Math.round(refPrice(place, p) * ratio * 100) / 100;
}

export function renovateUnit(state, unit, cost = renovateCost(state, unit)) {
  pay(state, unit.companyId, cost);
  unit.bookValue += cost;
  unit.condition = 100;
}

// Подогнать штат под спрос (без управляющего — разово)
export function fitStaff(state, unit) {
  autoStaff(state, unit, efficiency(state, unit));
}

// Закрытие точки: запасы — на рынок, оборудование — за 30%, контракты — со штрафом
export function closeUnit(state, unit) {
  let fines = 0;
  for (const c of state.contracts.filter((x) => x.unitId === unit.id)) fines += endContract(state, c, { penalty: true });
  let cash = 0;
  const place = placeOf(state, unit);
  for (const [g, s] of Object.entries(unit.inv)) {
    if (s.q <= 0) continue;
    cash += s.q * sellPrice(state, g, place) * qualityPrice(s.k ?? 3, g);
    recordTrade(state, g, s.q, place);
    takeInv(unit, g, s.q);
  }
  cash += unit.bookValue * 0.3;
  receive(state, unit.companyId, cash);
  state.world.lots[unit.lotId].unitId = null;
  delete state.units[unit.id];
  state.mapVersion++;
  return { cash, fines };
}

// ---------- задачи ----------
// Что требует внимания: [{ kind, unitId?, text, cost? }]. Для каждого вида есть массовое исправление (bulk-операция).
export const ALERT_KINDS = {
  worn: { icon: '🛠', title: 'Изношены', fix: 'renovate', fixName: 'Обновить' },
  cheap: { icon: '🏷️', title: 'Цены отстали от инфляции', fix: 'priceNorm', fixName: 'Цены → 100% нормы' },
  queue: { icon: '👥', title: 'Очереди: не хватает персонала', fix: 'fitStaff', fixName: 'Штат под спрос' },
  idle: { icon: '💤', title: 'Лишний персонал', fix: 'fitStaff', fixName: 'Штат под спрос' },
  loss: { icon: '📉', title: 'Убыточны 3 месяца подряд', fix: 'close', fixName: 'Закрыть' },
  supply: { icon: '📦', title: 'Не хватает товара или сырья', fix: null },
  contract: { icon: '📝', title: 'Контракт скоро закончится', fix: null },
  attention: { icon: '👔', title: 'Не хватает внимания', fix: 'hireManager', fixName: 'Нанять управляющих' },
};

export function companyAlerts(state, companyId) {
  const out = [];
  const units = companyUnits(state, companyId);
  for (const u of units) {
    const def = BUSINESSES[u.type];
    const t = u.today || {};
    if (condition(u) < WORN) out.push({ kind: 'worn', unitId: u.id, text: `износ ${Math.round(100 - condition(u))}%`, cost: renovateCost(state, u) });
    if (def.retail && !u.brandId && unitPriceRatio(state, u) < CHEAP) out.push({ kind: 'cheap', unitId: u.id, text: `цены ${Math.round(unitPriceRatio(state, u) * 100)}% нормы` });
    if (def.retail && u.last?.days) {
      const lostShare = u.last.lost / Math.max(1, u.last.customers + u.last.lost);
      if (lostShare > 0.08 && !t.stockout) out.push({ kind: 'queue', unitId: u.id, text: `теряет ${Math.round(lostShare * 100)}% клиентов` });
      const load = (t.customers || 0) / Math.max(1, t.cap || 1);
      if (load < 0.55 && u.staff > def.staff.min && !(u.manager && u.autoStaff)) out.push({ kind: 'idle', unitId: u.id, text: `загрузка ${Math.round(load * 100)}%` });
    }
    if (u.history.length >= 3 && u.history.slice(-3).every((p) => p < 0)) out.push({ kind: 'loss', unitId: u.id, text: `${Math.round(u.history.at(-1)).toLocaleString('ru-RU')} $/мес` });
    if (t.stockout || t.inputShort || Object.values(u.supplied || {}).includes('nocash')) out.push({ kind: 'supply', unitId: u.id, text: t.stockout ? 'пустые полки' : 'простаивает без сырья' });
  }
  for (const c of state.contracts) {
    if (c.companyId === companyId && c.end - state.day <= 20) out.push({ kind: 'contract', unitId: c.unitId, text: `осталось ${c.end - state.day} дн.` });
  }
  const att = attention(state, companyId);
  if (att.excess > 0) {
    const cand = units.filter((u) => !u.manager && u.last).sort((a, b) => monthProfit(b.last) - monthProfit(a.last)).slice(0, att.excess);
    for (const u of cand) out.push({ kind: 'attention', unitId: u.id, text: `управляющий ${Math.round(managerCost(placeOf(state, u), u.type)).toLocaleString('ru-RU')} $/мес` });
  }
  return out;
}

// Массовая операция над точками компании. Возвращает число обработанных и потраченное.
export function bulk(state, companyId, op, unitIds, opts = {}) {
  let done = 0;
  let spent = 0;
  const co = state.companies[companyId];
  for (const id of unitIds) {
    const u = state.units[id];
    if (!u || u.companyId !== companyId) continue;
    const def = BUSINESSES[u.type];
    if (op === 'renovate') {
      if (condition(u) > 95) continue;
      const cost = renovateCost(state, u);
      if (co.cash < cost) break;
      renovateUnit(state, u, cost);
      spent += cost;
    } else if (op === 'priceNorm') {
      if (!def.retail || u.brandId) continue;
      setPriceRatio(state, u, opts.ratio ?? 1);
    } else if (op === 'fitStaff') {
      fitStaff(state, u);
    } else if (op === 'hireManager') {
      if (u.manager) continue;
      u.manager = true;
      u.autoStaff = true;
    } else if (op === 'close') {
      const r = closeUnit(state, u);
      spent -= r.cash - r.fines;
    } else {
      return { ok: false, error: 'Неизвестная операция' };
    }
    done++;
  }
  if (op === 'hireManager' || op === 'close') state.mapVersion++;
  if (done && (op === 'renovate' || op === 'close')) {
    addNews(state, 'info', op === 'renovate' ? `Обновлено точек: ${done}, потрачено $${Math.round(spent).toLocaleString('ru-RU')}.` : `Закрыто точек: ${done}.`, null, companyId);
  }
  return { ok: true, done, spent };
}

export function countryName(c) {
  return COUNTRIES[c]?.name ?? c;
}

// ---------- шаблоны точек ----------
// Шаблон запоминает настройки точки так, чтобы их можно было перенести в любой город:
// цены — в долях от местной нормы, реклама — при индексе цен 1.
export function makeTemplate(state, unit, name) {
  const def = BUSINESSES[unit.type];
  const place = placeOf(state, unit);
  const idx = costIndexOf(place);
  /** @type {Record<string, number>} */
  const priceRatio = {};
  if (def.retail) for (const p of def.retail.products) priceRatio[p.id] = Math.round((unit.prices[p.id] / refPrice(place, p)) * 100) / 100;
  /** @type {Record<string, number>} */
  const ads = {};
  for (const [ch, b] of Object.entries(unit.ads || {})) ads[ch] = Math.round(b / idx);
  return {
    name, type: unit.type, priceRatio, ads, wageLevel: unit.wageLevel ?? 1, brandId: unit.brandId ?? null,
    delivery: unit.delivery ?? 'none', manager: Boolean(unit.manager), sellMode: unit.sellMode,
  };
}

export function applyTemplate(state, unit, t) {
  const def = BUSINESSES[unit.type];
  const place = placeOf(state, unit);
  if (!unit.brandId && def.retail) {
    for (const p of def.retail.products) unit.prices[p.id] = Math.round(refPrice(place, p) * (t.priceRatio[p.id] ?? 1) * 100) / 100;
    setAdsOf(unit, Object.fromEntries(Object.entries(t.ads).map(([ch, b]) => [ch, b * costIndexOf(place)])));
    unit.wageLevel = t.wageLevel;
  }
  unit.delivery = t.delivery;
  unit.sellMode = t.sellMode ?? unit.sellMode;
  if (t.manager) {
    unit.manager = true;
    unit.autoStaff = true;
  }
}

// ---------- автопилот компании ----------
// rules: { reserve — держать в кассе, autoRepay — гасить кредит излишком, closeAfter — закрывать после N месяцев убытка (0 — нет),
//          autoRenovate — обновлять изношенные точки, если касса выше резерва }
export function defaultRules() {
  return { reserve: 50000, autoRepay: false, closeAfter: 0, autoRenovate: false };
}

export function monthlyRules(state) {
  for (const co of Object.values(state.companies)) {
    const r = co.rules;
    if (!r || co.bankrupt || co.ai) continue;
    for (const u of companyUnits(state, co.id)) {
      if (r.closeAfter > 0 && u.history.length >= r.closeAfter && u.history.slice(-r.closeAfter).every((p) => p < 0)) {
        closeUnit(state, u);
        addNews(state, 'info', `Автопилот закрыл «${u.name}»: ${r.closeAfter} мес. подряд в убытке.`, null, co.id);
        continue;
      }
      if (r.autoRenovate && condition(u) < WORN) {
        const cost = renovateCost(state, u);
        if (co.cash - cost > r.reserve) renovateUnit(state, u, cost);
      }
    }
    if (r.autoRepay && co.loan > 0 && co.cash > r.reserve) {
      const a = Math.min(co.loan, co.cash - r.reserve);
      co.loan -= a;
      pay(state, co.id, a);
    }
  }
}

// ---------- отчёты ----------
// Прибыль прошлого месяца по странам, сетям и типам бизнеса + самые убыточные точки
export function companyReport(state, companyId) {
  /** @type {Record<string, Record<string, { n: number, revenue: number, profit: number }>>} */
  const by = { country: {}, brand: {}, type: {} };
  const units = companyUnits(state, companyId).filter((u) => u.last);
  for (const u of units) {
    const place = placeOf(state, u);
    const p = monthProfit(u.last);
    const keys = { country: place.country, brand: u.brandId ? state.brands[u.brandId]?.name ?? '—' : 'без сети', type: u.type };
    for (const [k, key] of Object.entries(keys)) {
      const g = (by[k][key] ||= { n: 0, revenue: 0, profit: 0 });
      g.n++;
      g.revenue += u.last.revenue + u.last.revInternal;
      g.profit += p;
    }
  }
  const worst = units.map((u) => ({ id: u.id, profit: monthProfit(u.last) })).sort((a, b) => a.profit - b.profit).slice(0, 5);
  const best = units.map((u) => ({ id: u.id, profit: monthProfit(u.last) })).sort((a, b) => b.profit - a.profit).slice(0, 5);
  return { country: by.country, brand: by.brand, type: by.type, worst, best };
}
