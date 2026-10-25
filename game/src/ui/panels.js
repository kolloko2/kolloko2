import { bizIcon, districtIcon, goodIcon } from './icons.js';
import { BUILD_GROUPS, CATEGORY_NAMES } from './citymap.js';
import { BUSINESSES, RISK, RISK_NAMES, EQUIPMENT, STAFF_CLASSES } from '../data/businesses.js';
import { DISTRICTS, ZONING_NAMES } from '../data/districts.js';
import { COUNTRIES, BLOCS } from '../data/cities.js';
import { GOODS, GRADES, gradeName } from '../data/goods.js';
import { AD_CHANNELS } from '../data/ads.js';
import { MARKET_REGIONS } from '../data/regions.js';
import {
  attention, efficiency, morale, wageLevel, managerCost, WAGE_LEVELS, BASE_ATTENTION,
  BRAND_TIERS, brandAwareness, effectiveAwareness, LOCAL_TEAM_UNITS,
  countryState, regionOf, inTransit, contractOffer, contractGoods, remainingValue, CONTRACT_MONTHS, storageCapacity, storedKg, servedBy,
  forecast, buildableTypes, districtShares, refPrice, upgradeCost, monthProfit, monthlyWage, monthlyRent,
  monthlyUpkeep, retailCapacity, productionCapacity, invQty, buyPrice, sellPrice, coverDays, formatDate,
  condition, renovateCost, seasonFactor, trainingCost, MAX_TRAINING, serviceMood, DELIVERY_CATEGORIES, ownCourier, rivalUnitPrice, ARCHETYPES, bidForUnit, rivalWants, truceCost, TRUCE_MONTHS, offerText, adsOf, channelFit, ownBillboards, trendOf, districtEventOf,
  recipeOf, allowedRecipes, canBuildHere, capexFor, missingTech, shopsIn, distanceKm,
  invK, gradeK, productK, outputK, equipmentCost, hiringFee, qualityPrice, supplierOptions, activeProducts, shelfCount,
} from '../sim/index.js';
import { money, moneyShort, num, pct, stars, months, esc, signClass, bars } from './format.js';

const CATEGORY_LABEL = { coffee: '☕ Кофе', fastfood: '🌭 Фастфуд', grocery: '🏪 Продукты', bakery: '🥐 Выпечка', restaurant: '🍽️ Рестораны', fuel: '⛽ АЗС', electronics: '📱 Техника', hotel: '🏨 Отели', fitness: '🏋️ Фитнес', beauty: '💇 Красота', pharmacy: '💊 Аптеки', cars: '🚗 Автомобили', autoservice: '🔧 Автосервис' };
const SUPPLY_LABEL = { internal: '🔗 своё', warehouse: '🏗️ склад', contract: '📝 контракт', market: '💹 рынок', nocash: '⛔ нет денег', empty: '⛔ у поставщика пусто' };

