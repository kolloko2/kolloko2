import { BUSINESSES, MAX_LEVEL, UPGRADE_COST_FACTOR } from '../data/businesses.js';
import { sellPrice, recordTrade } from './market.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { canBuildHere, forecast } from './forecast.js';
import { addNews, loanLimit } from './state.js';
import { emptyMonth, capexFor, defaultPrices, dailyNeed, productionCapacity, takeInv } from './units.js';

// Все действия игрока — команды. Функция возвращает { ok } или { ok: false, error }.
// В мультиплеере эти же команды будет применять сервер.

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

function pay(state, amount) {
  state.company.cash -= amount;
  state.company.totals.out += amount;
}

function receive(state, amount) {
  state.company.cash += amount;
  state.company.totals.in += amount;
}

function getUnit(state, id) {
  return state.units[id] || null;
}

const handlers = {
  openBusiness(state, { lotId, businessType }) {
    const lot = state.world.lots[lotId];
    const def = BUSINESSES[businessType];
    if (!lot || !def) return fail('Неизвестный участок или тип бизнеса');
    if (lot.unitId) return fail('Участок уже занят');
    if (!canBuildHere(state, lot, businessType)) return fail('Здесь нельзя открыть такой бизнес');
    const capex = capexFor(state, lot, businessType);
    if (state.company.cash < capex) return fail(`Не хватает денег: нужно $${capex.toLocaleString('ru-RU')}`);
    const place = state.world.places[lot.placeId];
    const fc = forecast(state, lotId, businessType);
    pay(state, capex);
    const sameType = Object.values(state.units).filter((u) => u.type === businessType).length;
    const id = `u${state.nextUnitId++}`;
    const unit = {
      id,
      type: businessType,
      name: `${def.name} №${sameType + 1}`,
      lotId,
      placeId: lot.placeId,
      opened: state.day,
      level: 1,
      staff: fc.staff,
      prices: defaultPrices(state, lot, businessType),
      marketing: Math.round(def.marketing * costIndex(place)),
      awareness: 0.1 + 0.2 * lot.visibility,
      quality: 3,
      queue: 0,
      inv: {},
      usage: {},
      supplied: {},
      sellMode: 'auto',
      month: emptyMonth(),
      last: null,
      history: [],
      today: {},
      broken: 0,
      bookValue: capex,
    };
    unit.usage = dailyNeed(unit, fc.customers, def.production ? productionCapacity(state, { ...unit }) : 0);
    state.units[id] = unit;
    lot.unitId = id;
    state.mapVersion++;
    addNews(state, 'good', `Открыт бизнес «${unit.name}» — ${place.name}. Вложено $${capex.toLocaleString('ru-RU')}.`, { unitId: id });
    return { ok: true, unitId: id };
  },

  closeBusiness(state, { unitId }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    let cash = 0;
    for (const [g, s] of Object.entries(unit.inv)) {
      if (s.q <= 0) continue;
      cash += s.q * sellPrice(state, g);
      recordTrade(state, g, s.q);
      takeInv(unit, g, s.q);
    }
    cash += unit.bookValue * 0.3;
    receive(state, cash);
    state.world.lots[unit.lotId].unitId = null;
    delete state.units[unitId];
    state.mapVersion++;
    addNews(state, 'info', `«${unit.name}» закрыт. Оборудование и запасы проданы за $${Math.round(cash).toLocaleString('ru-RU')}.`);
    return OK;
  },

  setPrice(state, { unitId, productId, price }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    const product = BUSINESSES[unit.type].retail?.products.find((p) => p.id === productId);
    if (!product) return fail('Нет такого продукта');
    const ref = refPrice(state.world.places[unit.placeId], product);
    if (!(price > 0) || price > ref * 5) return fail('Недопустимая цена');
    unit.prices[productId] = Math.round(price * 100) / 100;
    return OK;
  },

  setStaff(state, { unitId, staff }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    const s = BUSINESSES[unit.type].staff;
    if (!Number.isInteger(staff) || staff < s.min || staff > s.max) return fail(`Персонал: от ${s.min} до ${s.max}`);
    unit.staff = staff;
    return OK;
  },

  setMarketing(state, { unitId, budget }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!(budget >= 0) || budget > 1e6) return fail('Недопустимый бюджет');
    unit.marketing = Math.round(budget);
    return OK;
  },

  setSellMode(state, { unitId, mode }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!['auto', 'all', 'hold'].includes(mode)) return fail('Неизвестный режим');
    unit.sellMode = mode;
    return OK;
  },

  upgrade(state, { unitId }) {
    const unit = getUnit(state, unitId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.level >= MAX_LEVEL) return fail('Максимальный уровень');
    const cost = upgradeCost(state, unit);
    if (state.company.cash < cost) return fail(`Не хватает денег: нужно $${cost.toLocaleString('ru-RU')}`);
    pay(state, cost);
    unit.level++;
    unit.bookValue += cost;
    addNews(state, 'good', `«${unit.name}» улучшен до уровня ${unit.level}.`, { unitId });
    return OK;
  },

  copySettings(state, { unitId }) {
    const src = getUnit(state, unitId);
    if (!src) return fail('Нет такого бизнеса');
    const def = BUSINESSES[src.type];
    const srcPlace = state.world.places[src.placeId];
    let n = 0;
    for (const u of Object.values(state.units)) {
      if (u.id === src.id || u.type !== src.type) continue;
      const place = state.world.places[u.placeId];
      if (def.retail) {
        for (const p of def.retail.products) {
          const ratio = src.prices[p.id] / refPrice(srcPlace, p);
          u.prices[p.id] = Math.round(refPrice(place, p) * ratio * 100) / 100;
        }
      }
      u.marketing = Math.round((src.marketing / costIndex(srcPlace)) * costIndex(place));
      u.sellMode = src.sellMode;
      n++;
    }
    return { ok: true, count: n };
  },

  takeLoan(state, { amount }) {
    const co = state.company;
    if (!(amount > 0)) return fail('Сумма должна быть больше нуля');
    const limit = loanLimit(state);
    if (co.loan + amount > limit) return fail(`Банк одобряет максимум $${Math.max(0, limit - co.loan).toLocaleString('ru-RU')}`);
    co.loan += amount;
    receive(state, amount);
    addNews(state, 'info', `Получен кредит $${amount.toLocaleString('ru-RU')} под ${Math.round(co.loanRate * 100)}% годовых.`);
    return OK;
  },

  repayLoan(state, { amount }) {
    const co = state.company;
    const a = Math.min(amount, co.loan, Math.max(0, co.cash));
    if (!(a > 0)) return fail('Нечего гасить или нет денег');
    co.loan -= a;
    pay(state, a);
    return OK;
  },

  buyLot(state, { lotId }) {
    const lot = state.world.lots[lotId];
    if (!lot) return fail('Нет такого участка');
    if (lot.owned) return fail('Уже ваш');
    if (state.company.cash < lot.price) return fail(`Не хватает денег: нужно $${lot.price.toLocaleString('ru-RU')}`);
    pay(state, lot.price);
    lot.owned = true;
    state.mapVersion++;
    addNews(state, 'good', `Куплена недвижимость за $${lot.price.toLocaleString('ru-RU')}. Аренда больше не нужна.`);
    return OK;
  },

  sellLot(state, { lotId }) {
    const lot = state.world.lots[lotId];
    if (!lot || !lot.owned) return fail('Это не ваш участок');
    receive(state, lot.price * 0.95);
    lot.owned = false;
    state.mapVersion++;
    return OK;
  },

  renameCompany(state, { name }) {
    const n = String(name || '').trim().slice(0, 40);
    if (!n) return fail('Пустое название');
    state.company.name = n;
    return OK;
  },
};

export function upgradeCost(state, unit) {
  const def = BUSINESSES[unit.type];
  return Math.round(def.capex * costIndex(state.world.places[unit.placeId]) * UPGRADE_COST_FACTOR * unit.level);
}

export function applyCommand(state, cmd) {
  if (state.company.bankrupt) return fail('Компания обанкротилась');
  const h = handlers[cmd.type];
  if (!h) return fail(`Неизвестная команда ${cmd.type}`);
  return h(state, cmd);
}
