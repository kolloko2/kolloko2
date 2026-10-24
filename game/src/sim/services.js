import { BUSINESSES } from '../data/businesses.js';
import { regionOf } from './market.js';
import { costIndex } from './world.js';
import { invQty, takeInv, earn, placeOf } from './units.js';
import { efficiency } from './staff.js';

// Сервисные бизнесы (грузоперевозки, реклама, IT) зарабатывают на заказах ИИ-клиентов.
// Чем больше одинаковых сервисов в регионе (у всех компаний), тем меньше заказов на каждого.
export function serviceRevenuePerStaff(state, def, place, type, extra = 1) {
  const region = regionOf(place);
  let n = extra;
  for (const u of Object.values(state.units)) {
    if (u.type === type && regionOf(state.world.places[u.placeId]) === region) n++;
  }
  // Для «умных» услуг важны квалифицированные кадры и платёжеспособные клиенты — они есть в богатых городах
  const talent = def.service.talent ? 0.3 + 0.7 * Math.min(1, place.income ?? 0.5) : 1;
  return (def.service.revenuePerStaff * costIndex(place) * talent) / (1 + 0.08 * (n - 1));
}

export function runServices(state) {
  for (const unit of Object.values(state.units)) {
    const def = BUSINESSES[unit.type];
    if (!def.service) continue;
    let working = unit.broken > 0 ? 0 : unit.staff;
    for (const [g, q] of Object.entries(def.service.inputs)) working = Math.min(working, invQty(unit, g) / q);
    working = Math.floor(Math.max(0, working));
    let cost = 0;
    for (const [g, q] of Object.entries(def.service.inputs)) cost += takeInv(unit, g, working * q);
    const revenue = working * serviceRevenuePerStaff(state, def, placeOf(state, unit), unit.type, 0) * efficiency(state, unit);
    earn(state, unit, revenue);
    unit.month.cogs += cost;
    unit.today.working = working;
    unit.today.revenue = revenue;
    unit.today.inputShort = working < unit.staff && unit.broken === 0;
  }
}