function row(label, value, cls = '') {
  return `<div class="row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
}

function placeOfLot(state, lot) {
  return state.world.places[lot.placeId];
}

function districtTitle(state, d) {
  const place = state.world.places[d.placeId];
  return `${districtIcon(d.type, 'inline')} ${DISTRICTS[d.type].name} · ${esc(place.name)}`;
}

function renderPlace(app, place) {
  const { state } = app;
  const country = COUNTRIES[place.country];
  const units = Object.values(state.units).filter((u) => u.placeId === place.id && u.companyId === app.companyId);
  const cs = countryState(state, place.country);
  const econ = cs.demand < 1 ? `<span class="tag bad">спад ${pct(cs.demand - 1)}</span>` : cs.demand > 1 ? `<span class="tag good">подъём +${pct(cs.demand - 1)}</span>` : '';
  let html = `<h2>${place.kind === 'city' ? '🏙️' : bizIcon(place.kinds[0], 'inline')} ${esc(place.name)}</h2>
    <div class="sub">${country.name} · налог на прибыль ${pct(cs.tax)} · пошлина ${pct(cs.tariff)}${country.bloc ? ` (${BLOCS[country.bloc]} — без пошлин)` : ''} ${econ}</div>
    <button class="btn wide" data-action="openCity" data-id="${place.id}">🔍 Приблизить ${place.kind === 'city' ? 'город' : 'регион'}</button><div class="card">`;
  if (place.kind === 'city') {
    html += row('Население', `${num(place.pop, 1)} млн`) + row('Доходы жителей', pct(place.income)) +
      row('Уровень аренды', pct(place.rent)) + row('Уровень зарплат', pct(place.wage));
  } else {
    html += row('Можно открыть', place.kinds.map((k) => `${bizIcon(k, 'inline')} ${BUSINESSES[k].name}`).join('<br>')) +
      (place.resources?.length ? row('Ресурсы', place.resources.map((g) => `${goodIcon(g, 'inline')} ${GOODS[g].name}`).join('<br>')) : '') +
      row('Продуктивность', pct(place.productivity)) + row('Аренда земли', `${money(place.landRent)}/га в мес`) +
      row('Уровень зарплат', pct(place.wage));
  }
  html += '</div><h3>Районы</h3><div class="list">';
  for (const id of place.districtIds) {
    const d = state.world.districts[id];
    const def = DISTRICTS[d.type];
    const free = d.lotIds.filter((l) => !state.world.lots[l].unitId).length;
    const ai = Object.entries(d.ai).filter(([, n]) => n > 0).map(([c, n]) => `${CATEGORY_LABEL[c].split(' ')[0]}${n}`).join(' ');
    html += `<button class="list-item" data-action="selectDistrict" data-id="${d.id}">
      <span class="li-icon">${districtIcon(d.type)}</span><span class="li-main">${def.name}<small>свободно участков: ${free}${ai ? ` · конкуренты: ${ai}` : ''}</small></span></button>`;
  }
  html += '</div>';
  if (units.length) {
    html += '<h3>Ваши бизнесы здесь</h3><div class="list">';
    for (const u of units) html += unitListItem(app, u);
    html += '</div>';
  }
  return html;
}

// Чужой бизнес (PvP): видно название, компанию и рейтинг, но не финансы
function rivalListItem(app, u) {
  const co = app.state.companies[u.companyId];
  return `<button class="list-item" data-action="selectUnit" data-id="${u.id}">
    <span class="li-icon">${bizIcon(u.type)}</span>
    <span class="li-main">${esc(u.name)}<small><span class="swatch" style="background:${co.color}"></span>${esc(co.name)}</small></span></button>`;
}

function unitListItem(app, u) {
  if (u.companyId !== app.companyId) return rivalListItem(app, u);
  const profit = u.last ? monthProfit(u.last) : null;
  return `<button class="list-item" data-action="selectUnit" data-id="${u.id}">
    <span class="li-icon">${bizIcon(u.type)}</span>
    <span class="li-main">${esc(u.name)}<small>${profit === null ? 'первый месяц' : `за месяц: <span class="${signClass(profit)}">${moneyShort(profit)}</span>`}</small></span></button>`;
}

function renderDistrict(app, d) {
  const { state } = app;
  const def = DISTRICTS[d.type];
  let html = `<h2>${districtTitle(state, d)}</h2><div class="sub">${ZONING_NAMES[def.zoning]} · участков: ${d.lotIds.length}</div>`;
  const cats = Object.keys(def.demand);
  if (cats.length) {
    const ev = districtEventOf(state, d.id);
    if (ev) html += `<div class="note ${ev.mult > 1 ? '' : 'warn'}">${ev.mult > 1 ? '🎉' : '🚧'} Сейчас здесь ${{ festival: 'фестиваль', roadworks: 'ремонт дороги', metro: 'новая станция метро', office: 'новый офисный центр', closure: 'закрытый завод рядом' }[ev.kind]}: спрос ${ev.mult > 1 ? '+' : ''}${pct(ev.mult - 1)}.</div>`;
    html += '<h3>Спрос в районе</h3><table class="tbl"><tr><th>Категория</th><th>Покупателей/день</th><th>Сезон и мода</th><th>Конкуренты</th></tr>';
    for (const c of cats) {
      const sh = districtShares(state, d, c);
      const owners = Object.keys(sh.byUnit).map((id) => state.units[id].companyId);
      const mine = owners.filter((c) => c === app.companyId).length;
      const rivals = owners.length - mine;
      const dp = state.world.places[d.placeId];
      const season = seasonFactor(state, c, dp) * trendOf(state, dp.country, c) - 1;
      html += `<tr><td>${CATEGORY_LABEL[c]}</td><td>${num(sh.potential)}</td><td class="${signClass(season)}">${Math.abs(season) < 0.02 ? '—' : `${season > 0 ? '+' : ''}${pct(season)}`}</td><td>${sh.ai} ИИ${mine ? ` + ${mine} ваших` : ''}${rivals ? ` + ${rivals} соперников` : ''}</td></tr>`;
    }
    html += '</table>';
  }
  html += '<h3>Участки</h3><div class="list">';
  for (const lotId of d.lotIds) {
    const lot = state.world.lots[lotId];
    if (lot.unitId) {
      html += unitListItem(app, state.units[lot.unitId]);
    } else {
      html += `<button class="list-item" data-action="selectLot" data-id="${lot.id}"><span class="li-icon">${lot.ownerId === app.companyId ? '🔑' : '📍'}</span>
        <span class="li-main">Участок ${lot.id.split('-').pop()}: ${areaText(lot)}<small>${lot.zoning === 'farmland' ? '' : `поток ${num(lot.traffic)}/день · `}аренда ${money(lot.rent)}/мес</small></span></button>`;
    }
  }
  return html + '</div>';
}

function areaText(lot) {
  return lot.zoning === 'farmland' ? `${num(lot.area)} га` : `${num(lot.area)} м²`;
}

function renderLot(app, lot) {
  const { state } = app;
  const d = state.world.districts[lot.districtId];
  const place = placeOfLot(state, lot);
  let html = `<h2>📍 Участок</h2>
    <div class="sub"><a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a></div><div class="card">`;
  html += row('Площадь', areaText(lot));
  if (lot.zoning !== 'farmland') {
    html += row('Прохожих', `${num(lot.traffic)}/день`) + row('Видимость с улицы', pct(lot.visibility))
      + row('Аренда', `${money(lot.rent)}/мес <small class="muted">(${money(lot.rent / lot.area, { cents: true })}/м²)</small>`);
  } else html += row('Аренда земли', `${money(lot.rent)}/мес`);
  html += row('Цена покупки', money(lot.price)) + row('Владелец', lot.ownerId ? esc(state.companies[lot.ownerId].name) : 'город (аренда)');
  html += '</div>';
  html += lotOwnershipButtons(app, lot);
  if (lot.zoning !== 'farmland') html += nearby(app, lot);
  if (lot.ownerId && lot.ownerId !== app.companyId) return `${html}<p class="muted">Помещение принадлежит другой компании.</p>`;
  return html + buildList(app, place, buildableTypes(state, lot), lot);
}

// Что рядом с участком (в радиусе ~400 м): конкуренты по категориям и свои точки
function nearby(app, lot) {
  const { state } = app;
  const d = state.world.districts[lot.districtId];
  const counts = {};
  for (const sh of shopsIn(state, d)) if (distanceKm(lot, sh) < 0.4) counts[sh.cat] = (counts[sh.cat] || 0) + 1;
  for (const id of d.lotIds) {
    const u = state.units[state.world.lots[id].unitId];
    if (u && BUSINESSES[u.type].retail && distanceKm(lot, state.world.lots[id]) < 0.4) {
      const c = BUSINESSES[u.type].category;
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!list.length) return '<div class="card small muted">Рядом (400 м) никого нет.</div>';
  return `<div class="card small"><b>Рядом (400 м):</b> ${list.map(([c, n]) => `${CATEGORY_NAMES[c] ?? c} ×${n}`).join(' · ')}</div>`;
}

// Что можно поставить: по группам, только цена входа и штат — прибыль игрок оценивает сам
function buildList(app, place, types, lot) {
  const { state } = app;
  let html = '<h3>Построить здесь</h3>';
  for (const [icon, name, test] of BUILD_GROUPS) {
    const list = types.filter((t) => test(BUSINESSES[t]));
    if (!list.length) continue;
    html += `<details class="build-group"><summary>${icon} ${name} <small class="muted">${list.length}</small></summary><div class="list">`;
    for (const t of list) {
      const def = BUSINESSES[t];
      const locked = missingTech(state, app.companyId, t);
      const variants = def.production?.recipes ? allowedRecipes(place, t) : [];
      const btn = (recipe, label) => `<button class="mini" data-action="open" data-lot="${lot.id}" data-type="${t}" ${recipe ? `data-recipe="${recipe}"` : ''} ${locked ? 'disabled' : ''}>${label}</button>`;
      html += `<div class="list-item static"><span class="li-icon">${bizIcon(t)}</span><span class="li-main">${def.name}
        <small>${locked ? `🔒 ${esc(locked)}` : `${moneyShort(capexFor(state, lot, t))} · ${def.staff.def} чел.`}</small>
        ${variants.length > 1 ? `<span class="chips tight">${variants.map((g) => btn(g, `${GOODS[g].icon} ${GOODS[g].name}`)).join('')}</span>` : ''}</span>
        ${variants.length > 1 ? '' : btn(variants[0], 'Построить')}</div>`;
    }
    html += '</div></details>';
  }
  return html;
}

// Здание фонового конкурента: что продаёт, по какой цене и какого качества, сколько у него покупателей
function renderShop(app, sel) {
  const { state } = app;
  const d = state.world.districts[sel.districtId];
  const sh = shopsIn(state, d).find((x) => x.id === sel.id);
  if (!sh) return '';
  const share = districtShares(state, d, sh.cat).byShop[sh.id] ?? 0;
  return `<h2>🏪 ${esc(sh.name)}</h2><div class="sub">Конкурент · ${CATEGORY_NAMES[sh.cat] ?? sh.cat} · <a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a></div>
    <div class="card">${row('Цены', `${pct(sh.p)} от обычных`)}${row('Рейтинг', `<span class="stars">${stars(sh.q)}</span> ${num(sh.q, 1)}`)}
    ${row('Известность', pct(sh.a))}${row('Покупателей', `~${num(share)}/день`)}</div>
    <div class="muted small">Фоновые магазины открываются там, где покупателей много, и закрываются, когда их не хватает.</div>`;
}

// Рынок города: по каждой категории — покупатели, продавцы, цены и качество конкурентов, ваша доля
function renderMarket(app, sel) {
  const { state } = app;
  const place = state.world.places[sel.placeId];
  const cats = [...new Set(place.districtIds.flatMap((id) => Object.keys(DISTRICTS[state.world.districts[id].type].demand)))];
  let html = `<h2>📊 Рынок · ${esc(place.name)}</h2><div class="sub">Покупатели в день, продавцы, средние цены и рейтинг конкурентов. Нажмите на строку — по районам.</div>
    <table class="tbl compact hover"><tr><th>Товары</th><th>Покупат./день</th><th>Продавцов</th><th>Цены</th><th>Рейтинг</th><th>Ваша доля</th></tr>`;
  for (const c of cats) {
    let pot = 0;
    let served = 0;
    let mine = 0;
    let sellers = 0;
    let pSum = 0;
    let qSum = 0;
    let n = 0;
    for (const id of place.districtIds) {
      const d = state.world.districts[id];
      const sh = districtShares(state, d, c);
      pot += sh.potential;
      served += sh.potential * (1 - sh.outsideShare);
      sellers += sh.ai + Object.keys(sh.byUnit).length;
      for (const x of shopsIn(state, d, c)) {
        pSum += x.p;
        qSum += x.q;
        n++;
      }
      for (const [uid, v] of Object.entries(sh.byUnit)) if (state.units[uid].companyId === app.companyId) mine += v;
    }
    if (pot < 1) continue;
    const open = sel.cat === c;
    html += `<tr data-action="marketCat" data-id="${place.id}" data-cat="${c}" class="${open ? 'active' : ''}"><td>${CATEGORY_NAMES[c] ?? c}</td><td>${num(pot)}<br><small class="muted">купят ${num(served)}</small></td>
      <td>${sellers}</td><td>${n ? pct(pSum / n) : '—'}</td><td>${n ? `${num(qSum / n, 1)}★` : '—'}</td><td>${served ? pct(mine / served) : '—'}</td></tr>`;
    if (open) {
      for (const id of place.districtIds) {
        const d = state.world.districts[id];
        const sh = districtShares(state, d, c);
        if (sh.potential < 1) continue;
        html += `<tr class="sub-row"><td colspan="6">${DISTRICTS[d.type].icon} ${DISTRICTS[d.type].name}: ${num(sh.potential)} покупат./день · продавцов ${sh.ai + Object.keys(sh.byUnit).length}
          · на одного ~${num(sh.potential * (1 - sh.outsideShare) / Math.max(1, sh.ai + Object.keys(sh.byUnit).length))}</td></tr>`;
      }
    }
  }
  return `${html}</table><div class="muted small">«Цены» — средние цены конкурентов к обычным для города; «купят» — сколько покупателей вообще что-то купит при нынешних ценах и качестве.</div>`;
}

function templatesFor(app, type) {
  return Object.entries(app.company.templates || {}).filter(([, t]) => t.type === type);
}

function ownerText(app, lot) {
  if (lot.ownerId === app.companyId) return 'своя собственность';
  if (lot.ownerId) return `${money(lot.rent)}/мес → «${esc(app.state.companies[lot.ownerId].name)}»`;
  return `${money(lot.rent)}/мес`;
}

function lotOwnershipButtons(app, lot) {
  if (lot.ownerId === app.companyId) {
    return `<button class="btn ghost" data-action="sellLot" data-id="${lot.id}">Продать помещение за ${moneyShort(lot.price * 0.95)}</button>`;
  }
  if (lot.ownerId) return '';
  const tenant = lot.unitId ? app.state.units[lot.unitId] : null;
  const hint = tenant && tenant.companyId !== app.companyId ? ' — аренда соперника пойдёт вам' : '';
  return `<button class="btn ghost" data-action="buyLot" data-id="${lot.id}" ${app.company.cash < lot.price ? 'disabled' : ''}>🔑 Купить помещение · ${moneyShort(lot.price)}${hint}</button>`;
}

function costTitle(c) {
  const names = { inputs: 'Сырьё и товары', wages: 'Зарплаты', rent: 'Аренда', upkeep: 'Коммунальные и обслуживание', marketing: 'Реклама', overhead: 'Рост расходов штаба' };
  return Object.entries(c).map(([k, v]) => `${names[k]}: ${money(v)}`).join('\n');
}

function statusBadges(app, u) {
  const t = u.today || {};
  const b = [];
  if (u.broken > 0) b.push('<span class="tag bad">🔧 поломка</span>');
  if (t.stockout) b.push('<span class="tag bad">📦 нет товара</span>');
  if (t.inputShort && !u.broken) b.push('<span class="tag warn">📦 не хватает сырья</span>');
  if (t.lost > 5 && !t.stockout) b.push('<span class="tag warn">👥 очередь — не хватает мощности</span>');
  if (Object.values(u.supplied || {}).includes('nocash')) b.push('<span class="tag bad">💸 нет денег на закупку</span>');
  if (condition(u) < 50) b.push('<span class="tag warn">🛠 сильный износ</span>');
  if (!b.length) b.push('<span class="tag good">✓ работает</span>');
  return b.join(' ');
}

function plTable(m, title) {
  if (!m) return '';
  const p = monthProfit(m);
  const lines = [
    ['Выручка', m.revenue],
    ['Поставки своим', m.revInternal],
    ['Себестоимость товаров', -m.cogs],
    ['Зарплаты', -m.wages],
    ['Аренда', -m.rent],
    ['Коммунальные', -m.upkeep],
    ['Реклама', -m.marketing],
    ['Перевозка', -m.transport],
    ['Таможенные пошлины', -(m.duty || 0)],
    ['Комиссия доставки', -(m.commission || 0)],
    ['Порча', -m.spoilage],
    ['Прочее (ремонт, штрафы)', -m.other],
  ].filter(([, v]) => Math.abs(v) >= 0.5);
  return `<table class="tbl pl"><tr><th colspan="2">${title}</th></tr>${lines.map(([k, v]) => `<tr><td>${k}</td><td class="${signClass(v)}">${money(v)}</td></tr>`).join('')}
    <tr class="total"><td>Прибыль до налога</td><td class="${signClass(p)}">${money(p)}</td></tr></table>`;
}

// Бизнес соперника: публичная информация и возможность выкупить его помещение
function renderRivalUnit(app, u) {
  const { state } = app;
  const def = BUSINESSES[u.type];
  const co = state.companies[u.companyId];
  const lot = state.world.lots[u.lotId];
  const d = state.world.districts[lot.districtId];
  const place = state.world.places[u.placeId];
  let html = `<h2 class="with-icon">${bizIcon(u.type, 'title')} ${esc(u.name)}</h2>
    <div class="sub"><span class="swatch" style="background:${co.color}"></span>${co.ai ? `Корпорация (${ARCHETYPES[co.ai.archetype].name.toLowerCase()})` : 'Соперник'}: <b>${esc(co.name)}</b> ·
    <a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a></div><div class="card">`;
  html += row('Уровень', `${u.level}`);
  if (def.retail) {
    html += row('Рейтинг', `<span class="stars">${stars(u.quality)}</span>`);
    for (const p of def.retail.products) html += row(`Цена: ${p.name}`, `${money(u.prices[p.id], { cents: true })} <small class="muted">(норма ${money(refPrice(place, p), { cents: true })})</small>`);
  }
  html += row('Помещение', ownerText(app, lot)) + '</div>';
  if (co.ai) {
    const price = rivalUnitPrice(state, u);
    html += `<div class="card"><b>🤝 Сделки с «${esc(co.name)}»</b>
      <div class="row"><span>Выкупить эту точку<br><small class="muted">оборудование +10%, полтора года прибыли; цена меняется с экономикой и рынком</small></span>
      <button class="mini wide" data-action="buyRivalUnit" data-id="${u.id}" ${app.company.cash < price ? 'disabled' : ''}>${moneyShort(price)}</button></div>
      ${truceRow(app, co)}</div>`;
  }
  html += lotOwnershipButtons(app, lot);
  return html;
}

// Строка «перемирие с корпорацией»: статус или кнопка с текущей ценой
function truceRow(app, rival) {
  const { state } = app;
  const until = app.company.truces?.[rival.id];
  if (until > state.day) return `<div class="row"><span>🕊 Перемирие действует</span><b>до ${formatDate(until)}</b></div>`;
  const cost = truceCost(state, rival, app.companyId);
  return `<div class="row"><span>🕊 Перемирие на ${TRUCE_MONTHS} мес.<br><small class="muted">не открывается в ваших городах, не трогает помещения и акции</small></span>
    <button class="mini wide" data-action="buyTruce" data-id="${rival.id}" ${app.company.cash < cost ? 'disabled' : ''}>${moneyShort(cost)}</button></div>`;
}

// Корпорации, которые работают в городе вашей точки, и их предложения по ней
function rivalsNear(app, u) {
  const { state } = app;
  const offers = (state.offers || []).filter((o) => o.to === app.companyId && o.until > state.day && o.unitId === u.id);
  const near = Object.values(state.companies).filter((c) => c.ai && !c.bankrupt)
    .map((c) => ({ c, n: Object.values(state.units).filter((x) => x.companyId === c.id && x.placeId === u.placeId).length }))
    .filter((x) => x.n > 0);
  if (!offers.length && !near.length) return '';
  let html = '<h3>🦈 Корпорации рядом</h3>';
  for (const o of offers) {
    html += `<div class="card offer-card"><div>📨 ${esc(offerText(state, o))}</div><div class="row"><small class="muted">ещё ${o.until - state.day} дн.</small>
      <span><button class="mini wide" data-action="answerOffer" data-id="${o.id}" data-accept="1">Принять</button>
      <button class="mini wide" data-action="answerOffer" data-id="${o.id}" data-accept="0">Отказать</button></span></div></div>`;
  }
  for (const { c, n } of near) {
    html += `<div class="card"><div class="row"><span><span class="swatch" style="background:${c.color}"></span><b>${esc(c.name)}</b> <small class="muted">${ARCHETYPES[c.ai.archetype].name}</small></span>
      <small>${n} точ. в городе</small></div>${truceRow(app, c)}</div>`;
  }
  return html;
}

function transitText(state, u, g) {
  const q = inTransit(state, u, g);
  if (q < 0.5) return '—';
  const far = state.shipments.filter((s) => s.to === u.id && s.good === g);
  const next = far.length ? Math.min(...far.map((s) => s.arrive)) - state.day : 1;
  return `${num(q, q < 10 ? 1 : 0)} <small class="muted">${far.length ? `· ${next} дн.` : '· завтра'}</small>`;
}

function renderWarehouse(app, u) {
  const { state } = app;
  const cap = storageCapacity(state, u);
  const used = storedKg(state, u);
  const served = servedBy(state, u);
  let html = `<h3>Склад</h3><div class="card">
    ${row('Заполнен', `${num(used / 1000, 1)} из ${num(cap / 1000, 1)} т`)}
    <div class="progress"><span style="width:${Math.min(100, (used / cap) * 100).toFixed(0)}%"></span></div>
    <div class="row"><span>Держать запас, дней</span><span class="price-ctl"><input type="number" min="3" max="60" step="1" value="${u.coverDays}" data-change="setWarehouseCover" data-id="${u.id}"></span></div>
    ${row('Обслуживает точек', `${served.length} (в радиусе ${num(BUSINESSES[u.type].storage.radiusKm)} км)`)}
    <div class="muted small">Склад закупает оптом (наценка 3% вместо 7%), дальние партии едут по оптовому тарифу, точки рядом получают товар за 1 день. Скоропорт на складе портится вдвое медленнее.</div></div>`;
  if (served.length) html += `<div class="list">${served.map((s) => unitListItem(app, s)).join('')}</div>`;
  return html;
}

function renderContracts(app, u) {
  const { state } = app;
  const mine = state.contracts.filter((c) => c.unitId === u.id);
  const { buy, sell } = contractGoods(u);
  if (!mine.length && !buy.length && !sell.length) return '';
  let html = '<h3>Контракты</h3>';
  for (const c of mine) {
    const left = c.end - state.day;
    html += `<div class="card contract"><div class="row"><span>${goodIcon(c.good, 'inline')} <b>${c.side === 'buy' ? 'Закупка' : 'Продажа'}</b> ${GOODS[c.good].name}</span>
      <b>${num(c.qtyPerDay, c.qtyPerDay < 10 ? 1 : 0)} ${GOODS[c.good].unit}/день × ${money(c.price, { cents: true })}</b></div>
      <div class="row"><small class="muted">ещё ${left} дн. · рынок сейчас ${money(c.side === 'buy' ? buyPrice(state, c.good, state.world.places[u.placeId]) : sellPrice(state, c.good, state.world.places[u.placeId]), { cents: true })}</small>
      <button class="mini wide" data-action="cancelContract" data-id="${c.id}" title="Штраф 15% от оставшегося объёма: ${money(remainingValue(state, c) * 0.15)}">Расторгнуть</button></div></div>`;
  }
  const offers = [...buy.map((g) => ['buy', g]), ...sell.map((g) => ['sell', g])]
    .filter(([side, g]) => !mine.some((c) => c.side === side && c.good === g));
  if (offers.length) {
    html += `<div class="muted small">Фиксированная цена на весь срок: защищает от скачков рынка, но если рынок пойдёт в вашу сторону — вы проиграете.
      Закупка — «бери или плати»: товар привозят каждый день. Продажа — штраф 10% за недопоставку. Разрыв — штраф 15%.</div>
      <table class="tbl"><tr><th>Предложение</th><th>3 мес</th><th>6 мес</th><th>12 мес</th></tr>`;
    for (const [side, g] of offers) {
      const o3 = contractOffer(state, u, g, side, 3);
      if (!(o3.qtyPerDay > 0)) continue;
      html += `<tr><td>${goodIcon(g, 'inline')} ${side === 'buy' ? 'Закупка' : 'Продажа'} ${num(o3.qtyPerDay, o3.qtyPerDay < 10 ? 1 : 0)} ${GOODS[g].unit}/день</td>`;
      for (const m of CONTRACT_MONTHS) {
        const o = contractOffer(state, u, g, side, m);
        html += `<td><button class="mini wide" data-action="signContract" data-id="${u.id}" data-good="${g}" data-side="${side}" data-months="${m}">${money(o.price, { cents: true })}</button></td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
  }
  return html;
}

