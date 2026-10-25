import { BUSINESSES } from '../data/businesses.js';
import { chance } from './rng.js';
import { addNews, companyUnits } from './state.js';

// Персонал: зарплата, мораль, управляющие, «очки внимания» владельца и рынок труда города.
export const BASE_ATTENTION = 5; // столько точек владелец ведёт сам без потерь
export const MANAGER_WAGE = 4500; // зарплата управляющего при индексе зарплат 1
export const WAGE_LEVELS = [0.8, 1, 1.2, 1.5];
const DEFAULT_MORALE = 65;

export const morale = (unit) => unit.morale ?? DEFAULT_MORALE;
export const wageLevel = (unit) => unit.wageLevel ?? 1;

// Кэш на игровой день: внимание компаний и спрос на работников в городах (не сохраняется в состояние)
const cache = new WeakMap();

function dayData(state) {
  let c = cache.get(state);
  if (c && c.day === state.day && c.version === state.mapVersion) return c;
  c = { day: state.day, version: state.mapVersion, unmanaged: {}, hired: {} };
  for (const u of Object.values(state.units)) {
    // точка в сети требует вдвое меньше внимания: единые стандарты, закупки и отчётность
    if (!u.manager) {
      // под присмотром регионального директора точка требует ещё меньше внимания
      const director = state.companies[u.companyId]?.directors?.[state.world.places[u.placeId].country];
      c.unmanaged[u.companyId] = (c.unmanaged[u.companyId] || 0) + (u.brandId ? 0.5 : 1) * (director ? 0.3 : 1);
    }
    c.hired[u.placeId] = (c.hired[u.placeId] || 0) + u.staff;
  }
  cache.set(state, c);
  return c;
}

export function attention(state, companyId) {
  const used = dayData(state).unmanaged[companyId] || 0;
  return { used: Math.round(used * 10) / 10, limit: BASE_ATTENTION, excess: Math.max(0, Math.ceil(used - BASE_ATTENTION - 1e-9)) };
}

// Рынок труда: если игроки наняли заметную долю работников города, зарплаты растут для всех
export function laborFactor(state, place) {
  if (place.kind !== 'city') return 1;
  const pool = place.pop * 1500;
  const share = (dayData(state).hired[place.id] || 0) / pool;
  return 1 + Math.max(0, share - 0.2) * 1.5;
}

// Итоговая производительность сотрудников точки
export function efficiency(state, unit) {
  const m = morale(unit);
  let e = 0.8 + 0.4 * (m / 100); // мораль 0 → 80%, 50 → 100%, 100 → 120%
  if (unit.manager) e *= 1.05;
  else e *= Math.max(0.6, 1 - 0.04 * attention(state, unit.companyId).excess);
  e *= 1 + 0.05 * (unit.training || 0); // обученный персонал работает быстрее
  return e;
}

// Управляющий киоска — старший смены, управляющий завода — директор: зарплата зависит от масштаба бизнеса
export function managerCost(place, type) {
  const scale = Math.min(1.6, Math.max(0.35, BUSINESSES[type].capex / 120000));
  return MANAGER_WAGE * place.wage * (place.cpi ?? 1) * scale;
}

function moraleTarget(unit) {
  let t = 65 + (wageLevel(unit) - 1) * 100;
  t -= 25 * (unit.queue || 0); // перегрузка
  if (unit.manager) t += 8;
  if (unit.broken > 0) t -= 5;
  return Math.max(0, Math.min(100, t));
}

// Подогнать штат под спрос (раз в неделю, если включено у управляющего)
export function autoStaff(state, unit, perStaffEff) {
  const def = BUSINESSES[unit.type];
  const s = def.staff;
  let want = unit.staff;
  if (def.retail) {
    const demand = unit.today.potential ?? 0;
    want = Math.ceil((Math.min(demand, def.retail.cap[unit.level - 1]) * 1.05) / (def.retail.perStaff * perStaffEff));
  } else if (def.production && !unit.today.inputShort) {
    const place = state.world.places[unit.placeId];
    const lot = state.world.lots[unit.lotId];
    const p = def.production;
    const cap = p.cap ? p.cap[unit.level - 1] : p.capPerArea * lot.area * (1 + 0.5 * (unit.level - 1));
    want = Math.ceil(cap / (p.perStaff * (place.productivity ?? 1) * perStaffEff));
  }
  want = Math.max(s.min, Math.min(s.max, want));
  if (want !== unit.staff) unit.staff = want;
}

export function updateStaff(state) {
  const rng = state.rng;
  for (const unit of Object.values(state.units)) {
    const m = morale(unit);
    unit.morale = m + (moraleTarget(unit) - m) * 0.05;
    const min = BUSINESSES[unit.type].staff.min;
    // недовольные увольняются
    if (unit.morale < 35 && unit.staff > min && chance(rng, 0.03)) {
      unit.staff--;
      unit.training = Math.max(0, (unit.training || 0) - 0.5); // уходят обученные люди
      addNews(state, 'warn', `Из «${unit.name}» уволился сотрудник: низкая мораль. Поднимите зарплату или наймите управляющего.`, { unitId: unit.id }, unit.companyId);
    }
    if (unit.manager && unit.autoStaff && state.day % 7 === 0) autoStaff(state, unit, efficiency(state, unit));
  }
}

// Обучение: +5% к скорости и +0.1★ за уровень (до 3). Стоит ~60% месячного фонда зарплат точки.
export const MAX_TRAINING = 3;
export const STAR_WAGE = 3; // звезда стоит как три обычных сотрудника

export function trainingCost(state, unit, monthlyWage) {
  return Math.round(unit.staff * monthlyWage * 0.6 * (1 + (unit.training || 0)));
}

export function monthlyStaffEvents(state) {
  for (const unit of Object.values(state.units)) {
    // при зарплате ниже рынка обученные уходят к конкурентам
    if ((unit.training || 0) > 0 && wageLevel(unit) < 1) unit.training = Math.max(0, unit.training - 0.15);
    // звёздный сотрудник: шеф-повар, бариста-чемпион, стилист — сам приходит в сильные точки
    const def = BUSINESSES[unit.type];
    if (def.retail && !unit.star && unit.quality >= 3.3 && !state.companies[unit.companyId]?.ai && chance(state.rng, 0.004)) {
      unit.star = true;
      addNews(state, 'good', `⭐ В «${unit.name}» пришёл звёздный сотрудник: +0.4★ к рейтингу, но и зарплата как у троих. Отпустить можно в панели точки.`, { unitId: unit.id }, unit.companyId);
    } else if (unit.star && morale(unit) < 45 && chance(state.rng, 0.2)) {
      unit.star = false;
      addNews(state, 'warn', `⭐ Звёздный сотрудник ушёл из «${unit.name}»: не понравилась атмосфера.`, { unitId: unit.id }, unit.companyId);
    }
    if (morale(unit) < 25 && unit.broken === 0 && chance(state.rng, 0.3)) {
      unit.broken = 3;
      unit.morale = morale(unit) + 10;
      addNews(state, 'bad', `Забастовка в «${unit.name}»: 3 дня простоя. Сотрудники требуют повышения зарплаты.`, { unitId: unit.id }, unit.companyId);
    }
  }
}

export function managersCount(state, companyId) {
  return companyUnits(state, companyId).filter((u) => u.manager).length;
}
