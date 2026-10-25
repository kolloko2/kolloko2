import { BUSINESSES } from '../data/businesses.js';
import { CITIES, COUNTRIES } from '../data/cities.js';
import { rand, randPick, chance } from './rng.js';
import { addNews, companyUnits } from './state.js';
import { canBuildHere, forecast } from './forecast.js';
import { applyCommand } from './commands.js';
import { monthProfit, pay, receive, condition, placeOf } from './units.js';
import { buyPrice } from './market.js';
import { GOODS } from '../data/goods.js';
import { listingOf, ipoCheck, doIpo, trade, stakeOf } from './stocks.js';
import { newBrand, brandUnits } from './brands.js';

// ИИ-корпорации — настоящие компании в мире: свои точки на карте, сети, кредиты, биржа.
// У каждой свой характер. С ними можно договариваться: купить точку, заплатить за перемирие.
export const ARCHETYPES = {
  discount: {
    name: 'Дискаунтер', desc: 'Дёшево и много: эконом-сети в спальных районах и у студентов.',
    types: ['fastfood', 'minimarket', 'supermarket'], districts: ['residential', 'student', 'mall'], tier: 'eco', rate: 1,
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
    types: ['coffee_shop', 'fastfood', 'gas_station', 'minimarket'], districts: ['cbd', 'mall', 'residential', 'student'], tier: 'std', rate: 1,
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
  monthlyOffers(state);
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
  transferUnit(state, unit, buyerId);
  return price;
}

// Перемирие: корпорация 2 года не открывается в ваших городах, не выкупает ваши помещения и акции
export function truceCost(state, rival) {
  const h = rival.history.slice(-3);
  const avg = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  return Math.round(Math.max(50000, 6 * Math.max(0, avg)) * (state.countries?.US?.cpi ?? 1));
}

// ---------- предложения корпораций ----------
// state.offers: { id, from (корпорация), to (компания игрока), kind, unitId?, brandId?, good?, qtyPerDay?, price, until }
//   buyUnit — хотят купить вашу точку; buyBrand — всю вашу сеть; sellUnit — распродают свою убыточную точку;
//   supply — сырьевик предлагает поставки дешевле рынка на год.
export const OFFER_DAYS = 30;
const RAW_GOODS = ['wheat', 'flour', 'meat', 'milk', 'coffee_green', 'cattle', 'oil', 'fuel'];

function avgProfit(unit, n = 3) {
  const h = unit.history.slice(-n);
  return h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0;
}

// Сколько корпорация готова заплатить за вашу точку
export function bidForUnit(state, unit) {
  return Math.round(unit.bookValue + 24 * Math.max(0, avgProfit(unit)));
}

function addOffer(state, offer) {
  state.offers ||= [];
  state.nextOfferId ||= 1;
  state.offers.push({ id: state.nextOfferId++, until: state.day + OFFER_DAYS, ...offer });
}

export function offerText(state, o) {
  const from = state.companies[o.from]?.name ?? '?';
  const money = `$${Math.round(o.price).toLocaleString('ru-RU')}`;
  if (o.kind === 'buyUnit') return `«${from}» хочет купить «${state.units[o.unitId]?.name}» за ${money}.`;
  if (o.kind === 'buyBrand') return `«${from}» хочет купить всю сеть «${state.brands[o.brandId]?.name}» за ${money}.`;
  if (o.kind === 'sellUnit') return `«${from}» распродаёт «${state.units[o.unitId]?.name}» (${state.world.places[state.units[o.unitId]?.placeId]?.name}) всего за ${money}.`;
  return `«${from}» предлагает поставлять ${GOODS[o.good].name.toLowerCase()} для «${state.units[o.unitId]?.name}»: ${o.qtyPerDay} ${GOODS[o.good].unit}/день по $${o.price.toFixed(2)} на 12 мес. (дешевле рынка).`;
}

function makeOffers(state, co) {
  const arch = ARCHETYPES[co.ai.archetype];
  for (const player of Object.values(state.companies)) {
    if (player.ai || player.bankrupt || !chance(state.rng, 0.15)) continue;
    if ((state.offers || []).some((o) => o.from === co.id && o.to === player.id && o.until > state.day)) continue;
    const mine = companyUnits(state, player.id);
    const roll = co.ai.archetype === 'raw' ? 0.8 + 0.2 * rand(state.rng) : rand(state.rng) * 0.8;
    if (roll < 0.4) {
      // купить прибыльную точку подходящего типа
      const target = mine.filter((u) => arch.types.includes(u.type) && avgProfit(u) > 0).sort((a, b) => avgProfit(b) - avgProfit(a))[0];
      const price = target && bidForUnit(state, target) * 1.15;
      if (target && co.cash > price) addOffer(state, { from: co.id, to: player.id, kind: 'buyUnit', unitId: target.id, price: Math.round(price) });
    } else if (roll < 0.55) {
      const brand = Object.values(state.brands).find((b) => b.companyId === player.id && arch.types.includes(b.type) && brandUnits(state, b).length >= 4);
      if (brand) {
        const price = Math.round(brandUnits(state, brand).reduce((s, u) => s + bidForUnit(state, u), 0) * 1.25);
        if (co.cash > price * 1.2) addOffer(state, { from: co.id, to: player.id, kind: 'buyBrand', brandId: brand.id, price });
      }
    } else if (roll < 0.8) {
      // своя убыточная точка — со скидкой
      const weak = companyUnits(state, co.id).find((u) => u.history.length >= 3 && avgProfit(u) < 0);
      if (weak) addOffer(state, { from: co.id, to: player.id, kind: 'sellUnit', unitId: weak.id, price: Math.round(weak.bookValue * 0.6) });
    } else if (co.ai.archetype === 'raw') {
      // поставки сырья самой «прожорливой» точке игрока
      let best = null;
      for (const u of mine) {
        for (const g of RAW_GOODS) {
          const q = u.usage[g] || 0;
          const value = q * buyPrice(state, g, placeOf(state, u));
          if (q > 0 && (!best || value > best.value)) best = { u, g, q, value };
        }
      }
      if (best && best.value > 20) {
        const price = Math.round(buyPrice(state, best.g, placeOf(state, best.u)) * 0.92 * 100) / 100;
        const q = best.q >= 100 ? Math.round(best.q / 10) * 10 : Math.max(1, Math.round(best.q));
        addOffer(state, { from: co.id, to: player.id, kind: 'supply', unitId: best.u.id, good: best.g, qtyPerDay: q, price });
      }
    }
  }
}

export function monthlyOffers(state) {
  state.offers = (state.offers || []).filter((o) => o.until > state.day);
  for (const co of Object.values(state.companies)) {
    if (!co.ai || co.bankrupt) continue;
    const before = state.offers.length;
    makeOffers(state, co);
    for (const o of state.offers.slice(before)) addNews(state, 'info', `📨 ${offerText(state, o)} Ответьте во вкладке «Соперники».`, null, o.to);
  }
}

export function transferUnit(state, unit, toId) {
  const fromId = unit.companyId;
  unit.companyId = toId;
  unit.brandId = null;
  unit.tierQuality = 0;
  unit.tierUpkeep = 1;
  const lot = state.world.lots[unit.lotId];
  if (lot.ownerId === fromId) lot.ownerId = toId;
  for (const c of state.contracts) if (c.unitId === unit.id) c.companyId = toId;
  state.mapVersion++;
}

// Принять предложение. Возвращает текст ошибки или null.
export function acceptOffer(state, o) {
  const buyer = state.companies[o.from];
  if (!buyer || buyer.bankrupt) return 'Корпорация уже не существует';
  if (o.kind === 'buyUnit' || o.kind === 'buyBrand') {
    const units = o.kind === 'buyUnit' ? [state.units[o.unitId]] : brandUnits(state, state.brands[o.brandId] || { id: null });
    if (!units.length || units.some((u) => !u || u.companyId !== o.to)) return 'Этих бизнесов у вас уже нет';
    if (buyer.cash < o.price) return 'У корпорации больше нет таких денег';
    pay(state, o.from, o.price);
    receive(state, o.to, o.price);
    for (const u of units) transferUnit(state, u, o.from);
    if (o.kind === 'buyBrand') delete state.brands[o.brandId];
    return null;
  }
  if (o.kind === 'sellUnit') {
    const u = state.units[o.unitId];
    if (!u || u.companyId !== o.from) return 'Эту точку уже продали';
    if (state.companies[o.to].cash < o.price) return 'Не хватает денег';
    pay(state, o.to, o.price);
    receive(state, o.from, o.price);
    transferUnit(state, u, o.to);
    return null;
  }
  // поставки
  const u = state.units[o.unitId];
  if (!u || u.companyId !== o.to) return 'Этого бизнеса у вас уже нет';
  state.contracts.push({
    id: state.nextContractId++, companyId: o.to, unitId: u.id, good: o.good, side: 'buy', qtyPerDay: o.qtyPerDay, price: o.price,
    months: 12, start: state.day, end: state.day + 360, counterparty: o.from,
  });
  return null;
}

// Продать свою точку корпорации по её оценке: берут только подходящий им бизнес
export function rivalWants(state, rival, unit) {
  const arch = ARCHETYPES[rival.ai.archetype];
  return arch.types.includes(unit.type) || rival.ai.archetype === 'raider';
}
