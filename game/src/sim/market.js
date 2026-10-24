import { GOODS, MARKET_BUY_MARKUP, MARKET_SELL_DISCOUNT } from '../data/goods.js';
import { randNormal } from './rng.js';
import { priceIndex } from './world.js';

const IMPACT_K = 0.4; // насколько объёмы игрока двигают цену
const MAX_IMPACT = 0.5;

export function initMarket() {
  const goods = {};
  for (const [id, g] of Object.entries(GOODS)) {
    goods[id] = { price: g.base, mean: g.base, shock: 1, shockDays: 0, flow: 0, today: 0, hist: [g.base] };
  }
  return { goods };
}

// Текущая цена с учётом давления объёмов игрока (продаёт много — цена ниже)
export function midPrice(state, good) {
  const m = state.market.goods[good];
  const impact = Math.max(-MAX_IMPACT, Math.min(MAX_IMPACT, (-IMPACT_K * m.flow) / GOODS[good].depth));
  return m.price * (1 + impact);
}

// place — где покупаем (важно для местных товаров)
export function buyPrice(state, good, place = null) {
  const local = GOODS[good].local && place ? 0.3 + 0.7 * priceIndex(place) : 1;
  return midPrice(state, good) * (1 + MARKET_BUY_MARKUP) * local;
}

export function sellPrice(state, good) {
  return midPrice(state, good) * (1 - MARKET_SELL_DISCOUNT);
}

export function recordTrade(state, good, qtySold) {
  // qtySold > 0 — игрок продал рынку, < 0 — купил
  state.market.goods[good].today += qtySold;
}

export function setShock(state, good, mult, days) {
  const m = state.market.goods[good];
  m.shock = mult;
  m.shockDays = days;
}

export function updateMarket(state) {
  const rng = state.rng;
  for (const [id, m] of Object.entries(state.market.goods)) {
    m.mean *= 1 + 0.02 / 365; // фоновая инфляция 2% в год
    const target = m.mean * m.shock;
    m.price += 0.04 * (target - m.price) + m.price * 0.007 * randNormal(rng);
    m.price = Math.max(m.price, m.mean * 0.3);
    m.flow = m.flow * 0.9 + m.today * 0.1;
    m.today = 0;
    if (m.shockDays > 0) {
      m.shockDays--;
      if (m.shockDays === 0) m.shock = 1;
    }
    if (state.day % 7 === 0) {
      m.hist.push(Math.round(midPrice(state, id) * 1000) / 1000);
      if (m.hist.length > 104) m.hist.shift();
    }
  }
}