// Оборудование и люди: вместо кнопки «улучшить» — покупка оборудования классом выше и найм квалифицированных людей
function renderStaff(app, u) {
  const { state } = app;
  const def = BUSINESSES[u.type];
  const place = state.world.places[u.placeId];
  const m = morale(u);
  const eff = efficiency(state, u);
  const att = attention(state, app.companyId);
  const cond = condition(u);
  let html = `<h3>Оборудование</h3><div class="card"><table class="tbl compact class-tbl"><tr><th>Класс</th><th>Качество</th><th>Мощность</th><th></th></tr>`;
  EQUIPMENT.forEach((e, i) => {
    const level = i + 1;
    const capNow = def.retail ? def.retail.cap[i] : def.production?.cap ? def.production.cap[i] : null;
    const cost = level > u.level ? equipmentCost(state, u, level) : 0;
    html += `<tr class="${level === u.level ? 'cur' : ''}"><td>${e.name}</td><td>${stars(e.k)}</td><td>${capNow ? num(capNow * (recipeOf(u)?.rate ?? 1)) : '—'}</td>
      <td>${level === u.level ? '<b>стоит</b>' : level > u.level ? `<button class="mini" data-action="buyEquipment" data-id="${u.id}" data-level="${level}" ${app.company.cash < cost ? 'disabled' : ''}>${moneyShort(cost)}</button>` : ''}</td></tr>`;
  });
  html += `</table>${row('Износ', `<span class="${cond < 50 ? 'neg' : cond < 75 ? '' : 'pos'}">${num(100 - cond)}%</span>`)}
    <div class="progress ${cond < 50 ? 'bad' : cond < 75 ? 'warn' : ''}"><span style="width:${cond.toFixed(0)}%"></span></div>
    ${cond <= 95 ? `<div class="row"><span>Ремонт и обновление</span><button class="mini wide" data-action="renovate" data-id="${u.id}">🛠 ${moneyShort(renovateCost(state, u))}</button></div>` : ''}
    ${row('Коммунальные', `${money(monthlyUpkeep(state, u))}/мес`)}</div>`;

  html += `<h3>Персонал</h3><div class="card">
    <div class="row"><span>${def.staff.role}: <b>${u.staff}</b> <small class="muted">${money(monthlyWage(state, u))}/мес</small></span>
      <span class="price-ctl"><button class="mini" data-action="staff" data-id="${u.id}" data-delta="-1">−</button><button class="mini" data-action="staff" data-id="${u.id}" data-delta="1">+</button></span></div>
    <table class="tbl compact class-tbl"><tr><th>Квалификация</th><th>Качество</th><th>Зарплата</th><th></th></tr>`;
  for (const l of WAGE_LEVELS) {
    const c = STAFF_CLASSES[l];
    const fee = l > wageLevel(u) ? hiringFee(state, u, l) : 0;
    html += `<tr class="${wageLevel(u) === l ? 'cur' : ''}"><td>${c.name}</td><td>${stars(c.k)}</td><td>${Math.round(l * 100)}%</td>
      <td>${wageLevel(u) === l ? '<b>сейчас</b>' : u.brandId ? '' : `<button class="mini" data-action="setWage" data-id="${u.id}" data-level="${l}" title="${fee ? 'Подбор людей: месячная разница в зарплате' : 'Перевести на дешёвый персонал'}">${fee ? moneyShort(fee) : '↓'}</button>`}</td></tr>`;
  }
  html += `</table>${u.brandId ? '<div class="muted small">Квалификацию в точках сети задаёт сеть.</div>' : ''}
    ${row('Мораль', `<span class="${m < 35 ? 'neg' : m < 50 ? '' : 'pos'}">${num(m)}/100</span>`)}
    ${row('Производительность', `<span class="${signClass(eff - 1)}">${pct(eff)}</span>`)}
    <div class="row"><span>🎓 Обучение ${'★'.repeat(Math.floor(u.training || 0))}${'☆'.repeat(MAX_TRAINING - Math.floor(u.training || 0))}</span>
      ${(u.training || 0) < MAX_TRAINING ? `<button class="mini wide" data-action="trainStaff" data-id="${u.id}">${moneyShort(trainingCost(state, u, monthlyWage(state, u)))}</button>` : '<b class="pos">макс.</b>'}</div>
    ${u.star ? `<div class="row"><span>⭐ Звезда: +0.4★, зарплата ×3</span><button class="mini wide" data-action="releaseStar" data-id="${u.id}">Отпустить</button></div>` : ''}`;
  if (u.manager) {
    html += `<div class="row"><span>👔 Управляющий · ${money(managerCost(place, u.type))}/мес</span><button class="mini wide" data-action="fireManager" data-id="${u.id}">Уволить</button></div>
      <label class="row check"><span>Подбирает штат под спрос</span><input type="checkbox" data-change="setAutoStaff" data-id="${u.id}" ${u.autoStaff ? 'checked' : ''}></label>`;
  } else {
    html += `<div class="row"><span>Управляющего нет${att.excess ? ' · <span class="neg">внимания не хватает</span>' : ''}</span>
      <button class="mini wide" data-action="hireManager" data-id="${u.id}">👔 ${money(managerCost(place, u.type))}/мес</button></div>`;
  }
  return `${html}</div>`;
}

