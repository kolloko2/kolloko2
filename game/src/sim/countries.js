import { COUNTRIES } from '../data/cities.js';
import { LICENSES, COUNTRY_EVENTS } from '../data/laws.js';
import { BUSINESSES } from '../data/businesses.js';
import { rand, chance } from './rng.js';
import { costIndex } from './world.js';
import { addNews } from './state.js';

// Законы и экономика стран. Ставки живут в состоянии: со временем их меняют события.
export function initCountries() {
  const out = {};
  for (const [c, d] of Object.entries(COUNTRIES)) {
    out[c] = { tax: d.tax, tariff: d.tariff, demand: 1, event: null, until: 0, cpi: 1, cpiYear: 1, inflation: baseInflation(d) };
  }
  return out;
}

// Инфляция: в стабильных странах ~2–3% в год, в нестабильных — до 8%
export function baseInflation(d) {
  return 0.02 + 0.08 * (1 - d.stability) ** 1.5;
}

// Индекс цен страны лежит и в местах (городах, регионах) — его читают costIndex, refPrice и зарплаты
export function syncCpi(state) {
  for (const place of Object.values(state.world.places)) place.cpi = state.countries?.[place.country]?.cpi ?? 1;
}

// Раз в месяц: цены, зарплаты и стоимость строительства растут. Раз в год аренда индексируется по инфляции.
export function monthlyInflation(state, newYear) {
  for (const [c, cs] of Object.entries(state.countries)) {
    const base = baseInflation(COUNTRIES[c]);
    cs.inflation += 0.1 * (base - cs.inflation) + 0.004 * (rand(state.rng) - 0.5);
    cs.inflation = Math.min(0.3, Math.max(-0.01, cs.inflation));
    cs.cpi *= 1 + cs.inflation / 12;
  }
  syncCpi(state);
  if (!newYear) return;
  for (const lot of Object.values(state.world.lots)) {
    const cs = state.countries[state.world.places[lot.placeId].country];
    const k = cs.cpi / cs.cpiYear;
    lot.rent = Math.round(lot.rent * k);
    lot.price = Math.round(lot.price * k);
  }
  for (const cs of Object.values(state.countries)) cs.cpiYear = cs.cpi;
  state.mapVersion++;
}

export function countryState(state, c) {
  return state.countries?.[c] || { ...COUNTRIES[c], demand: 1, event: null, until: 0 };
}

export function countryTax(state, c) {
  return countryState(state, c).tax;
}

export function countryDemand(state, c) {
  return countryState(state, c).demand;
}

export function sameBloc(a, b) {
  return a === b || (COUNTRIES[a].bloc && COUNTRIES[a].bloc === COUNTRIES[b].bloc);
}

// Пошлина на ввоз своего товара из страны from в страну to (доля стоимости)
export function tariffRate(state, from, to) {
  return sameBloc(from, to) ? 0 : countryState(state, to).tariff;
}

// Лицензия на бизнес в стране: { id, name, cost } или null, если не нужна / уже есть
export function licenseNeeded(state, companyId, place, type) {
  const id = BUSINESSES[type].license;
  if (!id) return null;
  const co = companyId ? state.companies[companyId] : null;
  if (co?.licenses?.includes(`${place.country}:${id}`)) return null;
  return { id, name: LICENSES[id].name, cost: Math.round(LICENSES[id].cost * costIndex(place) * COUNTRIES[place.country].bureaucracy) };
}

export function grantLicense(state, companyId, place, id) {
  const co = state.companies[companyId];
  (co.licenses ||= []).push(`${place.country}:${id}`);
}

// Раз в месяц: в каждой стране может случиться рецессия, подъём или смена законов
export function monthlyCountryEvents(state) {
  for (const [c, cs] of Object.entries(state.countries)) {
    if (cs.event && state.day >= cs.until) {
      addNews(state, 'info', `Экономика страны ${COUNTRIES[c].name} вернулась к норме.`);
      cs.event = null;
      cs.demand = 1;
    }
    const stab = COUNTRIES[c].stability;
    if (!chance(state.rng, 0.012 + 0.03 * (1 - stab))) continue;
    // плохие события чаще в нестабильных странах
    const pool = COUNTRY_EVENTS.filter((e) => !(e.demand && cs.event) && !(e.onlyUnstable && stab > 0.6));
    const weights = pool.map((e) => (e.unstable ? 1.6 - stab : 0.4 + stab));
    let r = rand(state.rng) * weights.reduce((a, b) => a + b, 0);
    const e = pool.find((_, i) => (r -= weights[i]) < 0) || pool[0];
    if (e.id === 'crisis') cs.inflation += 0.06; // валютный кризис разгоняет цены
    if (e.demand) {
      cs.event = e.id;
      cs.demand = e.demand;
      cs.until = state.day + e.months * 30;
    }
    if (e.tax) cs.tax = Math.round(Math.min(0.45, Math.max(0, cs.tax + e.tax)) * 100) / 100;
    if (e.tariff) cs.tariff = Math.round(Math.min(0.35, Math.max(0, cs.tariff + e.tariff)) * 100) / 100;
    addNews(state, e.kind, `🌍 ${e.text(COUNTRIES[c].name, cs)}`);
  }
}
