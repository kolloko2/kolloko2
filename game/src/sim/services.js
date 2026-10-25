import { BUSINESSES } from '../data/businesses.js';
import { regionOf } from './market.js';
import { costIndex } from './world.js';
import { invQty, takeInv, earn, placeOf } from './units.js';
import { efficiency } from './staff.js';
import { countryDemand } from './countries.js';
import { DISTRICTS } from '../data/districts.js';
import { randNormal } from './rng.js';

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

// Аренда в ТЦ и бизнес-центре: площадь участка × этажность × ставка района (в месяц, при заполненности 100%)
export function realEstateRentFor(state, lot, type, level = 1) {
  const place = state.world.places[lot.placeId];
  const district = state.world.districts[lot.districtId];
  return (lot.area * BUSINESSES[type].service.realEstate * DISTRICTS[district.type].rent * (place.rent ?? 1) * (place.cpi ?? 1) * (1 + 0.25 * (level - 1))) / 3.3;
}

export function realEstateRent(state, unit) {
  return realEstateRentFor(state, state.world.lots[unit.lotId], unit.type, unit.level);
}

// Настроение спроса на услугу: у каждой своя волатильность и чувствительность к экономике страны
export function serviceMood(state, unit) {
  const s = BUSINESSES[unit.type].service;
  return (unit.mood ?? 1) * countryDemand(state, placeOf(state, unit).country) ** (s.cycle ?? 1);
}

// Раз в месяц настроение услуги случайно сдвигается (риск бизнеса)
export function monthlyServiceMood(state) {
  for (const unit of Object.values(state.units)) {
    const s = BUSINESSES[unit.type].service;
    if (!s) continue;
    const m = unit.mood ?? 1;
    unit.mood = Math.round(Math.min(1.7, Math.max(0.35, m + (s.volatility ?? 0.05) * randNormal(state.rng) - 0.25 * (m - 1))) * 1000) / 1000;
  }
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
    let revenue;
    if (def.service.realEstate) {
      // арендаторы платят за площадь; заполненность зависит от рынка, штат держит здание в порядке
      const occupancy = Math.min(1, Math.max(0.3, 0.88 * serviceMood(state, unit)));
      revenue = (realEstateRent(state, unit) / 30) * occupancy * Math.min(1, working / def.staff.def);
      unit.today.occupancy = occupancy;
    } else {
      revenue = working * serviceRevenuePerStaff(state, def, placeOf(state, unit), unit.type, 0) * efficiency(state, unit) * serviceMood(state, unit);
    }
    earn(state, unit, revenue);
    unit.month.cogs += cost;
    unit.today.working = working;
    unit.today.revenue = revenue;
    unit.today.inputShort = working < unit.staff && unit.broken === 0;
  }
}
