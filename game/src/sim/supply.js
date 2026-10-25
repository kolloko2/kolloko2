import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { buyPrice, sellPrice, recordTrade, qualityPrice } from './market.js';
import { distanceKm } from './world.js';
import { leadDays, transportCost, deliver, inTransit, SEA_KM, PORT_DAYS } from './logistics.js';
import { freightFactor, hasPort } from './bonuses.js';
import { purchasingDiscount } from './expansion.js';
import { tariffRate } from './countries.js';
import { techLevel } from './research.js';
import {
  inputGoods, outputGood, invQty, invK, gradeK, takeInv, coverDays, lotOf, placeOf, spend, earn, pay,
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

// Индекс на игровой день: кто что производит, где склады, сколько каждого товара нужно компании.
// Без него поиск поставщиков перебирал бы все бизнесы мира для каждой точки и товара.
const indexCache = new WeakMap();
function dayIndex(state) {
  let c = indexCache.get(state);
  if (c && c.day === state.day && c.version === state.mapVersion) return c;
  c = { day: state.day, version: state.mapVersion, producers: new Map(), warehouses: new Map(), demand: new Map() };
  for (const u of Object.values(state.units)) {
    const out = outputGood(u);
    if (out) {
      const k = `${u.companyId}|${out}`;
      if (!c.producers.has(k)) c.producers.set(k, []);
      c.producers.get(k).push(u);
    }
    if (isWarehouse(u)) {
      if (!c.warehouses.has(u.companyId)) c.warehouses.set(u.companyId, []);
      c.warehouses.get(u.companyId).push(u);
    }
  }
  indexCache.set(state, c);
  return c;
}

// Свои поставщики товара для точки, ближайшие первыми. Расстояния не меняются, пока не открылся/закрылся бизнес,
// поэтому список кэшируется до следующего изменения карты.
const sourceCache = new WeakMap();
function sortedSources(state, unit, good, toWarehouse) {
  let c = sourceCache.get(state);
  if (!c || c.version !== state.mapVersion) {
    c = { version: state.mapVersion, lists: new Map() };
    sourceCache.set(state, c);
  }
  const key = `${unit.id}|${good}`;
  let list = c.lists.get(key);
  if (!list) {
    const idx = dayIndex(state);
    const here = lotOf(state, unit);
    const candidates = [...(idx.producers.get(`${unit.companyId}|${good}`) || []), ...(toWarehouse ? [] : idx.warehouses.get(unit.companyId) || [])];
    list = candidates.filter((s) => s.id !== unit.id).map((s) => ({ s, km: distanceKm(here, lotOf(state, s)) })).sort((a, b) => a.km - b.km);
    c.lists.set(key, list);
  }
  return list;
}

// Потребность компании в товаре (считается по свежим usage, поэтому — после закупок, раз в день)
function companyDemand(state, companyId, good) {
  const c = dayIndex(state);
  if (!c.demandReady) {
    for (const u of Object.values(state.units)) {
      if (isWarehouse(u)) continue;
      for (const [g, q] of Object.entries(u.usage)) {
        const k = `${u.companyId}|${g}`;
        c.demand.set(k, (c.demand.get(k) || 0) + q);
      }
    }
    c.demandReady = true;
  }
  return c.demand.get(`${companyId}|${good}`) || 0;
}

// Сколько этого товара ежедневно нужно другим бизнесам той же компании
function internalDemand(state, unit, good) {
  return companyDemand(state, unit.companyId, good) - (isWarehouse(unit) ? 0 : unit.usage[good] || 0);
}

// Сколько заказать, если товар идёт lead дней: запас на (страховые дни + дорога) минус то, что есть
// и что успеет приехать за это время (дальний груз не спасёт от пустых полок завтра)
function orderQty(state, unit, good, lead) {
  const need = unit.usage[good] || 0;
  // «держать на полке N»: пополняем до заданного запаса
  const target = unit.target?.[good];
  if (target !== undefined) return target - invQty(unit, good) - inTransit(state, unit, good);
  return need * (cover(unit, good) + lead) - invQty(unit, good) - inTransit(state, unit, good, lead);
}

function capRoom(state, unit, good, qty) {
  if (!isWarehouse(unit)) return qty;
  const room = (storageCapacity(state, unit) - storedKg(state, unit)) / GOODS[good].weight;
  return Math.max(0, Math.min(qty, room));
}

// Поставки от своих производств и складов: ближайшие первыми, с учётом дней в пути
function supplyInternally(state, unit, good) {
  const toWarehouse = isWarehouse(unit);
  const sources = sortedSources(state, unit, good, toWarehouse).filter(({ s }) => state.units[s.id] && invQty(s, good) > 0);
  for (const { s, km } of sources) shipFrom(state, unit, good, s, km, true);
}

// Цена своего товара для получателя: у производства — рыночная цена его региона за его класс, у склада — себестоимость
export function internalQuote(state, unit, good, s, km) {
  const toWarehouse = isWarehouse(unit);
  const viaPort = km > SEA_KM && hasPort(state, unit.companyId, placeOf(state, s));
  const lead = leadDays(km) - (viaPort ? PORT_DAYS : 0);
  const seaFactor = viaPort ? 0.7 : 1;
  const k = invK(s, good);
  const price = isWarehouse(s) ? s.inv[good]?.c ?? 0 : sellPrice(state, good, placeOf(state, s)) * qualityPrice(k, good);
  const duty = tariffRate(state, placeOf(state, s).country, placeOf(state, unit).country);
  const transport = transportCost(good, 1, km, { bulk: toWarehouse }) * seaFactor * freightFactor(state, unit.companyId, placeOf(state, unit))
    * (1 - 0.12 * techLevel(state, unit.companyId, 'logistics'));
  return { price, duty, transport, lead, seaFactor, k, total: price * (1 + duty) + transport };
}

// Отгрузка от своего бизнеса s. checkPrice — везти, только если с доставкой не дороже рынка того же класса
function shipFrom(state, unit, good, s, km, checkPrice) {
  const toWarehouse = isWarehouse(unit);
  const q = internalQuote(state, unit, good, s, km);
  const want = capRoom(state, unit, good, orderQty(state, unit, good, q.lead));
  if (want <= (unit.usage[good] || 0) * 0.2) return;
  const avail = invQty(s, good) - selfReserve(s, good);
  if (avail <= 0) return;
  if (checkPrice && q.total > buyPrice(state, good, placeOf(state, unit), { bulk: toWarehouse }) * qualityPrice(q.k, good)) return;
  const qty = Math.min(avail, want);
  const cost = takeInv(s, good, qty);
  s.month.revInternal += qty * q.price;
  s.month.cogs += cost;
  s.month.shippedInternal = (s.month.shippedInternal || 0) + qty;
  spend(state, unit, 'transport', q.transport * qty);
  if (q.duty) spend(state, unit, 'duty', qty * q.price * q.duty);
  // доставка и пошлина уже записаны в отчёт отдельными строками — в себестоимость запаса их не включаем
  deliver(state, unit, good, qty, q.price, q.lead, s.id, q.k);
  (unit.sources ||= {})[good] = s.id; // для линий цепочек на карте
  unit.supplied[good] = isWarehouse(s) ? 'warehouse' : 'internal';
}

// Поставщики товара для окна закупок: рынок (по выбранному классу) и свои производства и склады
export function supplierOptions(state, unit, good) {
  const place = placeOf(state, unit);
  const k = gradeK(unit, good);
  const list = [{ key: 'market', name: 'Рынок (оптовики)', price: buyPrice(state, good, place, { bulk: isWarehouse(unit) }) * qualityPrice(k, good), k, lead: 1, km: 0, stock: Infinity }];
  for (const { s, km } of sortedSources(state, unit, good, isWarehouse(unit))) {
    if (!state.units[s.id]) continue;
    const q = internalQuote(state, unit, good, s, km);
    list.push({ key: s.id, name: s.name, price: q.total, k: q.k, lead: q.lead, km, stock: invQty(s, good) });
  }
  return list;
}

function buyOnMarket(state, unit, good) {
  const want = capRoom(state, unit, good, orderQty(state, unit, good, 1));
  if (want <= (unit.usage[good] || 0) * 0.2) return;
  const place = placeOf(state, unit);
  // класс закупки выбирает владелец точки: дешёвый, стандарт, премиум или элитный
  const k = gradeK(unit, good);
  const price = buyPrice(state, good, place, { bulk: isWarehouse(unit) }) * qualityPrice(k, good) * (1 - purchasingDiscount(state, unit.companyId, place));
  const q = Math.min(want, Math.max(0, state.companies[unit.companyId].cash) / price);
  if (q <= 0) {
    unit.supplied[good] = 'nocash';
    return;
  }
  pay(state, unit.companyId, q * price);
  deliver(state, unit, good, q, price, 1, null, k);
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
      if (!(unit.usage[good] > 0) && unit.target?.[good] === undefined) continue;
      // поставщик: auto — свои, если дешевле, иначе рынок; market — только рынок; id бизнеса — только он
      const from = unit.suppliers?.[good] ?? 'auto';
      if (from === 'auto') {
        supplyInternally(state, unit, good);
        buyOnMarket(state, unit, good);
      } else if (from === 'market') {
        buyOnMarket(state, unit, good);
      } else {
        const src = state.units[from];
        if (src && src.companyId === unit.companyId) shipFrom(state, unit, good, src, distanceKm(lotOf(state, unit), lotOf(state, src)), false);
        if (!unit.supplied[good]) unit.supplied[good] = 'empty';
      }
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
    const price = sellPrice(state, good, place) * qualityPrice(invK(unit, good), good);
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
