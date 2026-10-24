import { BUSINESSES, MAX_LEVEL, UPGRADE_COST_FACTOR } from '../data/businesses.js';
import { sellPrice, recordTrade } from './market.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { canBuildHere, forecast } from './forecast.js';
import { addNews, loanLimit, companyUnits } from './state.js';
import { emptyMonth, capexFor, defaultPrices, dailyNeed, productionCapacity, takeInv, pay, receive, placeOf } from './units.js';
import { contractOffer, contractGoods, endContract, CONTRACT_MONTHS } from './contracts.js';

// Все действия игрока — команды. applyCommand(state, cmd, companyId) возвращает { ok } или { ok: false, error }.
// companyId — от чьего имени действие: в соло его подставляет локальная сессия, в мультиплеере — сервер
// (клиент не может выдать себя за другую компанию).

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
const fmt = (n) => `$${Math.round(n).toLocaleString('ru-RU')}`;

function ownUnit(state, id, companyId) {
  const u = state.units[id];
  return u && u.companyId === companyId ? u : null;
}

const handlers = {
  openBusiness(state, { lotId, businessType }, companyId) {
    const lot = state.world.lots[lotId];
    const def = BUSINESSES[businessType];
    const co = state.companies[companyId];
    if (!lot || !def) return fail('Неизвестный участок или тип бизнеса');
    if (lot.unitId) return fail('Участок уже занят');
    if (lot.ownerId && lot.ownerId !== companyId) return fail(`Помещение принадлежит компании «${state.companies[lot.ownerId].name}»`);
    if (!canBuildHere(state, lot, businessType)) return fail('Здесь нельзя открыть такой бизнес');
    const capex = capexFor(state, lot, businessType);
    if (co.cash < capex) return fail(`Не хватает денег: нужно ${fmt(capex)}`);
    const place = state.world.places[lot.placeId];
    const fc = forecast(state, lotId, businessType, companyId);
    pay(state, companyId, capex);
    const sameType = companyUnits(state, companyId).filter((u) => u.type === businessType).length;
    const id = `u${state.nextUnitId++}`;
    const unit = {
      id,
      companyId,
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
      incoming: {},
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
    if (def.storage) unit.coverDays = def.storage.defaultCover;
    unit.usage = dailyNeed(unit, fc.customers, def.production ? productionCapacity(state, unit) : 0);
    state.units[id] = unit;
    lot.unitId = id;
    state.mapVersion++;
    addNews(state, 'good', `Открыт бизнес «${unit.name}» — ${place.name}. Вложено ${fmt(capex)}.`, { unitId: id }, companyId);
    return { ok: true, unitId: id };
  },

  closeBusiness(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    let fines = 0;
    for (const c of state.contracts.filter((x) => x.unitId === unitId)) fines += endContract(state, c, { penalty: true });
    let cash = 0;
    const place = placeOf(state, unit);
    for (const [g, s] of Object.entries(unit.inv)) {
      if (s.q <= 0) continue;
      cash += s.q * sellPrice(state, g, place);
      recordTrade(state, g, s.q, place);
      takeInv(unit, g, s.q);
    }
    cash += unit.bookValue * 0.3;
    receive(state, companyId, cash);
    state.world.lots[unit.lotId].unitId = null;
    delete state.units[unitId];
    state.mapVersion++;
    addNews(state, 'info', `«${unit.name}» закрыт. Оборудование и запасы проданы за ${fmt(cash)}.${fines ? ` Штрафы за разрыв контрактов: ${fmt(fines)}.` : ''}`, null, companyId);
    return OK;
  },

  setPrice(state, { unitId, productId, price }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    const product = BUSINESSES[unit.type].retail?.products.find((p) => p.id === productId);
    if (!product) return fail('Нет такого продукта');
    const ref = refPrice(state.world.places[unit.placeId], product);
    if (!(price > 0) || price > ref * 5) return fail('Недопустимая цена');
    unit.prices[productId] = Math.round(price * 100) / 100;
    return OK;
  },

  setStaff(state, { unitId, staff }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    const s = BUSINESSES[unit.type].staff;
    if (!Number.isInteger(staff) || staff < s.min || staff > s.max) return fail(`Персонал: от ${s.min} до ${s.max}`);
    unit.staff = staff;
    return OK;
  },

  setMarketing(state, { unitId, budget }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!(budget >= 0) || budget > 1e6) return fail('Недопустимый бюджет');
    unit.marketing = Math.round(budget);
    return OK;
  },

  setSellMode(state, { unitId, mode }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!['auto', 'all', 'hold'].includes(mode)) return fail('Неизвестный режим');
    unit.sellMode = mode;
    return OK;
  },

  upgrade(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.level >= MAX_LEVEL) return fail('Максимальный уровень');
    const cost = upgradeCost(state, unit);
    if (state.companies[companyId].cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    unit.level++;
    unit.bookValue += cost;
    addNews(state, 'good', `«${unit.name}» улучшен до уровня ${unit.level}.`, { unitId }, companyId);
    return OK;
  },

  copySettings(state, { unitId }, companyId) {
    const src = ownUnit(state, unitId, companyId);
    if (!src) return fail('Нет такого бизнеса');
    const def = BUSINESSES[src.type];
    const srcPlace = state.world.places[src.placeId];
    let n = 0;
    for (const u of companyUnits(state, companyId)) {
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

  takeLoan(state, { amount }, companyId) {
    const co = state.companies[companyId];
    if (!(amount > 0)) return fail('Сумма должна быть больше нуля');
    const limit = loanLimit(state, companyId);
    if (co.loan + amount > limit) return fail(`Банк одобряет максимум ${fmt(Math.max(0, limit - co.loan))}`);
    co.loan += amount;
    receive(state, companyId, amount);
    addNews(state, 'info', `Получен кредит ${fmt(amount)} под ${Math.round(co.loanRate * 100)}% годовых.`, null, companyId);
    return OK;
  },

  repayLoan(state, { amount }, companyId) {
    const co = state.companies[companyId];
    const a = Math.min(amount, co.loan, Math.max(0, co.cash));
    if (!(a > 0)) return fail('Нечего гасить или нет денег');
    co.loan -= a;
    pay(state, companyId, a);
    return OK;
  },

  // Покупка помещения у города. Если там арендатор-конкурент (PvP), его аренда пойдёт вам.
  buyLot(state, { lotId }, companyId) {
    const lot = state.world.lots[lotId];
    if (!lot) return fail('Нет такого участка');
    if (lot.ownerId === companyId) return fail('Уже ваш');
    if (lot.ownerId) return fail(`Помещение уже принадлежит компании «${state.companies[lot.ownerId].name}»`);
    if (state.companies[companyId].cash < lot.price) return fail(`Не хватает денег: нужно ${fmt(lot.price)}`);
    pay(state, companyId, lot.price);
    lot.ownerId = companyId;
    state.mapVersion++;
    const tenant = lot.unitId ? state.units[lot.unitId] : null;
    if (tenant && tenant.companyId !== companyId) {
      addNews(state, 'warn', `Компания «${state.companies[companyId].name}» купила помещение «${tenant.name}». Теперь аренда идёт ей.`, { unitId: tenant.id }, tenant.companyId);
    }
    addNews(state, 'good', `Куплена недвижимость за ${fmt(lot.price)}.`, null, companyId);
    return OK;
  },

  sellLot(state, { lotId }, companyId) {
    const lot = state.world.lots[lotId];
    if (!lot || lot.ownerId !== companyId) return fail('Это не ваш участок');
    receive(state, companyId, lot.price * 0.95);
    lot.ownerId = null;
    state.mapVersion++;
    return OK;
  },

  signContract(state, { unitId, good, side, months }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!CONTRACT_MONTHS.includes(months)) return fail('Срок: 3, 6 или 12 месяцев');
    if (!contractGoods(unit)[side]?.includes(good)) return fail('Такой контракт этому бизнесу не предлагают');
    if (state.contracts.some((c) => c.unitId === unitId && c.good === good && c.side === side)) return fail('Такой контракт уже действует');
    const offer = contractOffer(state, unit, good, side, months);
    if (!(offer.qtyPerDay > 0)) return fail('Нечего законтрактовать: нет потребления или выпуска');
    const c = { id: state.nextContractId++, companyId, unitId, ...offer, start: state.day, end: state.day + months * 30 };
    state.contracts.push(c);
    addNews(state, 'good', `Подписан контракт: ${side === 'buy' ? 'закупка' : 'продажа'} ${offer.qtyPerDay} в день по $${offer.price.toFixed(2)} на ${months} мес. («${unit.name}»).`, { unitId }, companyId);
    return { ok: true, contractId: c.id };
  },

  cancelContract(state, { contractId }, companyId) {
    const c = state.contracts.find((x) => x.id === contractId && x.companyId === companyId);
    if (!c) return fail('Нет такого контракта');
    const fine = endContract(state, c, { penalty: true });
    addNews(state, 'warn', `Контракт расторгнут досрочно, штраф ${fmt(fine)}.`, { unitId: c.unitId }, companyId);
    return OK;
  },

  setWarehouseCover(state, { unitId, days }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit || !BUSINESSES[unit.type].storage) return fail('Это не склад');
    if (!Number.isInteger(days) || days < 3 || days > 60) return fail('Запас: от 3 до 60 дней');
    unit.coverDays = days;
    return OK;
  },

  renameCompany(state, { name }, companyId) {
    const n = String(name || '').trim().slice(0, 40);
    if (!n) return fail('Пустое название');
    state.companies[companyId].name = n;
    state.mapVersion++;
    return OK;
  },
};

export function upgradeCost(state, unit) {
  const def = BUSINESSES[unit.type];
  return Math.round(def.capex * costIndex(state.world.places[unit.placeId]) * UPGRADE_COST_FACTOR * unit.level);
}

export const COMMAND_TYPES = Object.keys(handlers);

export function applyCommand(state, cmd, companyId) {
  const co = state.companies[companyId];
  if (!co) return fail('Нет такой компании');
  if (co.bankrupt) return fail('Компания обанкротилась');
  const h = handlers[cmd?.type];
  if (!h) return fail(`Неизвестная команда ${cmd?.type}`);
  return h(state, cmd, companyId);
}