// Закупки: запасы, откуда товар, его класс, и какой класс брать на рынке
function renderSupplies(app, u) {
  const { state } = app;
  const def = BUSINESSES[u.type];
  const goods = [...new Set([...Object.keys(u.usage), ...Object.keys(u.inv), ...Object.keys(u.target || {})])];
  if (!goods.length) return '';
  const out = recipeOf(u)?.output;
  let html = '<h3>Закупки</h3>';
  for (const g of goods) {
    const q = invQty(u, g);
    const use = u.usage[g] || 0;
    const days = use > 0 ? q / use : null;
    const k = invK(u, g);
    if (g === out) {
      html += `<div class="card supply-card"><div class="row"><b>${goodIcon(g, 'inline')} ${GOODS[g].name}</b><span>${num(q)} ${GOODS[g].unit} · 🏭 свой выпуск · ${num(k, 1)}★</span></div></div>`;
      continue;
    }
    const opts = supplierOptions(state, u, g);
    const from = u.suppliers?.[g] ?? 'auto';
    const grade = u.grades?.[g] ?? 'std';
    const status = SUPPLY_LABEL[u.supplied?.[g]] || '—';
    html += `<div class="card supply-card"><div class="row"><b>${goodIcon(g, 'inline')} ${GOODS[g].name}</b>
      <span class="${days !== null && days < 1 ? 'neg' : ''}">${num(q, q < 10 ? 1 : 0)} ${GOODS[g].unit}${days !== null ? ` · ${num(days, 1)} дн.` : ''}${q > 0 ? ` · ${gradeName(k)} ${num(k, 1)}★` : ''}</span></div>
      <div class="row small"><span>Сейчас: ${status} · в пути ${transitText(state, u, g)}</span><span>расход ~${num(use, use < 10 ? 1 : 0)}/день</span></div>
      <div class="supply-ctl">
        <label>Поставщик <select data-change="setSupplier" data-id="${u.id}" data-good="${g}">
          <option value="auto" ${from === 'auto' ? 'selected' : ''}>Авто: свои, если дешевле, иначе рынок</option>
          ${opts.map((o) => `<option value="${o.key}" ${from === o.key ? 'selected' : ''}>${esc(o.name)} · ${money(o.price, { cents: true })} · ${num(o.k, 1)}★ · ${o.lead} дн.${o.km ? ` · ${num(o.km)} км` : ''}${o.stock !== Infinity ? ` · есть ${num(o.stock)}` : ''}</option>`).join('')}
        </select></label>
        <label>Класс на рынке <select data-change="setGrade" data-id="${u.id}" data-good="${g}" ${u.brandId ? 'disabled' : ''}>
          ${Object.entries(GRADES).map(([id, gr]) => `<option value="${id}" ${grade === id ? 'selected' : ''}>${gr.name} ${gr.k}★</option>`).join('')}</select></label>
        <label>Держать в запасе <input type="number" min="0" step="1" placeholder="авто" value="${u.target?.[g] ?? ''}" data-change="setTarget" data-id="${u.id}" data-good="${g}"> ${GOODS[g].unit}</label>
      </div></div>`;
  }
  return html;
}

