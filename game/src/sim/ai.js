import { DISTRICTS } from '../data/districts.js';
import { districtShares } from './demand.js';
import { chance } from './rng.js';
import { addNews } from './state.js';

// Фоновые ИИ-конкуренты: открываются там, где у продавцов (и ИИ, и игроков) много покупателей — высокая
// прибыль привлекает конкурентов, — и закрываются там, где им не хватает клиентов.
// [ниже — закрываются, выше — открываются] покупателей в день на одного ИИ-конкурента
const THRESHOLDS = {
  coffee: [70, 230],
  fastfood: [70, 240],
  grocery: [80, 280],
  bakery: [60, 200],
  restaurant: [25, 90],
  fuel: [40, 150],
  electronics: [15, 50],
  hotel: [20, 70],
  fitness: [80, 260],
  beauty: [20, 60],
  pharmacy: [60, 200],
  cars: [1, 4],
  autoservice: [10, 35],
};

const CATEGORY_NAMES = {
  coffee: 'кофейню',
  fastfood: 'фастфуд',
  grocery: 'магазин',
  bakery: 'пекарню',
  restaurant: 'ресторан',
  fuel: 'АЗС',
  electronics: 'магазин техники',
  hotel: 'отель',
  fitness: 'фитнес-клуб',
  beauty: 'салон красоты',
  pharmacy: 'аптеку',
  cars: 'автосалон',
  autoservice: 'автосервис',
};

export function monthlyAI(state) {
  for (const d of Object.values(state.world.districts)) {
    const demand = DISTRICTS[d.type].demand;
    for (const [cat, [lo, hi]] of Object.entries(THRESHOLDS)) {
      if (!demand[cat]) continue;
      const sh = districtShares(state, d, cat);
      // компании игроков, у которых есть точки этой категории в районе
      const owners = [...new Set(Object.keys(sh.byUnit).map((id) => state.units[id].companyId))];
      const place = state.world.places[d.placeId];
      const where = `${place.name}, ${DISTRICTS[d.type].name.toLowerCase()}`;
      const sellers = sh.ai + Object.keys(sh.byUnit).length;
      const perSeller = sellers ? (sh.potential * (1 - sh.outsideShare)) / sellers : sh.potential;
      if ((sh.aiCustomersEach > hi || perSeller > hi) && chance(state.rng, 0.35)) {
        d.ai[cat] = (d.ai[cat] || 0) + 1;
        for (const c of owners) addNews(state, 'warn', `Конкурент открыл ${CATEGORY_NAMES[cat]} рядом с вами (${where}).`, { districtId: d.id }, c);
      } else if ((d.ai[cat] || 0) > 0 && sh.aiCustomersEach < lo && chance(state.rng, 0.35)) {
        d.ai[cat]--;
        for (const c of owners) addNews(state, 'good', `Конкурент закрыл ${CATEGORY_NAMES[cat]}, не выдержав конкуренции (${where}).`, { districtId: d.id }, c);
      }
    }
  }
}
