import { TECHS, STAT_TECHS } from '../data/tech.js';
import { BUSINESSES } from '../data/businesses.js';
import { COUNTRIES } from '../data/cities.js';
import { addNews, companyUnits } from './state.js';
import { spendCompany } from './units.js';
import { chance } from './rng.js';

// Исследования, лоббирование и льготы крупным работодателям.

// Изучена ли технология (узел дерева)
export function hasTech(state, companyId, id) {
  return Boolean(state.companies[companyId]?.tech?.[id]);
}

// Уровень бонуса: сколько изучено технологий с этим stat (pos, automation…); для открывающих технологий — 0 или 1
export function techLevel(state, companyId, stat) {
  const tech = state.companies[companyId]?.tech;
  if (!tech) return 0;
  const ids = STAT_TECHS[stat];
  if (!ids) return tech[stat] ? 1 : 0;
  let n = 0;
  for (const id of ids) if (tech[id]) n++;
  return n;
}

// Цена (с учётом мировой инфляции)
export function techCost(state, companyId, id) {
  return Math.round(TECHS[id].cost * (state.countries?.US?.cpi ?? 1));
}

// Почему нельзя изучать: уже изучено или не хватает предыдущих
export function techLocked(state, companyId, id) {
  const t = TECHS[id];
  if (hasTech(state, companyId, id)) return 'Изучено';
  const miss = t.requires.filter((req) => !hasTech(state, companyId, req));
  if (miss.length) return `Сначала: ${miss.map((req) => `«${TECHS[req].name}»`).join(', ')}`;
  return null;
}

// IT-студии с 3+ программистами ускоряют исследования: +25% каждая, до +50%
export function researchSpeed(state, companyId) {
  const it = companyUnits(state, companyId).filter((u) => u.type === 'it_studio' && u.staff >= 3 && !(u.broken > 0)).length;
  return 1 + 0.25 * Math.min(2, it);
}

// Тип бизнеса закрыт технологией?
export function missingTech(state, companyId, type) {
  const req = BUSINESSES[type].requiresTech;
  if (!req || !companyId) return null;
  return hasTech(state, companyId, req) ? null : TECHS[req].name;
}

export function startResearch(state, companyId, id) {
  const co = state.companies[companyId];
  co.research = { id, cost: techCost(state, companyId, id), days: TECHS[id].months * 30, progress: 0 };
}

// Каждый день: оплата и продвижение исследования
export function runResearch(state) {
  for (const co of Object.values(state.companies)) {
    const r = co.research;
    if (!r || co.bankrupt) continue;
    if (co.cash <= 0) continue; // нет денег — работа стоит
    const speed = researchSpeed(state, co.id);
    spendCompany(state, co.id, 'research', (r.cost / r.days) * speed);
    r.progress += speed;
    if (r.progress >= r.days) {
      co.tech ||= {};
      co.tech[r.id] = 1;
      co.research = null;
      state.mapVersion++;
      addNews(state, 'good', `${TECHS[r.id].icon} Исследование завершено: «${TECHS[r.id].name}» — ${TECHS[r.id].desc.toLowerCase()}.`, null, co.id);
    }
  }
}

// ---------- лоббирование ----------
export const LOBBY_GOALS = {
  tax: { name: 'Снизить налог на прибыль', delta: -0.03 },
  tariff: { name: 'Снизить импортные пошлины', delta: -0.04 },
};
export const LOBBY_COOLDOWN = 365;

export function lobbyCost(state, country) {
  return Math.round(300000 * COUNTRIES[country].bureaucracy * (state.countries?.[country]?.cpi ?? 1));
}

// Шанс: чем больше у вас работников в стране, тем охотнее власти слушают
export function employees(state, companyId, country) {
  let n = 0;
  for (const u of Object.values(state.units)) {
    if (u.companyId === companyId && state.world.places[u.placeId].country === country) n += u.staff + (u.manager ? 1 : 0);
  }
  return n;
}

export function lobbyChance(state, companyId, country) {
  return Math.min(0.9, 0.2 + employees(state, companyId, country) / 1500 + 0.1 * techLevel(state, companyId, 'pr'));
}

export function lobby(state, companyId, country, goal) {
  const cs = state.countries[country];
  const g = LOBBY_GOALS[goal];
  const ok = chance(state.rng, lobbyChance(state, companyId, country));
  const co = state.companies[companyId];
  (co.lobbied ||= {})[country] = state.day;
  if (!ok) {
    addNews(state, 'bad', `Лоббирование в стране ${COUNTRIES[country].name} не удалось: закон не прошёл. Деньги потрачены.`, null, companyId);
    return false;
  }
  if (goal === 'tax') cs.tax = Math.max(0, Math.round((cs.tax + g.delta) * 100) / 100);
  else cs.tariff = Math.max(0, Math.round((cs.tariff + g.delta) * 100) / 100);
  addNews(state, 'info', `🏛️ В стране ${COUNTRIES[country].name} приняли закон: ${goal === 'tax' ? `налог на прибыль ${Math.round(cs.tax * 100)}%` : `пошлины ${Math.round(cs.tariff * 100)}%`}. Говорят, не без помощи «${co.name}».`);
  return true;
}

// Крупный работодатель (500+ работников в стране) получает налоговую льготу −5 п.п.
export const BIG_EMPLOYER = 500;
export function taxBreak(state, companyId, country) {
  return (employees(state, companyId, country) >= BIG_EMPLOYER ? 0.05 : 0) + 0.02 * techLevel(state, companyId, 'tax');
}
