import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { buyPrice, sellPrice, recordTrade } from './market.js';
import { distanceKm } from './world.js';
import { leadDays, transportCost, deliver, inTransit } from './logistics.js';
import {
  inputGoods, outputGood, invQty, takeInv, coverDays, lotOf, placeOf, spend, earn, pay,
} from './units.js';

export function isWarehouse(unit) {
  return Boolean(BUSINESSES[unit.type].storage);
}

// Вместимость склада, кг
export function storageCapacity(state, unit) {
  const s = BUSINESSES[unit.type].storage;
  return s ? s.perArea * lotOf(state, unit).area * (1 + 0.5 * (unit.level - 1)) : Infinity;
}

export function storedKg(state, unit) {
  let kg = 0;
  for (const [g, s] of Object.entries(unit.inv)) kg += s.q * GOODS[g].weight;
  for (const [g, s] of Object.entries(unit.incoming)) kg += s.q * GOODS[g].weight;
  for (const sh of state.shipments) if (sh.to === unit.id) kg += sh.qty * GOODS[sh.good].weight;
  return kg;
}

// Бизнесы компании, которые обслуживает склад (в радиусе)
export function servedBy(state, wh) {
  const radius = BUSINESSES[wh.type].storage.radiusKm;
  const here = lotOf(state, wh);
  return Object.values(state.units).filter((u) => u.companyId === wh.companyId && u.id !== wh.id && !isWarehouse(u)
    && distanceKm(here, lotOf(state, u)) <= radius);
}

// Склад запасает то, что ежедневно тратят обслуживаемые им бизнесы (кроме того, что они производят сами)
function warehouseUsage(state, wh) {
  const need = {};
  for (const u of servedBy(state, wh)) {
    for (const [g, q] of Object.entries(u.usage)) if (g !== outputGood(u)) need[g] = (need[g] || 0) + q;
  }
  return need;
}

function selfReserve(unit, good) {
  if (isWarehouse(unit)) return 0;
  return (unit.usage[good] || 0) * coverDays(good);
}

function cover(unit, good) {
  return isWarehouse(unit) ? unit.coverDays : coverDays(good);
}

// Сколько этого товара ежедневно нужно другим бизнесам той же компании
function internalDemand(state, unit, good) {
  let sum = 0;
  for (const u of Object.values(state.units)) {
    if (u.id !== unit.id && u.companyId === unit.companyId && !isWarehouse(u)) sum += u.usage[good] || 0;
  }
  return sum;
}

// Сколько заказать, если товар идёт lead дней: запас на (страховые дни + дорога) минус то, что есть
// и что успеет приехать за это время (дальний груз не спасёт от пустых полок завтра)
function orderQty(state, unit, good, lead) {
  const need = unit.usage[good] || 0;
  return need * (cover(unit, good) + lead) - invQty(unit, good) - inTransit(state, unit, good, lead);
}

function capRoom(state, unit, good, qty) {
  if (!isWarehouse(unit)) return qty;
  const room = (storageCapacity(state, unit) - storedKg(state, unit)) / GOODS[good].weight;
  return Math.max(0, Math.min(qty, room));
}