// Себестоимость единицы товара: сырьё по цене запаса (если пусто — по цене поставщика)
function productCost(state, u, p) {
  const place = state.world.places[u.placeId];
  let c = 0;
  for (const [g, q] of Object.entries(p.recipe)) {
    const s = u.inv[g];
    c += q * (s && s.q > 0 ? s.c : buyPrice(state, g, place) * qualityPrice(gradeK(u, g), g));
  }
  return c;
}

// Ассортимент и цены: что на полках, почём, сколько стоит сделать, сколько продано
function renderAssortment(app, u, brand) {
  const { state } = app;
  const def = BUSINESSES[u.type];
  const place = state.world.places[u.placeId];
  const active = new Set(activeProducts(u).map((p) => p.id));
  const stats = u.month.byProduct || {};
  let html = `<h3>Ассортимент и цены <small class="muted">полки: ${active.size} из ${shelfCount(u)}</small></h3>
    <table class="tbl compact assort"><tr><th></th><th>Товар</th><th>Цена</th><th>Себест.</th><th>Маржа</th><th>Продано</th></tr>`;
  def.retail.products.forEach((p, i) => {
    const on = active.has(p.id);
    const cost = productCost(state, u, p);
    const price = u.prices[p.id] ?? refPrice(place, p);
    const st = stats[p.id];
    const lock = i === 0 || u.brandId;
    html += `<tr class="${on ? '' : 'off'}"><td><input type="checkbox" ${on ? 'checked' : ''} ${lock ? 'disabled' : ''} data-change="setAssortment" data-id="${u.id}" data-product="${p.id}" title="${i === 0 ? 'Основной товар' : 'Поставить на полку'}"></td>
      <td>${p.name}<br><small class="muted" title="Обычная цена в городе">обычно ${money(refPrice(place, p), { cents: true })}</small></td>
      <td>${brand ? money(price, { cents: true }) : `<input class="price-in" type="number" step="0.1" min="0.1" value="${price.toFixed(2)}" data-change="setPrice" data-id="${u.id}" data-product="${p.id}">`}</td>
      <td>${money(cost, { cents: true })}</td><td class="${signClass(price - cost)}">${price > 0 ? pct((price - cost) / price) : '—'}</td>
      <td>${st ? `${num(st[0])}<br><small class="muted">${moneyShort(st[1] - st[2])}</small>` : '—'}</td></tr>`;
  });
  html += '</table>';
  if (brand) html += `<div class="muted small">Ассортимент, цены и рекламу задаёт сеть «${esc(brand.name)}» — <a href="#" data-action="openTab" data-tab="brands">настроить</a>.</div>`;
  return html;
}

