import { createRng } from './rng.js';
import { generateWorld } from './world.js';
import { initMarket } from './market.js';
import { unitAssetValue } from './units.js';

export const SAVE_VERSION = 3; // 3: районы и участки только на суше (мир по сиду изменился)
export const START_CASH = 50000;
const START_DATE = Date.UTC(2000, 0, 1);

// Режимы: solo — один игрок; coop — несколько игроков управляют одной компанией;
// pvp — у каждого игрока своя компания, все конкурируют в одном мире.
export const MODES = ['solo', 'coop', 'pvp'];
export const COMPANY_COLORS = ['#2f6fed', '#e8590c', '#2b8a3e', '#ae3ec9', '#c92a2a', '#1098ad', '#e67700', '#5c7cfa'];

function newCompany(id, name, color) {
  return {
    id,
    name,
    color,
    cash: START_CASH,
    loan: 0,
    loanRate: 0.12,
    month: { interest: 0, tax: 0 },
    history: [],
    negativeDays: 0,
    bankrupt: false,
    totals: { in: 0, out: 0 },
    homeCountry: null, // страна первого бизнеса — там компания «своя»
  };
}

// victory — условие победы (см. goals.js), обычно для PvP
export function createGame({ seed = 12345, mode = 'solo', companyNames = ['Моя компания'], victory = null } = {}) {
  const rng = createRng(seed);
  const world = generateWorld(rng);
  const state = {
    version: SAVE_VERSION,
    seed,
    mode,
    victory,
    winner: null,
    rng,
    day: 0,
    world,
    market: initMarket(),
    companies: {},
    nextCompanyId: 1,
    units: {},
    nextUnitId: 1,
    shipments: [], // грузы в пути дольше одного дня
    nextShipmentId: 1,
    contracts: [],
    nextContractId: 1,
    brands: {}, // сети компаний
    nextBrandId: 1,
    news: [],
    newsSeq: 0,
    mapVersion: 0,
  };
  for (const name of companyNames) addCompany(state, name);
  return state;
}

export function addCompany(state, name) {
  const n = state.nextCompanyId++;
  const id = `c${n}`;
  state.companies[id] = newCompany(id, name, COMPANY_COLORS[(n - 1) % COMPANY_COLORS.length]);
  state.mapVersion++;
  return id;
}

export function companyUnits(state, companyId) {
  return Object.values(state.units).filter((u) => u.companyId === companyId);
}

export function activeCompanies(state) {
  return Object.values(state.companies).filter((c) => !c.bankrupt);
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

// companyId = null — новость для всех (мировые события)
export function addNews(state, kind, text, ref = null, companyId = null) {
  state.news.unshift({ seq: ++state.newsSeq, day: state.day, kind, text, ref, companyId });
  if (state.news.length > 300) state.news.length = 300;
}

export function newsFor(state, companyId) {
  return state.news.filter((n) => n.companyId === null || n.companyId === companyId);
}

function ownedLotsValue(state, companyId) {
  let sum = 0;
  for (const lot of Object.values(state.world.lots)) if (lot.ownerId === companyId) sum += lot.price;
  return sum;
}

export function netWorth(state, companyId) {
  const co = state.companies[companyId];
  let assets = co.cash + ownedLotsValue(state, companyId);
  for (const u of companyUnits(state, companyId)) assets += unitAssetValue(state, u);
  return assets - co.loan;
}

export function loanLimit(state, companyId) {
  const co = state.companies[companyId];
  const h = co.history.slice(-3);
  const avgProfit = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  let assets = ownedLotsValue(state, companyId);
  for (const u of companyUnits(state, companyId)) assets += u.bookValue;
  return Math.round(30000 + 24 * Math.max(0, avgProfit) + 0.5 * assets);
}
