import { GOODS, TRANSPORT_PER_KG_KM, TRANSPORT_HANDLING_PER_KG } from '../data/goods.js';
import { addInv } from './units.js';

// Доставка товаров. Закупка у местного оптовика приходит на следующий день; поставки между своими
// бизнесами идут столько, сколько ехать: ~700 км в день, межконтинентальные — ещё +3 дня в портах.
const KM_PER_DAY = 700;
const SEA_KM = 3000;
const PORT_DAYS = 3;
export const BULK_FREIGHT = 0.4; // тариф на крупные партии до склада — 40% от обычного

export function leadDays(km) {
  return Math.max(1, Math.ceil(km / KM_PER_DAY)) + (km > SEA_KM ? PORT_DAYS : 0);
}

export function transportCost(good, qty, km, { bulk = false } = {}) {
  const rate = TRANSPORT_PER_KG_KM * (bulk ? BULK_FREIGHT : 1);
  return qty * GOODS[good].weight * (GOODS[good].freight ?? 1) * (km * rate + TRANSPORT_HANDLING_PER_KG);
}

// Отправить товар бизнесу. Груз на 1 день лежит в unit.incoming, дольше — в state.shipments
export function deliver(state, unit, good, qty, unitCost, days, fromId = null) {
  if (qty <= 0) return;
  if (days <= 1) {
    const s = (unit.incoming[good] ||= { q: 0, c: 0 });
    s.c = (s.q * s.c + qty * unitCost) / (s.q + qty);
    s.q += qty;
    return;
  }
  state.shipments.push({
    id: state.nextShipmentId++,
    companyId: unit.companyId,
    to: unit.id,
    from: fromId,
    good,
    qty,
    unitCost,
    sent: state.day,
    arrive: state.day + days,
  });
}

// Сколько товара едет к бизнесу. within — учитывать только то, что прибудет за этот срок (дней)
export function inTransit(state, unit, good, within = Infinity) {
  let q = unit.incoming[good]?.q ?? 0;
  for (const s of state.shipments) {
    if (s.to === unit.id && s.good === good && s.arrive - state.day <= within) q += s.qty;
  }
  return q;
}

// Начало дня: разгружаем прибывшее. Скоропорт портится в дороге.
export function receiveDeliveries(state) {
  for (const unit of Object.values(state.units)) {
    for (const [good, s] of Object.entries(unit.incoming)) addInv(unit, good, s.q, s.c);
    unit.incoming = {};
  }
  const pending = [];
  for (const s of state.shipments) {
    if (s.arrive > state.day) {
      pending.push(s);
      continue;
    }
    const unit = state.units[s.to];
    if (!unit) continue; // получатель закрыт — груз пропал
    const left = s.qty * (1 - GOODS[s.good].spoil) ** (s.arrive - s.sent);
    unit.month.spoilage += (s.qty - left) * s.unitCost;
    addInv(unit, s.good, left, s.unitCost);
  }
  state.shipments = pending;
}
