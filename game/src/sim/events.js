import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { chance } from './rng.js';
import { setShock } from './market.js';
import { addNews } from './state.js';
import { costIndex } from './world.js';
import { lotOf, placeOf, spend } from './units.js';

// Мировые события на товарных рынках (проверяются раз в месяц)
const MARKET_EVENTS = [
  { good: 'coffee_green', chance: 0.02, mult: 1.7, days: 180, kind: 'bad', text: 'Заморозки в Бразилии уничтожили часть урожая кофе. Зерно дорожает.' },
  { good: 'coffee_green', chance: 0.02, mult: 0.75, days: 120, kind: 'good', text: 'Рекордный урожай кофе во Вьетнаме — зерно дешевеет.' },
  { good: 'milk', chance: 0.02, mult: 1.4, days: 90, kind: 'bad', text: 'Нехватка кормов: молоко подорожало.' },
  { good: 'wheat', chance: 0.025, mult: 1.5, days: 150, kind: 'bad', text: 'Засуха в зерновых регионах — пшеница дорожает.' },
  { good: 'wheat', chance: 0.025, mult: 0.75, days: 150, kind: 'good', text: 'Богатый урожай пшеницы — цены падают.' },
  { good: 'meat', chance: 0.015, mult: 1.35, days: 120, kind: 'bad', text: 'Эпидемия у скота: мясо подорожало.' },
  { good: 'sugar', chance: 0.015, mult: 1.3, days: 120, kind: 'bad', text: 'Неурожай тростника — сахар дорожает.' },
  { good: 'cups', chance: 0.01, mult: 1.25, days: 90, kind: 'bad', text: 'Нефть подорожала — пластиковая упаковка тоже.' },
];

export function monthlyEvents(state) {
  const rng = state.rng;
  for (const e of MARKET_EVENTS) {
    if (state.market.goods[e.good].shockDays > 0) continue;
    if (chance(rng, e.chance)) {
      setShock(state, e.good, e.mult, e.days);
      addNews(state, e.kind, `${GOODS[e.good].icon} ${e.text}`);
    }
  }
  for (const unit of Object.values(state.units)) {
    const def = BUSINESSES[unit.type];
    const lot = lotOf(state, unit);
    if (def.retail && chance(rng, 0.06)) {
      if (unit.quality < 2.8) {
        const fine = Math.round(1500 * costIndex(placeOf(state, unit)));
        spend(state, unit, 'other', fine);
        addNews(state, 'bad', `Санинспекция в «${unit.name}»: нарушения, штраф $${fine}.`, { unitId: unit.id }, unit.companyId);
      } else {
        unit.awareness = Math.min(0.95, unit.awareness + 0.02);
        addNews(state, 'info', `Санинспекция в «${unit.name}» прошла без замечаний.`, { unitId: unit.id }, unit.companyId);
      }
    }
    if (!lot.ownerId && chance(rng, 0.02)) {
      lot.rent = Math.round(lot.rent * 1.12);
      addNews(state, 'warn', `Арендодатель поднял аренду для «${unit.name}» до $${lot.rent}/мес. Можно выкупить помещение.`, { unitId: unit.id }, unit.companyId);
    }
  }
}

export function dailyEvents(state) {
  const rng = state.rng;
  for (const unit of Object.values(state.units)) {
    const def = BUSINESSES[unit.type];
    if (unit.broken === 0 && chance(rng, 0.0012)) {
      unit.broken = 2;
      const cost = Math.round(def.capex * 0.03 * costIndex(placeOf(state, unit)));
      spend(state, unit, 'other', cost);
      addNews(state, 'bad', `Поломка оборудования в «${unit.name}»: 2 дня простоя, ремонт $${cost}.`, { unitId: unit.id }, unit.companyId);
    }
    if (def.retail && chance(rng, 0.0006)) {
      unit.awareness = Math.min(0.95, unit.awareness + 0.12);
      addNews(state, 'good', `Блогер похвалил «${unit.name}» — о вас узнало больше людей!`, { unitId: unit.id }, unit.companyId);
    }
  }
}
