import { BUSINESSES } from '../data/businesses.js';
import { techLevel } from './research.js';
import { regionOf } from './market.js';
import { costIndex } from './world.js';
import { COUNTRIES } from '../data/cities.js';

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

// Разовый сбор за выход на рынок страны (регистрация, юристы); в бюрократичных странах дороже
export function entryFee(state, companyId, place, type) {
  const co = state.companies[companyId];
  if (!co.homeCountry || co.homeCountry === place.country) return 0;
  if (presenceIn(state, companyId, place.country).any > 0) return 0;
  return Math.round((isConsumer(type) ? ENTRY_FEE.consumer : ENTRY_FEE.other) * costIndex(place) * COUNTRIES[place.country].bureaucracy);
}

// Оптовая скидка у поставщиков региона: 2 точки — 1%, 4 — 2%, 8 — 3%, 16+ — 4%
export function purchasingDiscount(state, companyId, place) {
  const n = counts(state).region[`${companyId}|${regionOf(place)}`] || 0;
  return n < 2 ? 0 : Math.min(0.04, 0.01 * Math.floor(Math.log2(n)));
}

// Управленческие расходы штаб-квартиры: бухгалтерия, юристы, IT, закупки. Растут быстрее числа бизнесов —
// огромная сеть мелких точек себя не окупает, империи нужны крупные и прибыльные активы.
// Точки в сети дешевле в управлении (единые стандарты), франчайзи — бесплатно.
export const OVERHEAD_BASE = 250;
export const OVERHEAD_POWER = 1.3;
export function overhead(state, companyId, extra = 0) {
  let n = 0;
  let units = 0;
  let cpi = 0;
  for (const u of Object.values(state.units)) {
    if (u.companyId !== companyId) continue;
    n += u.brandId ? 0.75 : 1;
    units++;
    cpi += state.world.places[u.placeId].cpi ?? 1;
  }
  n += extra;
  if (n <= 3) return 0;
  return OVERHEAD_BASE * (n - 3) ** OVERHEAD_POWER * (units ? cpi / units : 1) * (1 - 0.15 * techLevel(state, companyId, 'holding'));
}

// Насколько вырастут расходы штаба, если открыть ещё одну точку
export function marginalOverhead(state, companyId, branded = false) {
  return overhead(state, companyId, branded ? 0.75 : 1) - overhead(state, companyId);
}