// Поставки от своих производств и складов: ближайшие первыми, с учётом дней в пути
function supplyInternally(state, unit, good) {
  const here = lotOf(state, unit);
  const toWarehouse = isWarehouse(unit);
  const sources = Object.values(state.units)
    .filter((s) => s.id !== unit.id && s.companyId === unit.companyId
      && (outputGood(s) === good || (isWarehouse(s) && !toWarehouse && invQty(s, good) > 0)))
    .map((s) => ({ s, km: distanceKm(here, lotOf(state, s)) }))
    .sort((a, b) => a.km - b.km);
  const market = buyPrice(state, good, placeOf(state, unit), { bulk: toWarehouse });
  for (const { s, km } of sources) {
    const lead = leadDays(km);
    const want = capRoom(state, unit, good, orderQty(state, unit, good, lead));
    if (want <= (unit.usage[good] || 0) * 0.2) continue;
    const avail = invQty(s, good) - selfReserve(s, good);
    if (avail <= 0) continue;
    const fromWarehouse = isWarehouse(s);
    // производство «продаёт» своим по рыночной цене своего региона, склад передаёт по себестоимости
    const price = fromWarehouse ? s.inv[good].c : sellPrice(state, good, placeOf(state, s));
    // везти своё имеет смысл, только если с доставкой выходит не дороже местного рынка
    if (price + transportCost(good, 1, km, { bulk: toWarehouse }) > market) continue;
    const qty = Math.min(avail, want);
    const cost = takeInv(s, good, qty);
    s.month.revInternal += qty * price;
    s.month.cogs += cost;
    s.month.shippedInternal = (s.month.shippedInternal || 0) + qty;
    const transport = transportCost(good, qty, km, { bulk: toWarehouse });
    spend(state, unit, 'transport', transport);
    deliver(state, unit, good, qty, price + transport / qty, lead, s.id);
    (unit.sources ||= {})[good] = s.id; // для линий цепочек на карте
    unit.supplied[good] = fromWarehouse ? 'warehouse' : 'internal';
  }
}

function buyOnMarket(state, unit, good) {
  const want = capRoom(state, unit, good, orderQty(state, unit, good, 1));
  if (want <= (unit.usage[good] || 0) * 0.2) return;
  const place = placeOf(state, unit);
  const price = buyPrice(state, good, place, { bulk: isWarehouse(unit) });
  const q = Math.min(want, Math.max(0, state.companies[unit.companyId].cash) / price);
  if (q <= 0) {
    unit.supplied[good] = 'nocash';
    return;
  }
  pay(state, unit.companyId, q * price);
  deliver(state, unit, good, q, price, 1);
  recordTrade(state, good, -q, place);
  if (!unit.supplied[good]) unit.supplied[good] = 'market';
}

export function procureAll(state) {
  for (const unit of Object.values(state.units)) {
    if (isWarehouse(unit)) unit.usage = warehouseUsage(state, unit);
  }
  for (const unit of Object.values(state.units)) {
    const contracted = unit.supplied;
    unit.supplied = {};
    for (const [g, v] of Object.entries(contracted)) if (v === 'contract') unit.supplied[g] = v;
    const goods = isWarehouse(unit) ? Object.keys(unit.usage) : inputGoods(unit);
    for (const good of goods) {
      if (good === outputGood(unit)) continue; // своё производство
      if (!(unit.usage[good] > 0)) continue;
      supplyInternally(state, unit, good);
      buyOnMarket(state, unit, good);
    }
  }
}

// Излишки производства — на рынок своего региона
export function sellSurplus(state) {
  for (const unit of Object.values(state.units)) {
    const good = outputGood(unit);
    if (!good || unit.sellMode === 'hold') continue;
    let reserve = selfReserve(unit, good);
    if (unit.sellMode === 'auto') reserve += internalDemand(state, unit, good) * coverDays(good);
    const qty = invQty(unit, good) - reserve;
    if (qty <= 0) continue;
    const place = placeOf(state, unit);
    const price = sellPrice(state, good, place);
    const cost = takeInv(unit, good, qty);
    earn(state, unit, qty * price);
    unit.month.cogs += cost;
    recordTrade(state, good, qty, place);
  }
}

export function spoilAll(state) {
  for (const unit of Object.values(state.units)) {
    // на складе условия хранения лучше — скоропорт портится вдвое медленнее
    const factor = isWarehouse(unit) ? 0.5 : 1;
    for (const [good, s] of Object.entries(unit.inv)) {
      const rate = GOODS[good].spoil * factor;
      if (!rate || s.q <= 0) continue;
      const lost = s.q * rate;
      s.q -= lost;
      unit.month.spoilage += lost * s.c;
    }
  }
}
