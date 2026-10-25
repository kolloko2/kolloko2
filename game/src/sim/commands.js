import { BUSINESSES, MAX_LEVEL, UPGRADE_COST_FACTOR, EQUIPMENT } from '../data/businesses.js';
import { costIndex } from './world.js';
import { refPrice } from './demand.js';
import { canBuildHere, forecast } from './forecast.js';
import { cellBuildable, lotAtCell, makeCellLot, registerLot } from './grid.js';
import { addNews, loanLimit, companyUnits } from './state.js';
import {
  emptyMonth, capexFor, defaultPrices, dailyNeed, productionCapacity, pay, receive, placeOf, renovateCost, condition,
  monthlyWage, spend, allowedRecipes,
} from './units.js';
import { GOODS, GRADES } from '../data/goods.js';

const RETOOL_COST = 0.05; // доля вложений на перенастройку завода
const RETOOL_DAYS = 7;
import { contractOffer, contractGoods, endContract, CONTRACT_MONTHS } from './contracts.js';
import { WAGE_LEVELS, trainingCost, MAX_TRAINING } from './staff.js';
import { COUNTRIES } from '../data/cities.js';
import { BRAND_TIERS, newBrand, applyBrand, detachFromBrand, brandUnits } from './brands.js';
import { entryFee, LOCAL_TEAM_UNITS } from './expansion.js';
import { licenseNeeded, grantLicense } from './countries.js';
import {
  bulk, closeUnit, newDirector, directorCost, makeTemplate, applyTemplate, defaultRules,
} from './management.js';
import {
  buyRivalUnit, rivalUnitPrice, truceCost, TRUCE_MONTHS, acceptOffer, offerText, bidForUnit, rivalWants, transferUnit,
} from './rivals.js';
import {
  missingTech, techLocked, techCost, startResearch, lobby, lobbyCost, LOBBY_GOALS, LOBBY_COOLDOWN,
} from './research.js';
import { TECHS } from '../data/tech.js';
import { AD_CHANNELS } from '../data/ads.js';
import { DELIVERY_CATEGORIES } from './tick.js';
import { defaultAds, setAds, adsOf } from './ads.js';
import { ROYALTIES, FRANCHISE_MIN_UNITS, packageCost } from './franchise.js';
import {
  ipoCheck, doIpo, trade, controllerOf, stakeOf, absorb, absorbCost, ABSORB_SHARE,
} from './stocks.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

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

