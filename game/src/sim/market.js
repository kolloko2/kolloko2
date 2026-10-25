import { GOODS, MARKET_BUY_MARKUP, MARKET_SELL_DISCOUNT } from '../data/goods.js';
import { MARKET_REGIONS, COUNTRY_REGION, REGION_BIAS } from '../data/regions.js';
import { randNormal } from './rng.js';
import { priceIndex } from './world.js';

const IMPACT_K = 0.4; // насколько объёмы игроков двигают цену
const MAX_IMPACT = 0.5;
const REGION_DEPTH_SHARE = 0.3; // доля мирового объёма рынка, приходящаяся на регион
export const BULK_MARKUP = 0.03; // склады закупают оптом — наценка посредника меньше

// Мировая цена (шоки, инфляция, давление всех игроков) × региональный коэффициент (давление игроков в регионе).
export function initMarket() {
  const goods = {};
  for (const [id, g] of Object.entries(GOODS)) {
    const regions = {};
    for (const r of Object.keys(MARKET_REGIONS)) {
      const bias = REGION_BIAS[id]?.[r] ?? 1;
      regions[r] = { f: bias, flow: 0, today: 0, hist: [] };
    }
    goods[id] = { price: g.base, mean: g.base, shock: 1, shockDays: 0, flow: 0, today: 0, hist: [g.base], regions };
  }
  return { goods };
}

export function regionOf(place) {
  return COUNTRY_REGION[place.country];
}

function impact(flow, depth) {
  return Math.max(-MAX_IMPACT, Math.min(MAX_IMPACT, (-IMPACT_K * flow) / depth));
}

// Средняя цена: мировая, либо в регионе (regionId)
export function midPrice(state, good, regionId = null) {
  const m = state.market.goods[good];
  const world = m.price * (1 + impact(m.flow, GOODS[good].depth));
  if (!regionId) return world;
  const r = m.regions[regionId];
  return world * r.f * (1 + impact(r.flow, GOODS[good].depth * REGION_DEPTH_SHARE));
}

// place — где покупаем: региональная цена, а для местных товаров ещё и уровень цен в городе
export function buyPrice(state, good, place = null, { bulk = false } = {}) {
  // местные товары: и уровень цен в городе, и его инфляция относительно мировой
  const local = GOODS[good].local && place ? (0.3 + 0.7 * priceIndex(place)) * localInflation(state, place) : 1;
  const markup = bulk ? BULK_MARKUP : MARKET_BUY_MARKUP;
  return midPrice(state, good, place ? regionOf(place) : null) * (1 + markup) * local;
}

function localInflation(state, place) {
  const m = state.market.goods.groceries;
  const world = m.mean / GOODS.groceries.base;
  return (place.cpi ?? 1) / world;
}

export function sellPrice(state, good, place = null) {
  return midPrice(state, good, place ? regionOf(place) : null) * (1 - MARKET_SELL_DISCOUNT);
}

// qtySold > 0 — продажа рынку, < 0 — покупка
export function recordTrade(state, good, qtySold, place = null) {
  const m = state.market.goods[good];
  m.today += qtySold;
  if (place) m.regions[regionOf(place)].today += qtySold;
}

export function setShock(state, good, mult, days) {
  const m = state.market.goods[good];
  m.shock = mult;
  m.shockDays = days;
}

export function updateMarket(state) {
  const rng = state.rng;
  // товары дорожают вместе со средней инфляцией в мире
  const cs = Object.values(state.countries || {});
  const inflation = cs.length ? cs.reduce((s, c) => s + (c.inflation ?? 0.02), 0) / cs.length : 0.02;
  for (const [id, m] of Object.entries(state.market.goods)) {
    m.mean *= 1 + inflation / 365;
    const target = m.mean * m.shock;
    m.price += 0.04 * (target - m.price) + m.price * 0.007 * randNormal(rng);
    m.price = Math.max(m.price, m.mean * 0.3);
    m.flow = m.flow * 0.9 + m.today * 0.1;
    m.today = 0;
    if (m.shockDays > 0) {
      m.shockDays--;
      if (m.shockDays === 0) m.shock = 1;
    }
    for (const [r, reg] of Object.entries(m.regions)) {
      const bias = REGION_BIAS[id]?.[r] ?? 1;
      reg.f += 0.02 * (bias - reg.f) + 0.004 * randNormal(rng);
      reg.flow = reg.flow * 0.9 + reg.today * 0.1;
      reg.today = 0;
    }
    if (state.day % 7 === 0) {
      m.hist.push(Math.round(midPrice(state, id) * 1000) / 1000);
      if (m.hist.length > 104) m.hist.shift();
      for (const r of Object.keys(m.regions)) {
        m.regions[r].hist.push(Math.round(midPrice(state, id, r) * 1000) / 1000);
        if (m.regions[r].hist.length > 104) m.regions[r].hist.shift();
      }
    }
  }
}