// Реклама по каналам: бюджет и насколько канал подходит точке
export function fitStars(f) {
  return f >= 1.3 ? '★★★' : f >= 1 ? '★★' : f >= 0.75 ? '★' : '·';
}

function renderAds(app, u) {
  const { state } = app;
  const ads = adsOf(u);
  let html = '<div class="muted small">Реклама по каналам, $/мес. Звёзды — насколько канал подходит этой точке.</div>';
  for (const [ch, c] of Object.entries(AD_CHANNELS)) {
    const own = ch === 'billboard' && ownBillboards(state, u.companyId, u.placeId);
    html += `<div class="row"><span title="${esc(c.desc)}">${c.icon} ${c.name} <small class="muted">${fitStars(channelFit(state, u, ch))}${own ? ' · свои щиты ✓' : ''}</small></span>
      <span class="price-ctl"><input type="number" step="50" min="0" value="${ads[ch] || 0}" data-change="setAds" data-id="${u.id}" data-channel="${ch}"></span></div>`;
  }
  return html;
}

// Выбор сети для точки и узнаваемость бренда в городе
function renderBrandRow(app, u, brand) {
  const { state } = app;
  const options = Object.values(state.brands).filter((b) => b.companyId === app.companyId && b.type === u.type);
  const aw = brand ? brandAwareness(brand, u.placeId) : 0;
  return `<div class="card"><div class="row"><span>🏷️ Сеть</span><select data-change="joinBrand" data-id="${u.id}">
    <option value="">— отдельная точка —</option>${options.map((b) => `<option value="${b.id}" ${b.id === u.brandId ? 'selected' : ''}>${esc(b.name)} (${BRAND_TIERS[b.tier].name.toLowerCase()})</option>`).join('')}</select></div>
    ${brand ? row('Узнаваемость бренда в городе', pct(aw)) + row('Итоговая узнаваемость точки', pct(effectiveAwareness(state, u))) : `<div class="muted small">${options.length ? 'Добавьте точку в сеть — она получит узнаваемость бренда.' : 'Создайте сеть во вкладке «Сети», чтобы управлять похожими точками вместе и наращивать узнаваемость.'}</div>`}</div>`;
}

