import { BUSINESSES } from '../data/businesses.js';
import { CITIES, COUNTRIES } from '../data/cities.js';
import { rand, randPick, chance } from './rng.js';
import { addNews, companyUnits } from './state.js';
import { canBuildHere, forecast } from './forecast.js';
import { applyCommand } from './commands.js';
import { monthProfit, pay, receive, condition } from './units.js';
import { listingOf, ipoCheck, doIpo, trade, stakeOf } from './stocks.js';
import { newBrand } from './brands.js';

// ИИ-корпорации — настоящие компании в мире: свои точки на карте, сети, кредиты, биржа.
// У каждой свой характер. С ними можно договариваться: купить точку, заплатить за перемирие.
export const ARCHETYPES = {
  discount: {
    name: 'Дискаунтер', desc: 'Дёшево и много: эконом-сети в спальных районах и у студентов.',
    types: ['fastfood', 'minimarket', 'supermarket'], districts: ['residential', 'student', 'mall'], tier: 'eco', rate: 2,
  },
  premium: {
    name: 'Премиум', desc: 'Дорогие кофейни и рестораны в центре и престижных районах.',
    types: ['coffee_shop', 'restaurant', 'bakery'], districts: ['cbd', 'historic', 'premium'], tier: 'premium', rate: 1,
  },
  raw: {
    name: 'Сырьевик', desc: 'Фермы, мельницы, мясокомбинаты и нефть — продаёт сырьё всему миру.',
    types: ['wheat_farm', 'dairy_farm', 'livestock_farm', 'coffee_plantation', 'mill', 'meat_plant', 'oil_well', 'refinery'], districts: ['industrial', 'rural'], rate: 1,
  },
  raider: {
    name: 'Агрессор', desc: 'Идёт туда, где зарабатываете вы: открывается рядом, выкупает помещения, скупает акции.',
    types: ['coffee_shop', 'fastfood', 'gas_station', 'minimarket'], districts: ['cbd', 'mall', 'residential', 'student'], tier: 'std', rate: 2,
  },
};

const RIVALS = [
  { name: 'Экономия+', archetype: 'discount', color: '#8d6e63', home: 'IN' },
  { name: 'Бель Эпок Групп', archetype: 'premium', color: '#6d4c9b', home: 'FR' },
  { name: 'Северный Агрохолдинг', archetype: 'raw', color: '#5d7a3a', home: 'RU' },
  { name: 'Рапид Фудс', archetype: 'raider', color: '#b03a48', home: 'US' },
];
export const RIVAL_CASH = 400000;
export const TRUCE_MONTHS = 24;

export function isAi(state, companyId) {
  return Boolean(state.companies[companyId]?.ai);
}

export function addRivals(state, n) {
  for (const r of RIVALS.slice(0, n)) {
    const id = `r${state.nextRivalId++}`;
    state.companies[id] = {
      id, name: r.name, color: r.color, cash: RIVAL_CASH, loan: 0, loanRate: 0.1, month: { interest: 0, tax: 0 }, history: [],
      negativeDays: 0, bankrupt: false, totals: { in: 0, out: 0 }, homeCountry: null, licenses: [], payout: 0.4,
      ai: { archetype: r.archetype, home: r.home },
    };
    // сети корпорации заводятся сразу — с её позиционированием (от него зависят цены и прогнозы)
    const arch = ARCHETYPES[r.archetype];
    if (arch.tier) {
      for (const type of arch.types.filter((t) => BUSINESSES[t].retail)) {
        const b = newBrand(state, id, { name: `${r.name} · ${BUSINESSES[type].name}`, businessType: type, tier: arch.tier });
        b.autoRenew = true;
      }
    }
  }
}