/** @type {Record<string, (state: State, cmd: any, companyId: string) => any>} */
const handlers = {
  // brandId — открыть сразу в составе сети (undefined — в первой сети этого типа, null — отдельно)
  // Где строить: lotId (готовый участок) или placeId + cell [x, y] (клетка на плане города)
  openBusiness(state, { lotId, placeId, cell, businessType, brandId, templateId, recipe }, companyId) {
    const def = BUSINESSES[businessType];
    let lot = lotId ? state.world.lots[lotId] : null;
    let draft = false;
    if (!lot && placeId && cell && def) {
      const pl = state.world.places[placeId];
      if (!pl) return fail('Нет такого города');
      const [x, y] = cell;
      const why = cellBuildable(state, pl, x, y, businessType);
      if (why) return fail(why);
      lot = lotAtCell(state, pl, x, y);
      if (!lot) {
        lot = makeCellLot(state, pl, x, y, businessType);
        draft = true;
      }
      lotId = lot.id;
    }
    const co = state.companies[companyId];
    if (!lot || !def) return fail('Неизвестный участок или тип бизнеса');
    if (lot.unitId) return fail('Участок уже занят');
    if (lot.ownerId && lot.ownerId !== companyId) return fail(`Помещение принадлежит компании «${state.companies[lot.ownerId].name}»`);
    if (!canBuildHere(state, lot, businessType)) return fail('Здесь нельзя открыть такой бизнес');
    const tech = missingTech(state, companyId, businessType);
    if (tech) return fail(`Нужна технология «${tech}» — изучите её во вкладке «Исследования»`);
    const place = state.world.places[lot.placeId];
    const fee = entryFee(state, companyId, place, businessType);
    const capex = capexFor(state, lot, businessType);
    const license = licenseNeeded(state, companyId, place, businessType);
    const extra = fee + (license?.cost ?? 0);
    if (co.cash < capex + extra) {
      const parts = [fee && `выход на рынок страны ${fmt(fee)}`, license && `${license.name.toLowerCase()} ${fmt(license.cost)}`].filter(Boolean);
      return fail(`Не хватает денег: нужно ${fmt(capex + extra)}${parts.length ? ` (в т.ч. ${parts.join(', ')})` : ''}`);
    }
    let brand = null;
    if (brandId) {
      brand = state.brands[brandId];
      if (!brand || brand.companyId !== companyId || brand.type !== businessType) return fail('Неподходящая сеть');
    } else if (brandId === undefined) {
      brand = companyBrands(state, companyId).find((b) => b.type === businessType) || null;
    }
    const variants = allowedRecipes(place, businessType);
    if (recipe && !variants.includes(recipe)) return fail('Здесь нельзя выпускать этот товар');
    if (def.production?.recipes) recipe ||= variants[0]; // по умолчанию — основной товар завода
    if (draft) registerLot(state, lot); // новый участок в клетке — теперь он часть мира
    const fc = forecast(state, lotId, businessType, companyId, undefined, recipe);
    pay(state, companyId, capex + extra);
    if (!co.homeCountry) co.homeCountry = place.country;
    if (license) {
      grantLicense(state, companyId, place, license.id);
      addNews(state, 'info', `Получена ${license.name.toLowerCase()} в стране ${COUNTRIES[place.country].name}: ${fmt(license.cost)}.`, null, companyId);
    }
    if (fee) addNews(state, 'info', `Выход на рынок страны ${COUNTRIES[place.country].name}: регистрация и юристы — ${fmt(fee)}. Пока у вас меньше ${LOCAL_TEAM_UNITS} точек здесь, своей команды нет: зарплаты и содержание на 10% дороже.`, null, companyId);
    const sameType = companyUnits(state, companyId).filter((u) => u.type === businessType).length;
    const id = `u${state.nextUnitId++}`;
    /** @type {Unit} */
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
      marketing: 0,
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
      condition: 100,
      wageLevel: 1,
      morale: 65,
      manager: false,
      autoStaff: false,
    };
    if (def.storage) unit.coverDays = def.storage.defaultCover;
    if (def.production?.recipes) unit.recipe = fc.recipe;
    setAds(unit, def.retail ? defaultAds(businessType, costIndex(place)) : {});
    unit.brandId = brand?.id ?? null;
    unit.usage = dailyNeed(unit, fc.customers, def.production ? productionCapacity(state, unit) : 0);
    state.units[id] = unit;
    lot.unitId = id;
    if (brand) {
      unit.name = `${brand.name} · ${place.name}`;
      applyBrand(state, brand);
    }
    const tpl = templateId ? co.templates?.[templateId] : null;
    if (tpl && tpl.type === businessType) {
      if (tpl.brandId && state.brands[tpl.brandId]?.companyId === companyId && !unit.brandId) {
        unit.brandId = tpl.brandId;
        unit.name = `${state.brands[tpl.brandId].name} · ${place.name}`;
        applyBrand(state, state.brands[tpl.brandId]);
      }
      applyTemplate(state, unit, tpl);
    }
    state.mapVersion++;
    addNews(state, 'good', `Открыт бизнес «${unit.name}» — ${place.name}. Вложено ${fmt(capex)}.`, { unitId: id }, companyId);
    return { ok: true, unitId: id };
  },

  closeBusiness(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    const { cash, fines } = closeUnit(state, unit);
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
    // общий бюджет — пропорционально по нынешним каналам
    const ads = adsOf(unit);
    const total = Object.values(ads).reduce((a, b) => a + b, 0);
    setAds(unit, total ? Object.fromEntries(Object.entries(ads).map(([ch, b]) => [ch, (b / total) * budget])) : { social: budget });
    return OK;
  },

  setAds(state, { unitId, channel, budget }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.brandId) return fail('Рекламу этой точки задаёт сеть');
    if (!AD_CHANNELS[channel]) return fail('Нет такого канала');
    if (!(budget >= 0) || budget > 1e6) return fail('Недопустимый бюджет');
    setAds(unit, { ...adsOf(unit), [channel]: budget });
    return OK;
  },

  // Перенастроить завод на другой товар: 5% стоимости оборудования и неделя простоя
  setRecipe(state, { unitId, recipe }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!BUSINESSES[unit.type].production?.recipes) return fail('Этот бизнес выпускает только один товар');
    if (unit.recipe === recipe) return OK;
    if (!allowedRecipes(placeOf(state, unit), unit.type).includes(recipe)) return fail('Здесь нельзя выпускать этот товар');
    const cost = Math.round(capexFor(state, state.world.lots[unit.lotId], unit.type) * RETOOL_COST);
    if (state.companies[companyId].cash < cost) return fail(`Перенастройка стоит ${fmt(cost)} — не хватает денег`);
    spend(state, unit, 'other', cost);
    unit.recipe = recipe;
    unit.broken = Math.max(unit.broken, RETOOL_DAYS);
    unit.usage = dailyNeed(unit, 0, productionCapacity(state, { ...unit, broken: 0 }));
    state.mapVersion++;
    addNews(state, 'info', `«${unit.name}» перенастраивается на выпуск: ${GOODS[recipe].name} (${fmt(cost)}, ${RETOOL_DAYS} дней).`, { unitId }, companyId);
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
    unit.condition = 100; // новое оборудование
    unit.bookValue += cost;
    addNews(state, 'good', `«${unit.name}» улучшен до уровня ${unit.level}.`, { unitId }, companyId);
    return OK;
  },

  // Купить оборудование классом выше: мощность и качество того, что точка делает и продаёт
  buyEquipment(state, { unitId, level }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!(level > unit.level && level <= MAX_LEVEL)) return fail('Можно купить только оборудование классом выше');
    const cost = equipmentCost(state, unit, level);
    if (state.companies[companyId].cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    unit.level = level;
    unit.condition = 100; // новое оборудование
    unit.bookValue += cost;
    addNews(state, 'good', `«${unit.name}»: установлено ${EQUIPMENT[level - 1].name.toLowerCase()} оборудование (${fmt(cost)}).`, { unitId }, companyId);
    return OK;
  },

  // Класс закупаемого на рынке товара (дешёвый…элитный); у точек сети — для всей сети
  setGrade(state, { unitId, brandId, good, grade }, companyId) {
    if (!GRADES[grade] || !GOODS[good]) return fail('Неизвестный класс товара');
    if (brandId) {
      const brand = state.brands[brandId];
      if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
      (brand.grades ||= {})[good] = grade;
      applyBrand(state, brand);
      return OK;
    }
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (unit.brandId) return fail('Закупки точек сети задаёт сеть');
    (unit.grades ||= {})[good] = grade;
    return OK;
  },

  // ---------- управление ----------
  hireDirector(state, { country }, companyId) {
    if (!COUNTRIES[country]) return fail('Нет такой страны');
    const co = state.companies[companyId];
    co.directors ||= {};
    if (co.directors[country]) return fail('Директор здесь уже есть');
    if (!companyUnits(state, companyId).some((u) => placeOf(state, u).country === country)) return fail('В этой стране у вас нет бизнесов');
    co.directors[country] = newDirector();
    state.mapVersion++;
    addNews(state, 'good', `Нанят региональный директор: ${COUNTRIES[country].name}, ${fmt(directorCost(state, country))}/мес.`, null, companyId);
    return OK;
  },

  fireDirector(state, { country }, companyId) {
    const co = state.companies[companyId];
    if (!co.directors?.[country]) return fail('Директора нет');
    delete co.directors[country];
    state.mapVersion++;
    return OK;
  },

  setDirector(state, { country, staff, renovate, prices, priceRatio }, companyId) {
    const d = state.companies[companyId].directors?.[country];
    if (!d) return fail('Директора нет');
    if (staff !== undefined) d.staff = Boolean(staff);
    if (renovate !== undefined) d.renovate = Boolean(renovate);
    if (prices !== undefined) d.prices = Boolean(prices);
    if (priceRatio !== undefined) {
      if (!(priceRatio >= 0.7 && priceRatio <= 1.5)) return fail('Цены: от 70% до 150% нормы');
      d.priceRatio = Math.round(priceRatio * 100) / 100;
    }
    return OK;
  },

  // ---------- исследования и лоббирование ----------
  startResearch(state, { techId }, companyId) {
    if (!TECHS[techId]) return fail('Нет такой технологии');
    const co = state.companies[companyId];
    if (co.research) return fail(`Уже идёт исследование «${TECHS[co.research.id].name}»`);
    const why = techLocked(state, companyId, techId);
    if (why) return fail(why);
    startResearch(state, companyId, techId);
    addNews(state, 'info', `${TECHS[techId].icon} Начато исследование «${TECHS[techId].name}»: ${fmt(techCost(state, companyId, techId))} за ${TECHS[techId].months} мес.`, null, companyId);
    return OK;
  },

  cancelResearch(state, _cmd, companyId) {
    const co = state.companies[companyId];
    if (!co.research) return fail('Исследований нет');
    co.research = null;
    return OK;
  },

  lobby(state, { country, goal }, companyId) {
    if (!COUNTRIES[country] || !LOBBY_GOALS[goal]) return fail('Неизвестная цель');
    const co = state.companies[companyId];
    if (co.lobbied?.[country] && state.day - co.lobbied[country] < LOBBY_COOLDOWN) return fail('Лоббировать в этой стране можно раз в год');
    if (!companyUnits(state, companyId).some((u) => placeOf(state, u).country === country)) return fail('У вас нет бизнесов в этой стране — власти вас не знают');
    const cost = lobbyCost(state, country);
    if (co.cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    return { ok: true, success: lobby(state, companyId, country, goal) };
  },

  // ---------- сделки с ИИ-корпорациями ----------
  buyRivalUnit(state, { unitId }, companyId) {
    const unit = state.units[unitId];
    if (!unit || !state.companies[unit.companyId]?.ai) return fail('Купить можно только бизнес ИИ-корпорации');
    const price = rivalUnitPrice(state, unit);
    if (state.companies[companyId].cash < price) return fail(`Не хватает денег: нужно ${fmt(price)}`);
    const seller = state.companies[unit.companyId].name;
    buyRivalUnit(state, companyId, unit);
    unit.name = `${BUSINESSES[unit.type].name} (бывш. ${seller})`;
    addNews(state, 'good', `Куплен бизнес у «${seller}» за ${fmt(price)}.`, { unitId }, companyId);
    return OK;
  },

  answerOffer(state, { offerId, accept }, companyId) {
    const o = (state.offers || []).find((x) => x.id === offerId && x.to === companyId && x.until > state.day);
    if (!o) return fail('Предложение уже не действует');
    state.offers = state.offers.filter((x) => x !== o);
    if (!accept) return OK;
    const err = acceptOffer(state, o);
    if (err) return fail(err);
    addNews(state, 'good', `Сделка заключена: ${offerText(state, o)}`, null, companyId);
    return OK;
  },

  sellToRival(state, { unitId, rivalId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    const rival = state.companies[rivalId];
    if (!unit || !rival?.ai || rival.bankrupt) return fail('Нет такой сделки');
    if (!rivalWants(state, rival, unit)) return fail(`«${rival.name}» такой бизнес не интересен`);
    const price = bidForUnit(state, unit);
    if (rival.cash < price * 1.5) return fail(`У «${rival.name}» сейчас нет таких денег`);
    pay(state, rivalId, price);
    receive(state, companyId, price);
    const name = unit.name;
    transferUnit(state, unit, rivalId);
    addNews(state, 'good', `«${name}» продан корпорации «${rival.name}» за ${fmt(price)}.`, null, companyId);
    return { ok: true, price };
  },

  buyTruce(state, { rivalId }, companyId) {
    const rival = state.companies[rivalId];
    if (!rival?.ai || rival.bankrupt) return fail('Нет такой корпорации');
    const co = state.companies[companyId];
    co.truces ||= {};
    if (co.truces[rivalId] > state.day) return fail('Перемирие уже действует');
    const cost = truceCost(state, rival, companyId);
    if (co.cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    receive(state, rivalId, cost);
    co.truces[rivalId] = state.day + TRUCE_MONTHS * 30;
    (co.truceCount ||= {})[rivalId] = (co.truceCount[rivalId] || 0) + 1; // следующее перемирие будет дороже
    addNews(state, 'good', `Перемирие с «${rival.name}» на ${TRUCE_MONTHS} мес.: она не открывается в ваших городах и не трогает ваши помещения и акции.`, null, companyId);
    return OK;
  },

  // Массовые действия: renovate, priceNorm, fitStaff, hireManager, close
  bulk(state, { op, unitIds, ratio }, companyId) {
    if (!Array.isArray(unitIds) || unitIds.length > 5000) return fail('Нет списка бизнесов');
    if (ratio !== undefined && !(ratio >= 0.5 && ratio <= 2)) return fail('Цены: от 50% до 200% нормы');
    return bulk(state, companyId, op, unitIds, { ratio });
  },

  renovate(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (condition(unit) > 95) return fail('Точка и так в отличном состоянии');
    const cost = renovateCost(state, unit);
    if (state.companies[companyId].cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    unit.bookValue += cost;
    unit.condition = 100;
    addNews(state, 'good', `«${unit.name}» обновлён за ${fmt(cost)}.`, { unitId }, companyId);
    return OK;
  },

  setAutoRenew(state, { brandId, on }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    brand.autoRenew = Boolean(on);
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
      if (!u.brandId) setAds(u, Object.fromEntries(Object.entries(adsOf(src)).map(([ch, b]) => [ch, (b / costIndex(srcPlace)) * costIndex(place)])));
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
    // нанять людей квалификацией выше — разовые расходы на подбор (месячная разница в зарплате)
    const fee = level > wageLevelOf(unit) ? Math.round(hiringFee(state, unit, level)) : 0;
    if (state.companies[companyId].cash < fee) return fail(`Подбор персонала стоит ${fmt(fee)} — не хватает денег`);
    if (fee) spend(state, unit, 'wages', fee);
    unit.wageLevel = level;
    return OK;
  },

  saveTemplate(state, { unitId, name }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    const n = String(name || '').trim().slice(0, 30) || `Как «${unit.name}»`;
    const co = state.companies[companyId];
    co.templates ||= {};
    co.nextTemplateId = (co.nextTemplateId || 0) + 1;
    const id = `t${co.nextTemplateId}`;
    co.templates[id] = makeTemplate(state, unit, n);
    return { ok: true, templateId: id };
  },

  deleteTemplate(state, { templateId }, companyId) {
    const co = state.companies[companyId];
    if (!co.templates?.[templateId]) return fail('Нет такого шаблона');
    delete co.templates[templateId];
    return OK;
  },

  setRules(state, { reserve, autoRepay, closeAfter, autoRenovate }, companyId) {
    const co = state.companies[companyId];
    co.rules ||= defaultRules();
    if (reserve !== undefined) {
      if (!(reserve >= 0 && reserve <= 1e9)) return fail('Недопустимый резерв');
      co.rules.reserve = Math.round(reserve);
    }
    if (autoRepay !== undefined) co.rules.autoRepay = Boolean(autoRepay);
    if (autoRenovate !== undefined) co.rules.autoRenovate = Boolean(autoRenovate);
    if (closeAfter !== undefined) {
      if (![0, 3, 6, 12].includes(closeAfter)) return fail('Закрывать после 3, 6 или 12 месяцев убытка (0 — никогда)');
      co.rules.closeAfter = closeAfter;
    }
    return OK;
  },

  trainStaff(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if ((unit.training || 0) >= MAX_TRAINING) return fail('Персонал обучен по максимуму');
    const cost = trainingCost(state, unit, monthlyWage(state, unit));
    if (state.companies[companyId].cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    spend(state, unit, 'other', cost);
    unit.training = Math.min(MAX_TRAINING, Math.floor((unit.training || 0) + 1));
    addNews(state, 'good', `Персонал «${unit.name}» прошёл обучение (уровень ${unit.training}).`, { unitId }, companyId);
    return OK;
  },

  releaseStar(state, { unitId }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit?.star) return fail('Звезды здесь нет');
    unit.star = false;
    return OK;
  },

  setDelivery(state, { unitId, mode }, companyId) {
    const unit = ownUnit(state, unitId, companyId);
    if (!unit) return fail('Нет такого бизнеса');
    if (!['none', 'aggregator', 'own'].includes(mode)) return fail('Неизвестный режим');
    if (mode !== 'none' && !DELIVERY_CATEGORIES.includes(BUSINESSES[unit.type].category)) return fail('Доставка — только для кафе, фастфуда, ресторанов и пекарен');
    unit.delivery = mode;
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

  updateBrand(state, { brandId, priceRatio, ads, wageLevel, tier, name }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (priceRatio) {
      for (const [p, r] of Object.entries(priceRatio)) {
        if (!(p in brand.priceRatio)) return fail('Нет такого продукта');
        if (!(r >= 0.3 && r <= 3)) return fail('Цена сети: от 30% до 300% местной нормы');
        brand.priceRatio[p] = Math.round(r * 100) / 100;
      }
    }
    if (ads) {
      brand.ads ||= {};
      for (const [ch, b] of Object.entries(ads)) {
        if (!AD_CHANNELS[ch]) return fail('Нет такого канала');
        if (!(b >= 0 && b <= 1e5)) return fail('Недопустимый бюджет');
        if (b > 0) brand.ads[ch] = Math.round(b);
        else delete brand.ads[ch];
      }
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

  // ---------- франшиза ----------
  setRoyalty(state, { brandId, royalty }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (!ROYALTIES.includes(royalty)) return fail('Роялти: 3, 5, 7, 9 или 12%');
    brand.royalty = royalty;
    return OK;
  },

  // Начать продавать франшизу в стране: разовая «упаковка» (юристы, стандарты, обучение)
  openFranchise(state, { brandId, country }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId) return fail('Нет такой сети');
    if (!COUNTRIES[country]) return fail('Нет такой страны');
    brand.franchise ||= {};
    if (brand.franchise[country]) return fail('Франшиза здесь уже продаётся');
    if (brandUnits(state, brand).length < FRANCHISE_MIN_UNITS) return fail(`Сначала откройте хотя бы ${FRANCHISE_MIN_UNITS} свои точки сети — франчайзи покупают проверенную модель`);
    const cost = packageCost(country);
    if (state.companies[companyId].cash < cost) return fail(`Не хватает денег: нужно ${fmt(cost)}`);
    pay(state, companyId, cost);
    brand.franchise[country] = true;
    addNews(state, 'good', `🏷️ «${brand.name}» продаёт франшизу в стране ${COUNTRIES[country].name}. Ждите заявок франчайзи.`, null, companyId);
    return OK;
  },

  closeFranchise(state, { brandId, country }, companyId) {
    const brand = state.brands[brandId];
    if (!brand || brand.companyId !== companyId || !brand.franchise?.[country]) return fail('Франшиза здесь не продаётся');
    delete brand.franchise[country];
    for (const pid of Object.keys(brand.franchisees || {})) {
      if (state.world.places[pid].country === country) delete brand.franchisees[pid];
    }
    return OK;
  },

  // ---------- биржа ----------
  ipo(state, { share }, companyId) {
    if (!(share >= 0.1 && share <= 0.49)) return fail('На IPO можно продать от 10 до 49% акций');
    const why = ipoCheck(state, companyId);
    if (why) return fail(why);
    const r = doIpo(state, companyId, share);
    addNews(state, 'good', `🔔 IPO: «${state.companies[companyId].name}» вышла на биржу по $${r.price.toFixed(2)} за акцию и привлекла ${fmt(r.cash)}.`);
    return { ok: true, ...r };
  },

  tradeShares(state, { listingId, qty }, companyId) {
    const l = state.stocks.listings[listingId];
    if (!l) return fail('Нет такой бумаги');
    if (l.kind === 'company' && listingId !== companyId && state.companies[listingId]?.bankrupt) return fail('Компания ушла с биржи');
    const before = controllerOf(state, l);
    const r = trade(state, companyId, listingId, qty);
    if (!r.ok) return r;
    const after = controllerOf(state, l);
    if (l.kind === 'company' && after !== before && after) {
      addNews(state, 'warn', `🦈 Компания «${state.companies[after].name}» получила контрольный пакет «${l.name}» (${Math.round(stakeOf(l, after) * 100)}%).`);
    }
    return r;
  },

  // Доля прибыли на дивиденды: решает контролирующий акционер, а если его нет — сама компания
  setPayout(state, { listingId, payout }, companyId) {
    const issuer = listingId || companyId;
    const co = state.companies[issuer];
    if (!co) return fail('Нет такой компании');
    if (!(payout >= 0 && payout <= 1)) return fail('Дивиденды: от 0 до 100% прибыли');
    const l = state.stocks.listings[issuer];
    const ctrl = l ? controllerOf(state, l) : null;
    if (ctrl ? ctrl !== companyId : issuer !== companyId) return fail(ctrl ? 'Дивиденды решает контролирующий акционер' : 'Это не ваша компания');
    co.payout = Math.round(payout * 100) / 100;
    return OK;
  },

  absorbCompany(state, { targetId }, companyId) {
    const l = state.stocks.listings[targetId];
    if (!l || l.kind !== 'company' || targetId === companyId) return fail('Поглотить можно только другую компанию на бирже');
    if (stakeOf(l, companyId) < ABSORB_SHARE) return fail(`Нужно не меньше ${ABSORB_SHARE * 100}% акций`);
    const cost = absorbCost(state, companyId, targetId);
    if (state.companies[companyId].cash < cost) return fail(`Нужно ${fmt(cost)}, чтобы выкупить акции остальных акционеров`);
    absorb(state, companyId, targetId);
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

// Цена перехода на оборудование класса level (сумма шагов улучшения)
export function equipmentCost(state, unit, level) {
  let cost = 0;
  for (let l = unit.level; l < level; l++) cost += upgradeCost(state, { ...unit, level: l });
  return cost;
}

// Подбор персонала квалификацией выше: месячная разница в зарплате всего штата
export function hiringFee(state, unit, level) {
  return Math.max(0, level - wageLevelOf(unit)) * unit.staff * BUSINESSES[unit.type].staff.wage * state.world.places[unit.placeId].wage;
}
const wageLevelOf = (unit) => unit.wageLevel ?? 1;

export function upgradeCost(state, unit) {
  const def = BUSINESSES[unit.type];
  return Math.round(def.capex * costIndex(state.world.places[unit.placeId]) * UPGRADE_COST_FACTOR * unit.level);
}

export const COMMAND_TYPES = Object.keys(handlers);

/** @param {State} state @param {{ type: string } & Record<string, any>} cmd @param {string} companyId */
export function applyCommand(state, cmd, companyId) {
  const co = state.companies[companyId];
  if (!co) return fail('Нет такой компании');
  if (co.absorbedBy) return fail(`Компанию поглотила «${state.companies[co.absorbedBy].name}»`);
  if (co.bankrupt) return fail('Компания обанкротилась');
  const h = handlers[cmd?.type];
  if (!h) return fail(`Неизвестная команда ${cmd?.type}`);
  return h(state, cmd, companyId);
}