const UNIT_TABS = [['overview', 'Обзор'], ['sales', 'Продажи'], ['assets', 'Оборудование и люди'], ['supply', 'Закупки'], ['more', 'Прочее']];

function renderUnit(app, u) {
  const { state } = app;
  if (u.companyId !== app.companyId) return renderRivalUnit(app, u);
  const def = BUSINESSES[u.type];
  const lot = state.world.lots[u.lotId];
  const d = state.world.districts[lot.districtId];
  const place = state.world.places[u.placeId];
  const t = u.today || {};
  const brand = u.brandId ? state.brands[u.brandId] : null;
  const tab = app.unitTab || 'overview';
  const salesName = def.retail ? 'Продажи' : def.production ? 'Производство' : 'Услуги';
  let html = `<h2 class="with-icon">${bizIcon(u.type, 'title')} ${esc(u.name)}</h2>
    <div class="sub"><a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a> · ${EQUIPMENT[u.level - 1].name.toLowerCase()} оборудование · с ${formatDate(u.opened)}</div>
    <div class="badges">${statusBadges(app, u)}</div>
    <div class="chips unit-tabs">${UNIT_TABS.filter(([id]) => id !== 'supply' || Object.keys(u.usage).length || Object.keys(u.inv).length)
      .map(([id, name]) => `<button class="chip ${tab === id ? 'active' : ''}" data-action="unitTab" data-tab="${id}">${id === 'sales' ? salesName : name}</button>`).join('')}</div>`;

  if (tab === 'overview') {
    html += '<div class="kpis">';
    if (def.retail) {
      html += `<div class="kpi"><small>Клиентов</small><b>${num(t.customers ?? 0)}</b><small>спрос ${num(t.potential ?? 0)} · мощн. ${num(retailCapacity(state, u))}</small></div>
        <div class="kpi"><small>Рейтинг</small><b class="stars">${stars(u.quality)}</b><small>${num(u.quality, 1)}★ · товар ${num(productK(u) ?? 3, 1)}★</small></div>
        <div class="kpi"><small>Узнаваемость</small><b>${pct(effectiveAwareness(state, u))}</b><small>реклама ${moneyShort(u.marketing)}/мес</small></div>`;
    }
    if (def.production) {
      const outId = recipeOf(u).output;
      const out = GOODS[outId];
      const k = t.outK ?? outputK(state, u, null);
      html += `<div class="kpi"><small>Выпуск/день</small><b>${num(t.produced ?? 0)} ${out.unit}</b><small>${goodIcon(outId, 'inline')} ${out.name} · макс ${num(productionCapacity(state, u))}</small></div>
        <div class="kpi"><small>Класс продукции</small><b class="stars">${stars(k)}</b><small>${gradeName(k)} · ${num(k, 1)}★</small></div>
        <div class="kpi"><small>Цена на рынке</small><b>${money(sellPrice(state, outId, place) * qualityPrice(k, outId), { cents: true })}</b><small>за ${out.unit}</small></div>`;
    }
    if (def.service) {
      html += `<div class="kpi"><small>Работают</small><b>${num(t.working ?? 0)} из ${u.staff}</b><small>${def.staff.role.toLowerCase()}</small></div>
        <div class="kpi"><small>${def.service.realEstate ? 'Доход/день' : 'Заказы/день'}</small><b>${money(t.revenue ?? 0)}</b><small>${def.service.realEstate ? `заполненность ${pct(t.occupancy ?? 0)}` : `спрос ${pct(serviceMood(state, u))}`}</small></div>`;
    }
    html += '</div>';
    if (def.service) html += `<div class="card small">🎁 ${def.service.bonus}.</div>`;
    if (u.history.length) html += `<h3>Прибыль по месяцам</h3>${bars(u.history.slice(-12), 300, 48)}`;
    html += plTable(u.month, `Текущий месяц (${u.month.days} дн.)`);
    if (u.last) html += plTable(u.last, 'Прошлый месяц');
    html += `<div class="card">${row('Аренда', ownerText(app, lot))}${row('Площадь', areaText(lot))}${lot.zoning !== 'farmland' ? row('Прохожих', `${num(lot.traffic)}/день`) : ''}</div>`;
  }

  if (tab === 'sales') {
    if (def.retail) html += renderBrandRow(app, u, brand);
    if (def.retail) html += renderAssortment(app, u, brand);
    if (def.retail && DELIVERY_CATEGORIES.includes(def.category)) {
      const courier = ownCourier(state, u.companyId, u.placeId);
      html += `<div class="card"><div class="row"><span>🛵 Доставка${t.delivered ? ` <small class="muted">${num(t.delivered)} заказов</small>` : ''}</span><select data-change="setDelivery" data-id="${u.id}">
        <option value="none" ${!u.delivery || u.delivery === 'none' ? 'selected' : ''}>Нет</option>
        <option value="aggregator" ${u.delivery === 'aggregator' ? 'selected' : ''}>Агрегатор · комиссия 25%</option>
        <option value="own" ${u.delivery === 'own' ? 'selected' : ''}>Своя · комиссия 8%${courier ? '' : ' (нет курьеров)'}</option></select></div></div>`;
    }
    if (def.retail && !brand) html += renderAds(app, u);
    if (def.production?.recipes) {
      const cur = recipeOf(u).output;
      const opts = allowedRecipes(place, u.type);
      html += `<div class="card"><div class="row"><span>Продукция</span><select data-change="setRecipe" data-id="${u.id}">${opts.map((g) => {
        const r = def.production.recipes[g];
        const ins = Object.keys(r.inputs).map((i) => GOODS[i].name.toLowerCase()).join(', ');
        return `<option value="${g}" ${g === cur ? 'selected' : ''}>${GOODS[g].icon} ${GOODS[g].name}${ins ? ` ← ${ins}` : ''}</option>`;
      }).join('')}</select></div><div class="muted small">Перенастройка: 5% стоимости оборудования, неделя простоя.</div></div>`;
    }
    if (def.production) {
      html += `<div class="card"><div class="row"><span>Сбыт</span><select data-change="setSellMode" data-id="${u.id}">
        <option value="auto" ${u.sellMode === 'auto' ? 'selected' : ''}>Своим, излишки — на рынок</option>
        <option value="all" ${u.sellMode === 'all' ? 'selected' : ''}>Всё на рынок</option>
        <option value="hold" ${u.sellMode === 'hold' ? 'selected' : ''}>Только своим</option></select></div></div>`;
    }
    if (def.service) html += `<div class="card">${row('Спрос на услуги', pct(serviceMood(state, u)))}${row('Бонус компании', def.service.bonus)}</div>`;
    if (def.storage) html += renderWarehouse(app, u);
  }

  if (tab === 'assets') html += renderStaff(app, u);

  if (tab === 'supply') {
    html += renderSupplies(app, u);
    html += renderContracts(app, u);
  }

  if (tab === 'more') {
    html += '<div class="btn-row">';
    if (!lot.ownerId) html += lotOwnershipButtons(app, lot);
    html += `<button class="btn ghost" data-action="copySettings" data-id="${u.id}">📋 Настройки — всем «${def.name}»</button>
      <button class="btn ghost" data-action="saveTemplate" data-id="${u.id}">💾 Шаблон</button>
      <button class="btn danger" data-action="close" data-id="${u.id}">✖ Закрыть</button></div>`;
    html += rivalsNear(app, u);
    const buyers = Object.values(state.companies).filter((c) => c.ai && !c.bankrupt && rivalWants(state, c, u));
    if (buyers.length) {
      html += `<div class="card"><div class="row"><span>🤝 Продать корпорации · ~${moneyShort(bidForUnit(state, u))}</span>
        <span><select id="sell-to-${u.id}">${buyers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        <button class="mini wide" data-action="sellToRival" data-id="${u.id}">Продать</button></span></div></div>`;
    }
  } else if (tab !== 'more') {
    // предложения корпораций по точке видны всегда
    const offers = (state.offers || []).filter((o) => o.to === app.companyId && o.until > state.day && o.unitId === u.id);
    if (offers.length) html += `<div class="note">📨 Есть предложение по этой точке — <a href="#" data-action="unitTab" data-tab="more">посмотреть</a>.</div>`;
  }
  return html;
}