function citiesFor(state, co) {
  const arch = ARCHETYPES[co.ai.archetype];
  const units = companyUnits(state, co.id);
  if (co.ai.archetype === 'raw') {
    // сырьевик работает везде, где есть подходящая земля и промзоны
    return Object.values(state.world.places).filter((p) => p.kind === 'region' ? p.kinds.some((k) => arch.types.includes(k)) : true);
  }
  if (co.ai.archetype === 'premium') {
    // премиум — во всех богатых городах мира
    return CITIES.filter((c) => c.income >= 0.8).map((c) => state.world.places[c.id]);
  }
  if (co.ai.archetype === 'raider') {
    // агрессор идёт в города, где больше всего бизнесов у игроков (кроме тех, с кем перемирие)
    const score = {};
    for (const u of Object.values(state.units)) {
      const owner = state.companies[u.companyId];
      if (owner.ai || owner.truces?.[co.id] > state.day) continue;
      score[u.placeId] = (score[u.placeId] || 0) + 1;
    }
    const top = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pid]) => state.world.places[pid]);
    if (top.length) return top.filter((p) => p.kind === 'city');
  }
  // остальные растут как люди: сначала домашняя страна, потом соседние рынки
  const countries = new Set([co.ai.home, ...units.map((u) => state.world.places[u.placeId].country)]);
  if (units.length >= 12) countries.add(randPick(state.rng, Object.keys(COUNTRIES)));
  return CITIES.filter((c) => countries.has(c.country)).map((c) => state.world.places[c.id]);
}

// Куда не ходить: города компаний, купивших перемирие
function blockedPlaces(state, co) {
  const blocked = new Set();
  for (const other of Object.values(state.companies)) {
    if (other.ai || !(other.truces?.[co.id] > state.day)) continue;
    for (const u of companyUnits(state, other.id)) blocked.add(u.placeId);
  }
  return blocked;
}

function expand(state, co) {
  const arch = ARCHETYPES[co.ai.archetype];
  const places = citiesFor(state, co);
  const blocked = blockedPlaces(state, co);
  const reserve = Math.max(30000, (co.history.at(-1)?.revenue ?? 0) * 0.3);
  const lots = [];
  for (const p of places) {
    if (blocked.has(p.id)) continue;
    for (const did of p.districtIds) {
      const d = state.world.districts[did];
      if (!arch.districts.includes(d.type)) continue;
      for (const lid of d.lotIds) {
        const lot = state.world.lots[lid];
        if (!lot.unitId && (!lot.ownerId || lot.ownerId === co.id)) lots.push(lot);
      }
    }
  }
  // как живой игрок, корпорация смотрит не все участки, а выборку
  for (let opened = 0; opened < arch.rate; opened++) {
    let best = null;
    for (let i = 0; i < 40 && lots.length; i++) {
      const lot = lots[Math.floor(rand(state.rng) * lots.length)];
      if (lot.unitId) continue;
      for (const type of arch.types) {
        if (!canBuildHere(state, lot, type)) continue;
        const f = forecast(state, lot.id, type, co.id);
        const cost = f.capex + f.extra;
        if (f.profit <= 0 || f.payback > 36 || cost > co.cash - reserve) continue;
        const score = f.profit / cost;
        if (!best || score > best.score) best = { lot, type, score };
      }
    }
    if (!best) break;
    applyCommand(state, { type: 'openBusiness', lotId: best.lot.id, businessType: best.type }, co.id);
  }
}

