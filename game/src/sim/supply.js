import { GOODS, TRANSPORT_PER_KG_KM, TRANSPORT_HANDLING_PER_KG } from '../data/goods.js';
import { buyPrice, sellPrice, recordTrade } from './market.js';
import { distanceKm } from './world.js';
import {
  inputGoods, outputGood, invQty, addInv, takeInv, coverDays, lotOf, spend, earn,
} from './units.js';

export function transportCost(good, qty, km) {
  return qty * GOODS[good].weight * (km * TRANSPORT_PER_KG_KM + TRANSPORT_HANDLING_PER_KG);
}

function selfReserve(unit, good) {
  return (unit.usage[good] || 0) * coverDays(good);
}

// Сколько этого товара ежедневно нужно другим бизнесам компании
function internalDemand(state, good, exceptId) {
  let sum = 0;
  for (const u of Object.values(state.units)) if (u.id !== exceptId) sum += u.usage[good] || 0;
  return sum;
}

function payInventory(state, amount) {
  state.company.cash -= amount;
  state.company.totals.out += amount;
}

// Внутренняя поставка от своих производств (по рыночной цене продажи + перевозка)
function supplyInternally(state, unit, good, deficit) {
  const here = lotOf(state, unit);
  const sources = Object.values(state.units)
    .filter((s) => s.id !== unit.id && outputGood(s) === good)
    .map((s) => ({ s, km: distanceKm(here, lotOf(state, s)) }))
    .sort((a, b) => a.km - b.km);
  for (const { s, km } of sources) {
    if (deficit <= 0) break;
    const avail = invQty(s, good) - selfReserve(s, good);
    if (avail <= 0) continue;
    const qty = Math.min(avail, deficit);
    const price = sellPrice(state, good);
    const cost = takeInv(s, good, qty);
    s.month.revInternal += qty * price;
    s.month.cogs += cost;
    s.month.shippedInternal = (s.month.shippedInternal || 0) + qty;
    const transport = transportCost(good, qty, km);
    spend(state, unit, 'transport', transport);
    addInv(unit, good, qty, price + transport / qty);
    unit.supplied[good] = 'internal';
    deficit -= qty;
  }
  return deficit;
}

function buyOnMarket(state, unit, good, qty) {
  const price = buyPrice(state, good, state.world.places[unit.placeId]);
  const affordable = Math.max(0, state.company.cash) / price;
  const q = Math.min(qty, affordable);
  if (q <= 0) {
    unit.supplied[good] = 'nocash';
    return;
  }
  payInventory(state, q * price);
  addInv(unit, good, q, price);
  recordTrade(state, good, -q);
  if (unit.supplied[good] !== 'internal') unit.supplied[good] = 'market';
}

export function procureAll(state) {
  for (const unit of Object.values(state.units)) {
    unit.supplied = {};
    for (const good of inputGoods(unit)) {
      if (good === outputGood(unit)) continue; // своё производство
      const need = unit.usage[good] || 0;
      if (need <= 0) continue;
      let deficit = need * coverDays(good) - invQty(unit, good);
      if (deficit <= need * 0.2) continue;
      deficit = supplyInternally(state, unit, good, deficit);
      if (deficit > 0) buyOnMarket(state, unit, good, deficit);
    }
  }
}

// Излишки производства — на рынок
export function sellSurplus(state) {
  for (const unit of Object.values(state.units)) {
    const good = outputGood(unit);
    if (!good || unit.sellMode === 'hold') continue;
    let reserve = selfReserve(unit, good);
    if (unit.sellMode === 'auto') reserve += internalDemand(state, good, unit.id) * coverDays(good);
    const qty = invQty(unit, good) - reserve;
    if (qty <= 0) continue;
    const price = sellPrice(state, good);
    const cost = takeInv(unit, good, qty);
    earn(state, unit, qty * price);
    unit.month.cogs += cost;
    recordTrade(state, good, qty);
  }
}

export function spoilAll(state) {
  for (const unit of Object.values(state.units)) {
    for (const [good, s] of Object.entries(unit.inv)) {
      const rate = GOODS[good].spoil;
      if (!rate || s.q <= 0) continue;
      const lost = s.q * rate;
      s.q -= lost;
      unit.month.spoilage += lost * s.c;
    }
  }
}