export function renderPanel(app) {
  const el = document.getElementById('panel');
  const sel = app.selection;
  const { state } = app;
  let html = '';
  if (sel?.kind === 'place' && state.world.places[sel.id]) html = renderPlace(app, state.world.places[sel.id]);
  else if (sel?.kind === 'district' && state.world.districts[sel.id]) html = renderDistrict(app, state.world.districts[sel.id]);
  else if (sel?.kind === 'lot' && state.world.lots[sel.id]) {
    const lot = state.world.lots[sel.id];
    html = lot.unitId ? renderUnit(app, state.units[lot.unitId]) : renderLot(app, lot);
  } else if (sel?.kind === 'unit' && state.units[sel.id]) html = renderUnit(app, state.units[sel.id]);
  else if (sel?.kind === 'shop' && state.world.districts[sel.districtId]) html = renderShop(app, sel);
  else if (sel?.kind === 'market' && state.world.places[sel.placeId]) html = renderMarket(app, sel);
  if (!html) {
    el.classList.remove('open');
    el.innerHTML = '';
    return;
  }
  const scroll = el.scrollTop;
  el.innerHTML = `<button class="close-x" data-action="deselect" title="Закрыть">×</button>${html}`;
  el.scrollTop = scroll;
  el.classList.add('open');
}
