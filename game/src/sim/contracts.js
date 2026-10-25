import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { buyPrice, sellPrice } from './market.js';
import { deliver } from './logistics.js';
import { addNews } from './state.js';
import { placeOf, productionCapacity, invQty, takeInv, pay, receive, spend, earn, outputGood } from './units.js';

// Контракты с ИИ-контрагентами: фиксированная цена и объём в день на 3–12 месяцев.
//   buy  — поставщик каждый день привозит товар (take-or-pay: платите, даже если товар не нужен);
//   sell — покупатель каждый день забирает продукцию; не хватило товара — штраф 10% от недопоставки.
// Досрочный разрыв — штраф 15% от стоимости оставшегося объёма.
export const CONTRACT_MONTHS = [3, 6, 12];
const SHORTFALL_PENALTY = 0.1;
const CANCEL_PENALTY = 0.15;

// Что могут предложить контрагенты этому бизнесу
export function contractGoods(unit) {
  const def = BUSINESSES[unit.type];
  const buy = def.storage ? Object.keys(unit.usage) : Object.keys(unit.usage).filter((g) => g !== outputGood(unit));
  const sell = def.production ? [def.production.recipe.output] : [];
  return { buy, sell };
}

function niceQty(q) {
  if (q >= 100) return Math.round(q / 10) * 10;
  if (q >= 10) return Math.round(q);
  return Math.max(0.5, Math.round(q * 2) / 2);
}

export function contractOffer(state, unit, good, side, months) {
  const place = placeOf(state, unit);
  if (side === 'buy') {
    const qtyPerDay = niceQty(unit.usage[good] || 0);
    const price = buyPrice(state, good, place) * (1 - 0.03 - 0.01 * (months / 3));
    return { good, side, months, qtyPerDay, price: Math.round(price * 10000) / 10000 };
  }
  const qtyPerDay = niceQty(productionCapacity(state, unit) * 0.6);
  const price = sellPrice(state, good, place) * (1 + 0.02 + 0.01 * (months / 3));
  return { good, side, months, qtyPerDay, price: Math.round(price * 10000) / 10000 };
}

export function remainingValue(state, c) {
  return Math.max(0, c.end - state.day) * c.qtyPerDay * c.price;
}

export function endContract(state, c, { penalty = false } = {}) {
  state.contracts = state.contracts.filter((x) => x.id !== c.id);
  if (penalty) {
    const fine = remainingValue(state, c) * CANCEL_PENALTY;
    const unit = state.units[c.unitId];
    if (unit) spend(state, unit, 'other', fine);
    else pay(state, c.companyId, fine);
    if (c.counterparty && state.companies[c.counterparty]) receive(state, c.counterparty, fine);
    return fine;
  }
  return 0;
}

export function runContracts(state) {
  for (const c of [...state.contracts]) {
    const unit = state.units[c.unitId];
    if (!unit) {
      endContract(state, c);
      continue;
    }
    if (state.day >= c.end) {
      endContract(state, c);
      addNews(state, 'info', `Контракт «${GOODS[c.good].name}» для «${unit.name}» завершён.`, { unitId: unit.id }, c.companyId);
      continue;
    }
    if (c.end - state.day === 15) {
      addNews(state, 'warn', `Через 15 дней кончается контракт «${GOODS[c.good].name}» для «${unit.name}» — продлите или найдите поставки.`, { unitId: unit.id }, c.companyId);
    }
    if (c.side === 'buy') {
      pay(state, c.companyId, c.qtyPerDay * c.price);
      // поставщик — корпорация: деньги уходят ей
      if (c.counterparty && state.companies[c.counterparty] && !state.companies[c.counterparty].bankrupt) receive(state, c.counterparty, c.qtyPerDay * c.price);
      deliver(state, unit, c.good, c.qtyPerDay, c.price, 1);
      unit.supplied[c.good] = 'contract';
    } else {
      const give = Math.min(invQty(unit, c.good), c.qtyPerDay);
      unit.month.cogs += takeInv(unit, c.good, give);
      earn(state, unit, give * c.price);
      const missing = c.qtyPerDay - give;
      if (missing > 0.01) spend(state, unit, 'other', missing * c.price * SHORTFALL_PENALTY);
    }
  }
}
