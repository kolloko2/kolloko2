import { createRng } from './rng.js';
import { generateWorld } from './world.js';
import { initMarket } from './market.js';
import { unitAssetValue } from './units.js';

export const SAVE_VERSION = 1;
export const START_CASH = 50000;
const START_DATE = Date.UTC(2000, 0, 1);

export function createGame({ seed = 12345, companyName = 'Моя компания' } = {}) {
  const rng = createRng(seed);
  const world = generateWorld(rng);
  return {
    version: SAVE_VERSION,
    seed,
    rng,
    day: 0,
    world,
    market: initMarket(),
    company: {
      name: companyName,
      cash: START_CASH,
      loan: 0,
      loanRate: 0.12,
      month: { interest: 0, tax: 0 },
      history: [],
      negativeDays: 0,
      bankrupt: false,
      totals: { in: 0, out: 0 },
      startCash: START_CASH,
    },
    units: {},
    nextUnitId: 1,
    news: [],
    mapVersion: 0,
  };
}

export function dateOf(day) {
  return new Date(START_DATE + day * 86400000);
}

export function formatDate(day) {
  return dateOf(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function monthLabel(day) {
  return dateOf(day).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function addNews(state, kind, text, ref = null) {
  state.news.unshift({ day: state.day, kind, text, ref });
  if (state.news.length > 150) state.news.length = 150;
}

export function netWorth(state) {
  let assets = state.company.cash;
  for (const u of Object.values(state.units)) assets += unitAssetValue(state, u);
  for (const lot of Object.values(state.world.lots)) if (lot.owned) assets += lot.price;
  return assets - state.company.loan;
}

export function loanLimit(state) {
  const h = state.company.history.slice(-3);
  const avgProfit = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  let assets = 0;
  for (const u of Object.values(state.units)) assets += u.bookValue;
  for (const lot of Object.values(state.world.lots)) if (lot.owned) assets += lot.price;
  return Math.round(30000 + 24 * Math.max(0, avgProfit) + 0.5 * assets);
}
