import { BUSINESSES, MAX_LEVEL, UPGRADE_COST_FACTOR } from '../data/businesses.js';
import { sellPrice, recordTrade } from './market.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { canBuildHere, forecast } from './forecast.js';
import { addNews, loanLimit, companyUnits } from './state.js';
import { emptyMonth, capexFor, defaultPrices, dailyNeed, productionCapacity, takeInv, pay, receive, placeOf } from './units.js';
import { contractOffer, contractGoods, endContract, CONTRACT_MONTHS } from './contracts.js';
import { WAGE_LEVELS } from './staff.js';
import { COUNTRIES } from '../data/cities.js';
import { BRAND_TIERS, newBrand, applyBrand, detachFromBrand, brandUnits } from './brands.js';
import { entryFee, LOCAL_TEAM_UNITS } from './expansion.js';

function companyBrands(state, companyId) {
  return Object.values(state.brands).filter((b) => b.companyId === companyId);
}

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
  // brandId — открыть сразу в составе сети (undefined — в первой сети этого типа, null — отдельно)
  openBusiness(state, { lotId, businessType, brandId }, companyId) {
    const lot = state.world.lots[lotId];
    const def = BUSINESSES[businessType];
    const co = state.companies[companyId];
    if (!lot || !def) return fail('Неизвестный участок или тип бизнеса');
    if (lot.unitId) return fail('Участок уже занят');
    if (lot.ownerId && lot.ownerId !== companyId) return fail(`Помещение принадлежит компании «${state.companies[lot.ownerId].name}»`);
    if (!canBuildHere(state, lot, businessType)) return fail('Здесь нельзя открыть такой бизнес');
    const place = state.world.places[lot.placeId];
    const fee = entryFee(state, companyId, place, businessType);
    const capex = capexFor(state, lot, businessType);
    if (co.cash < capex + fee) return fail(`Не хватает денег: нужно ${fmt(capex + fee)}${fee ? ` (в т.ч. выход на рынок страны ${fmt(fee)})` : ''}`);
    let brand = null;
    if (brandId) {
      brand = state.brands[brandId];
      if (!brand || brand.companyId !== companyId || brand.type !== businessType) return fail('Неподходящая сеть');
    } else if (brandId === undefined) {
      brand = companyBrands(state, companyId).find((b) => b.type === businessType) || null;
    }
    const fc = forecast(state, lotId, businessType, companyId);
    pay(state, companyId, capex + fee);
    if (!co.homeCountry) co.homeCountry = place.country;
    if (fee) addNews(state, 'info', `Выход на рынок страны ${COUNTRIES[place.country].name}: регистрация и юристы — ${fmt(fee)}. Пока у вас меньше ${LOCAL_TEAM_UNITS} точек здесь, своей команды нет: зарплаты и содержание на 10% дороже.`, null, companyId);
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
      wageLevel: 1,
      morale: 65,
      manager: false,
      autoStaff: false,
    };
    if (def.storage) unit.coverDays = def.storage.defaultCover;
    unit.brandId = brand?.id ?? null;
    unit.usage = dailyNeed(unit, fc.customers, def.production ? productionCapacity(state, unit) : 0);
    state.units[id] = unit;
    lot.unitId = id;
    if (brand) {
      unit.name = `${brand.name} · ${place.name}`;
      applyBrand(state, brand);
    }
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
    if (unit.brandId) return fail('Цены этой точки задаёт сеть — меняйте их во вкладке «Сети»');
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
    if (unit.brandId) return fail('Рекламу этой точки задаёт сеть');
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

  setWage(state, { unitId, level }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.brandId) return fail('Зарплаты в точках сети задаёт сеть');
    if (!WAGE_LEVELS.includes(level)) return fail('Уровень зарплаты: 80%, 100%, 120% или 150%');
    unit.wageLevel = level;
    return OK;
  },

  hireManager(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.manager) return fail('Управляющий уже есть');
    unit.manager = true;
    unit.autoStaff = true;
    state.mapVersion++; // меняется подсчёт «внимания»
    addNews(state, 'good', `В «${unit.name}» нанят управляющий.`, { unitId }, companyId);
    return OK;
  },

  fireManager(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit || !unit.manager) return fail('Управляющего нет');
    unit.manager = false;
    unit.autoStaff = false;
    unit.morale = Math.max(0, (unit.morale ?? 65) - 10);
    state.mapVersion++;
    return OK;
  },

  setAutoStaff(state, { unitId, on }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!unit.manager) return fail('Автоподбор штата делает управляющий — сначала наймите его');
    unit.autoStaff = Boolean(on);
    return OK;
  },

  // ---------- сети ----------
  createBrand(state, { name, businessType, tier, unitIds = [] }, companyId) {
    const def = BUSINESSES[businessType];
    if (!def?.retail) return fail('Сеть можно создать только для точек продаж (кофейни, рестораны, магазины…)');
    if (!BRAND_TIERS[tier]) return fail('Позиционирование: эконом, стандарт или премиум');
    const n = String(name || '').trim().slice(0, 30);
    if (!n) return fail('Придумайте название сети');
    if (companyBrands(state, companyId).some((b) => b.name === n)) return fail('Сеть с таким названием уже есть');
    const brand = newBrand(state, companyId, { name: n, businessType, tier });
    for (const id of unitIds) {
      const u = ownUnit(state, id, companyId);
      if (u && u.type === businessType) {
        u.brandId = brand.id;
        u.name = `${brand.name} · ${state.world.places[u.placeId].name}`;
      }
    }
    applyBrand(state, brand);
    addNews(state, 'good', `Создана сеть «${n}» (${BRAND_TIERS[tier].name.toLowerCase()}).`, null, companyId);
    return { ok: true, brandId: brand.id };
  },

  joinBrand(state, { unitId, brandId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!brandId) {
      detachFromBrand(unit);
      return OK;
    }
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (brand.type !== unit.type) return fail(`В сеть «${brand.name}» входят только «${BUSINESSES[brand.type].name}»`);
    unit.brandId = brand.id;
    unit.name = `${brand.name} · ${state.world.places[unit.placeId].name}`;
    applyBrand(state, brand);
    return OK;
  },

  updateBrand(state, { brandId, priceRatio, marketing, wageLevel, tier, name }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (priceRatio) {
      for (const [p, r] of Object.entries(priceRatio)) {
        if (!(p in brand.priceRatio)) return fail('Нет такого продукта');
        if (!(r >= 0.3 && r <= 3)) return fail('Цена сети: от 30% до 300% местной нормы');
        brand.priceRatio[p] = Math.round(r * 100) / 100;
      }
    }
    if (marketing !== undefined) {
      if (!(marketing >= 0 && marketing <= 1e5)) return fail('Недопустимый бюджет');
      brand.marketing = Math.round(marketing);
    }
    if (wageLevel !== undefined) {
      if (!WAGE_LEVELS.includes(wageLevel)) return fail('Уровень зарплаты: 80%, 100%, 120% или 150%');
      brand.wageLevel = wageLevel;
    }
    if (tier !== undefined) {
      if (!BRAND_TIERS[tier]) return fail('Неизвестное позиционирование');
      brand.tier = tier;
    }
    if (name !== undefined) {
      const n = String(name).trim().slice(0, 30);
      if (!n) return fail('Пустое название');
      for (const u of brandUnits(state, brand)) u.name = u.name.replace(brand.name, n);
      brand.name = n;
    }
    applyBrand(state, brand);
    return OK;
  },

  // Национальная реклама сети в стране (в месяц)
  setBrandNational(state, { brandId, country, budget }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (!COUNTRIES[country]) return fail('Нет такой страны');
    if (!(budget >= 0 && budget <= 1e7)) return fail('Недопустимый бюджет');
    if (budget > 0) brand.national[country] = Math.round(budget);
    else delete brand.national[country];
    return OK;
  },

  deleteBrand(state, { brandId }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    for (const u of brandUnits(state, brand)) detachFromBrand(u);
    delete state.brands[brandId];
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
