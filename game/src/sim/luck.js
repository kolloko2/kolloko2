import { COUNTRIES } from '../data/cities.js';
import { DISTRICTS } from '../data/districts.js';
import { addNews } from './state.js';
import { chance, rand, randNormal, randPick } from './rng.js';

// Удача и мода: каждая партия складывается по-своему.
//   trends[страна][категория] — мода на категорию (кофе, фастфуд…), медленно гуляет и иногда резко меняется;
//   districtEvents[район] — фестиваль, ремонт дороги, новая станция метро.
const CATEGORY_NAMES = {
  coffee: 'кофейни', fastfood: 'фастфуд', grocery: 'магазины у дома', bakery: 'пекарни', restaurant: 'рестораны', fuel: 'АЗС', electronics: 'гаджеты',
};
const FADS = {
  coffee: ['спешелти-кофе', 'кофе с собой'], fastfood: ['уличная еда', 'бургеры'], bakery: ['ремесленный хлеб'], restaurant: ['гастрономический туризм'],
  grocery: ['доставка продуктов'], electronics: ['новый смартфон'], fuel: ['автопутешествия'],
};

export function trendOf(state, country, category) {
  return state.trends?.[country]?.[category] ?? 1;
}

export function districtEventOf(state, districtId) {
  const e = state.districtEvents?.[districtId];
  return e && e.until > state.day ? e : null;
}

const DISTRICT_EVENTS = [
  { kind: 'festival', mult: 1.35, months: 1, good: true, text: (d) => `Фестиваль в районе «${d}»: толпы гостей, спрос +35% на месяц.` },
  { kind: 'roadworks', mult: 0.7, months: 2, good: false, text: (d) => `Ремонт дороги в районе «${d}»: поток людей упал на 30% на два месяца.` },
  { kind: 'metro', mult: 1.15, months: 600, good: true, text: (d) => `Открыли новую станцию метро у района «${d}»: поток людей вырос на 15% — навсегда.` },
  { kind: 'office', mult: 1.2, months: 600, good: true, text: (d) => `В районе «${d}» открылся большой офисный центр: +20% покупателей.` },
  { kind: 'closure', mult: 0.85, months: 600, good: false, text: (d) => `Крупный завод у района «${d}» закрылся: покупателей стало на 15% меньше.` },
];

export function monthlyLuck(state) {
  state.trends ||= {};
  state.districtEvents ||= {};
  // мода по странам
  for (const c of Object.keys(COUNTRIES)) {
    const t = (state.trends[c] ||= {});
    for (const cat of Object.keys(CATEGORY_NAMES)) {
      const m = t[cat] ?? 1;
      t[cat] = Math.round(Math.min(1.35, Math.max(0.75, m + 0.015 * randNormal(state.rng) - 0.04 * (m - 1))) * 1000) / 1000;
    }
    if (chance(state.rng, 0.012)) {
      const cat = randPick(state.rng, Object.keys(CATEGORY_NAMES));
      const up = rand(state.rng) < 0.55;
      t[cat] = Math.round(Math.min(1.35, Math.max(0.75, t[cat] + (up ? 0.15 : -0.15))) * 1000) / 1000;
      const fad = randPick(state.rng, FADS[cat]);
      addNews(state, up ? 'good' : 'warn', up
        ? `📈 В стране ${COUNTRIES[c].name} мода на «${fad}»: ${CATEGORY_NAMES[cat]} в тренде.`
        : `📉 В стране ${COUNTRIES[c].name} мода на «${fad}» прошла: ${CATEGORY_NAMES[cat]} теряют покупателей.`);
    }
  }
  // события в районах, где есть бизнесы игроков
  const busy = new Set();
  for (const u of Object.values(state.units)) if (!state.companies[u.companyId]?.ai) busy.add(state.world.lots[u.lotId].districtId);
  for (const did of busy) {
    if (districtEventOf(state, did) || !chance(state.rng, 0.02)) continue;
    const d = state.world.districts[did];
    if (!Object.keys(DISTRICTS[d.type].demand).length) continue;
    const e = randPick(state.rng, DISTRICT_EVENTS);
    state.districtEvents[did] = { kind: e.kind, mult: e.mult, until: state.day + e.months * 30 };
    const name = `${DISTRICTS[d.type].name}, ${state.world.places[d.placeId].name}`;
    const owners = new Set();
    for (const lid of d.lotIds) {
      const u = state.units[state.world.lots[lid].unitId];
      if (u) owners.add(u.companyId);
    }
    for (const cid of owners) addNews(state, e.good ? 'good' : 'warn', e.text(name), { districtId: did }, cid);
  }
}
