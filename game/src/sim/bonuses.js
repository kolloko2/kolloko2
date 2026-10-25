import { regionOf } from './market.js';

// Бонусы от сервисных бизнесов для всей компании. Считаются один раз за игровой день (кэш вне состояния,
// чтобы не попадать в сохранения и сетевые снимки).
const cache = new WeakMap();

function bonusData(state) {
  let c = cache.get(state);
  if (c && c.day === state.day && c.version === state.mapVersion) return c;
  c = {
    day: state.day, version: state.mapVersion, it: new Set(), trucking: new Set(), ads: new Set(), billboards: new Set(),
    energy: new Set(), port: new Set(), mall: new Set(), courier: new Set(),
  };
  for (const u of Object.values(state.units)) {
    if (u.broken > 0) continue;
    const place = state.world.places[u.placeId];
    if (u.type === 'it_studio' && u.staff >= 3) c.it.add(u.companyId);
    if (u.type === 'trucking') c.trucking.add(`${u.companyId}|${regionOf(place)}`);
    if (u.type === 'ad_agency') c.ads.add(`${u.companyId}|${place.country}`);
    if (u.type === 'billboards') c.billboards.add(`${u.companyId}|${place.id}`);
    if (u.type === 'power_plant') c.energy.add(`${u.companyId}|${regionOf(place)}`);
    if (u.type === 'port') c.port.add(`${u.companyId}|${regionOf(place)}`);
    if (u.type === 'shopping_mall') c.mall.add(`${u.companyId}|${state.world.lots[u.lotId].districtId}`);
    if (u.type === 'courier' && u.staff >= 3) c.courier.add(`${u.companyId}|${place.id}`);
  }
  cache.set(state, c);
  return c;
}

// IT-студия: кассовое ПО ускоряет все точки продаж компании
export function itCapacityBoost(state, companyId) {
  return bonusData(state).it.has(companyId) ? 1.1 : 1;
}

// Своя транспортная компания в регионе получателя — доставка дешевле
export function freightFactor(state, companyId, place) {
  return bonusData(state).trucking.has(`${companyId}|${regionOf(place)}`) ? 0.6 : 1;
}

// Своё рекламное агентство в стране — реклама эффективнее
export function marketingBoost(state, companyId, place) {
  return bonusData(state).ads.has(`${companyId}|${place.country}`) ? 1.3 : 1;
}

// Свои рекламные щиты в городе — бесплатные билборды для ваших точек там
export function ownBillboards(state, companyId, placeId) {
  return bonusData(state).billboards.has(`${companyId}|${placeId}`);
}

// Своя электростанция в регионе — коммунальные дешевле
export function energyFactor(state, companyId, place) {
  return bonusData(state).energy.has(`${companyId}|${regionOf(place)}`) ? 0.85 : 1;
}

// Свой порт в регионе отправления — без задержки в портах и дешевле
export function hasPort(state, companyId, place) {
  return bonusData(state).port.has(`${companyId}|${regionOf(place)}`);
}

// Свой ТЦ в районе — точки там платят меньше аренды
export function mallDiscount(state, companyId, districtId) {
  return bonusData(state).mall.has(`${companyId}|${districtId}`) ? 0.7 : 1;
}

// Своя служба доставки в городе
export function ownCourier(state, companyId, placeId) {
  return bonusData(state).courier.has(`${companyId}|${placeId}`);
}
