import { createRng } from './rng.js';
import { generateWorld } from './world.js';
import { initMarket } from './market.js';
import { unitAssetValue } from './units.js';
import { initCountries, syncCpi } from './countries.js';
import { initStocks, portfolioValue } from './stocks.js';
import { addRivals } from './rivals.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

export const SAVE_VERSION = 8; // 8: участки в кварталах, компактные сохранения (сид + снимок)
export const START_CASH = 100000;
const START_DATE = Date.UTC(2000, 0, 1);

// Режимы: solo — один игрок; coop — несколько игроков управляют одной компанией;
// pvp — у каждого игрока своя компания, все конкурируют в одном мире.
export const MODES = ['solo', 'coop', 'pvp'];
export const COMPANY_COLORS = ['#2f6fed', '#e8590c', '#2b8a3e', '#ae3ec9', '#c92a2a', '#1098ad', '#e67700', '#5c7cfa'];

/** @returns {Company} */
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
    licenses: [], // 'страна:лицензия'
    payout: 0.3, // доля прибыли на дивиденды (если компания на бирже)
  };
}

// victory — условие победы (см. goals.js), обычно для PvP
// rivals — сколько ИИ-корпораций в мире (0–4)
/**
 * @param {{ seed?: number, mode?: 'solo'|'coop'|'pvp', companyNames?: string[], victory?: any, rivals?: number }} [opts]
 * @returns {State}
 */
export function createGame({ seed = 12345, mode = 'solo', companyNames = ['Моя компания'], victory = null, rivals = 4 } = {}) {
  const rng = createRng(seed);
  const world = generateWorld(rng);
  /** @type {State} */
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
    nextRivalId: 1,
    units: {},
    nextUnitId: 1,
    shipments: [], // грузы в пути дольше одного дня
    nextShipmentId: 1,
    contracts: [],
    nextContractId: 1,
    brands: {}, // сети компаний
    nextBrandId: 1,
    countries: initCountries(), // налоги, пошлины, состояние экономики стран
    trends: {}, // мода на категории по странам (см. luck.js)
    districtEvents: {}, // фестивали, ремонты, метро
    offers: [], // предложения ИИ-корпораций игрокам
    growth: {}, // рост населения городов от застройщиков
    nextOfferId: 1,
    stocks: initStocks(rng), // биржа: ИИ-корпорации и компании игроков после IPO
    news: [],
    newsSeq: 0,
    mapVersion: 0,
  };
  syncCpi(state);
  for (const name of companyNames) addCompany(state, name);
  addRivals(state, rivals);
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

// Компании живых игроков (без ИИ-корпораций)
export function playerCompanies(state) {
  return Object.values(state.companies).filter((c) => !c.ai);
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
/** @param {any} state @param {string} kind @param {string} text @param {Record<string, any>|null} [ref] @param {string|null} [companyId] */
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

// Капитал без ценных бумаг (по нему биржа оценивает компанию — так нет замкнутого круга при перекрёстном владении)
export function coreWorth(state, companyId) {
  const co = state.companies[companyId];
  let assets = co.cash + ownedLotsValue(state, companyId);
  for (const u of companyUnits(state, companyId)) assets += unitAssetValue(state, u);
  return assets - co.loan;
}

export function netWorth(state, companyId) {
  return coreWorth(state, companyId) + portfolioValue(state, companyId);
}

// Свой банк: ставка ниже на 3 п.п., лимит выше на 30%
function hasBank(state, companyId) {
  return Object.values(state.units).some((u) => u.companyId === companyId && u.type === 'bank');
}

export function loanRate(state, companyId) {
  const co = state.companies[companyId];
  return Math.max(0.02, co.loanRate - (hasBank(state, companyId) ? 0.03 : 0));
}

export function loanLimit(state, companyId) {
  const co = state.companies[companyId];
  const h = co.history.slice(-3);
  const avgProfit = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  let assets = ownedLotsValue(state, companyId);
  for (const u of companyUnits(state, companyId)) assets += u.bookValue;
  return Math.round((30000 + 12 * Math.max(0, avgProfit) + 0.4 * assets) * (hasBank(state, companyId) ? 1.3 : 1));
}