function manage(state, co) {
  const arch = ARCHETYPES[co.ai.archetype];
  const units = companyUnits(state, co.id);
  // все точки продаж — в сеть своего типа
  for (const u of units) {
    if (u.brandId || !BUSINESSES[u.type].retail) continue;
    const brand = Object.values(state.brands).find((b) => b.companyId === co.id && b.type === u.type);
    if (brand) applyCommand(state, { type: 'joinBrand', unitId: u.id, brandId: brand.id }, co.id);
  }
  for (const u of units) {
    if (!u.manager) applyCommand(state, { type: 'hireManager', unitId: u.id }, co.id);
    if (!u.brandId && condition(u) < 60 && co.cash > 200000) applyCommand(state, { type: 'renovate', unitId: u.id }, co.id);
    if (u.history.length >= 4 && u.history.slice(-4).every((p) => p < 0)) applyCommand(state, { type: 'closeBusiness', unitId: u.id }, co.id);
  }
  // осторожный кредит и погашение
  const need = Math.max(50000, (co.history.at(-1)?.revenue ?? 0) * 0.25);
  if (co.cash < need) applyCommand(state, { type: 'takeLoan', amount: Math.round(need - co.cash) }, co.id);
  else if (co.loan > 0 && co.cash > need * 3) applyCommand(state, { type: 'repayLoan', amount: Math.min(co.loan, co.cash - need * 2) }, co.id);
  // биржа: выход на IPO, когда можно
  if (!listingOf(state, co.id) && !ipoCheck(state, co.id)) {
    const r = doIpo(state, co.id, 0.4);
    addNews(state, 'info', `🔔 «${co.name}» вышла на биржу по $${r.price.toFixed(2)} за акцию. Её акции можно купить во вкладке «Биржа».`);
  }
}

// Агрессор: выкупает помещение под самой прибыльной точкой игрока и скупает его акции
function raid(state, co) {
  if (co.ai.archetype !== 'raider' || co.cash < 1e6 || !chance(state.rng, 0.2)) return;
  const targets = Object.values(state.units).filter((u) => {
    const owner = state.companies[u.companyId];
    return !owner.ai && !(owner.truces?.[co.id] > state.day) && !state.world.lots[u.lotId].ownerId && u.last;
  }).sort((a, b) => monthProfit(b.last) - monthProfit(a.last));
  const t = targets[0];
  if (t && state.world.lots[t.lotId].price < co.cash * 0.2) {
    applyCommand(state, { type: 'buyLot', lotId: t.lotId }, co.id);
  }
  // скупка акций публичной компании игрока
  for (const l of Object.values(state.stocks.listings)) {
    if (l.kind !== 'company' || isAi(state, l.id) || state.companies[l.id]?.truces?.[co.id] > state.day) continue;
    if (stakeOf(l, co.id) >= 0.3 || l.float <= 0) continue;
    const qty = Math.min(l.float, Math.floor((co.cash * 0.15) / l.price), Math.round(l.shares * 0.3) - (l.holders[co.id] || 0));
    if (qty > l.shares * 0.02 && trade(state, co.id, l.id, qty).ok) {
      addNews(state, 'warn', `🦈 «${co.name}» скупила ${Math.round(stakeOf(l, co.id) * 100)}% акций «${l.name}».`);
    }
  }
}

export function monthlyRivals(state) {
  for (const co of Object.values(state.companies)) {
    if (!co.ai || co.bankrupt) continue;
    manage(state, co);
    expand(state, co);
    raid(state, co);
  }
}

// ---------- сделки с корпорациями ----------
// Цена, за которую корпорация продаст точку: оборудование + 18 месяцев прибыли
export function rivalUnitPrice(state, unit) {
  const h = unit.history.slice(-3);
  const avg = h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0;
  return Math.round(unit.bookValue * 1.1 + 18 * Math.max(0, avg));
}

export function buyRivalUnit(state, buyerId, unit) {
  const price = rivalUnitPrice(state, unit);
  pay(state, buyerId, price);
  receive(state, unit.companyId, price);
  const seller = state.companies[unit.companyId];
  unit.companyId = buyerId;
  unit.brandId = null;
  unit.tierQuality = 0;
  unit.tierUpkeep = 1;
  const lot = state.world.lots[unit.lotId];
  if (lot.ownerId === seller.id) lot.ownerId = buyerId; // помещение продаётся вместе с бизнесом
  for (const c of state.contracts) if (c.unitId === unit.id) c.companyId = buyerId;
  state.mapVersion++;
  return price;
}

// Перемирие: корпорация 2 года не открывается в ваших городах, не выкупает ваши помещения и акции
export function truceCost(state, rival) {
  const h = rival.history.slice(-3);
  const avg = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  return Math.round(Math.max(50000, 6 * Math.max(0, avg)) * (state.countries?.US?.cpi ?? 1));
}
