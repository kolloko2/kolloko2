import { BUSINESSES } from '../data/businesses.js';
import { regionOf } from './market.js';
import { costIndex } from './world.js';

// Расширение «как в жизни»: домашняя страна, выход на новые рынки, местная команда, оптовые скидки.
// Касается точек для людей (розница, услуги); сырьё и производство продаются на весь мир без ограничений.
export const ENTRY_FEE = { consumer: 15000, other: 6000 }; // при индексе цен 1
export const LOCAL_TEAM_UNITS = 3; // столько точек в стране — и у вас там своя команда
export const FOREIGN_COST = 1.1; // без местной команды зарплаты и содержание дороже

export function isConsumer(type) {
  const def = BUSINESSES[type];
  return Boolean(def.retail || def.service);
}

const cache = new WeakMap();

function counts(state) {
  let c = cache.get(state);
  if (c && c.day === state.day && c.version === state.mapVersion) return c;
  c = { day: state.day, version: state.mapVersion, consumer: {}, any: {}, region: {} };
  for (const u of Object.values(state.units)) {
    const place = state.world.places[u.placeId];
    const k = `${u.companyId}|${place.country}`;
    c.any[k] = (c.any[k] || 0) + 1;
    if (isConsumer(u.type)) c.consumer[k] = (c.consumer[k] || 0) + 1;
    const r = `${u.companyId}|${regionOf(place)}`;
    c.region[r] = (c.region[r] || 0) + 1;
  }
  cache.set(state, c);
  return c;
}

// Точки компании в стране: { consumer, any }
export function presenceIn(state, companyId, country) {
  const c = counts(state);
  return { consumer: c.consumer[`${companyId}|${country}`] || 0, any: c.any[`${companyId}|${country}`] || 0 };
}

export function presenceByCountry(state, companyId) {
  const c = counts(state);
  const out = {};
  for (const [k, n] of Object.entries(c.any)) {
    const [co, country] = k.split('|');
    if (co === companyId) out[country] = { any: n, consumer: c.consumer[k] || 0 };
  }
  return out;
}

export function hasLocalTeam(state, companyId, country) {
  const co = state.companies[companyId];
  return !co.homeCountry || co.homeCountry === country || presenceIn(state, companyId, country).consumer >= LOCAL_TEAM_UNITS;
}

// Множитель зарплат и содержания для точки
export function foreignFactor(state, unit) {
  if (!isConsumer(unit.type)) return 1;
  return hasLocalTeam(state, unit.companyId, state.world.places[unit.placeId].country) ? 1 : FOREIGN_COST;
}

// Разовый сбор за выход на рынок страны (регистрация, юристы, лицензии)
export function entryFee(state, companyId, place, type) {
  const co = state.companies[companyId];
  if (!co.homeCountry || co.homeCountry === place.country) return 0;
  if (presenceIn(state, companyId, place.country).any > 0) return 0;
  return Math.round((isConsumer(type) ? ENTRY_FEE.consumer : ENTRY_FEE.other) * costIndex(place));
}

// Оптовая скидка у поставщиков региона: 2 точки — 1%, 4 — 2%, 8 — 3%, 16+ — 4%
export function purchasingDiscount(state, companyId, place) {
  const n = counts(state).region[`${companyId}|${regionOf(place)}`] || 0;
  return n < 2 ? 0 : Math.min(0.04, 0.01 * Math.floor(Math.log2(n)));
}
