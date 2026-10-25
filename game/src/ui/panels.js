import { bizIcon, districtIcon, goodIcon } from './icons.js';
import { BUSINESSES, MAX_LEVEL } from '../data/businesses.js';
import { DISTRICTS, ZONING_NAMES } from '../data/districts.js';
import { COUNTRIES, BLOCS } from '../data/cities.js';
import { GOODS } from '../data/goods.js';
import { AD_CHANNELS } from '../data/ads.js';
import { MARKET_REGIONS } from '../data/regions.js';
import {
  attention, efficiency, morale, wageLevel, managerCost, WAGE_LEVELS, BASE_ATTENTION,
  BRAND_TIERS, brandAwareness, effectiveAwareness, LOCAL_TEAM_UNITS,
  countryState, regionOf, inTransit, contractOffer, contractGoods, remainingValue, CONTRACT_MONTHS, storageCapacity, storedKg, servedBy,
  forecast, buildableTypes, districtShares, refPrice, upgradeCost, monthProfit, monthlyWage, monthlyRent,
  monthlyUpkeep, retailCapacity, productionCapacity, invQty, buyPrice, sellPrice, coverDays, formatDate,
  condition, renovateCost, seasonFactor, rivalUnitPrice, ARCHETYPES, adsOf, channelFit, ownBillboards, trendOf, districtEventOf,
} from '../sim/index.js';
import { money, moneyShort, num, pct, stars, months, esc, signClass, bars } from './format.js';

const CATEGORY_LABEL = { coffee: '☕ Кофе', fastfood: '🌭 Фастфуд', grocery: '🏪 Продукты', bakery: '🥐 Выпечка', restaurant: '🍽️ Рестораны', fuel: '⛽ АЗС', electronics: '📱 Техника' };
const SUPPLY_LABEL = { internal: '🔗 своё', warehouse: '🏗️ склад', contract: '📝 контракт', market: '💹 рынок', nocash: '⛔ нет денег' };

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
    <div class="sub">${country.name} · налог на прибыль ${pct(cs.tax)} · пошлина ${pct(cs.tariff)}${country.bloc ? ` (${BLOCS[country.bloc]} — без пошлин)` : ''} ${econ}</div><div class="card">`;
  if (place.kind === 'city') {
    html += row('Население', `${num(place.pop, 1)} млн`) + row('Доходы жителей', pct(place.income)) +
      row('Уровень аренды', pct(place.rent)) + row('Уровень зарплат', pct(place.wage));
  } else {
    html += row(place.kinds.includes('oil_well') ? 'Можно добывать' : 'Можно выращивать', place.kinds.map((k) => `${bizIcon(k, 'inline')} ${BUSINESSES[k].name}`).join('<br>')) +
      row(place.kinds.includes('oil_well') ? 'Дебит скважин' : 'Урожайность', pct(place.productivity)) + row('Аренда земли', `${money(place.landRent)}/га в мес`) +
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
  let html = `<h2>📍 Участок ${lot.id.split('-').pop()}</h2>
    <div class="sub"><a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a></div><div class="card">`;
  html += row('Зонирование', ZONING_NAMES[lot.zoning]) + row('Площадь', areaText(lot));
  if (lot.zoning !== 'farmland') html += row('Поток людей', `${num(lot.traffic)} в день`) + row('Видимость', pct(lot.visibility));
  html += row('Аренда', ownerText(app, lot)) + row('Цена покупки', money(lot.price));
  html += '</div>';
  html += lotOwnershipButtons(app, lot);
  if (lot.ownerId && lot.ownerId !== app.companyId) {
    html += '<p class="muted">Помещение принадлежит другой компании — открыть здесь бизнес нельзя.</p>';
    return html;
  }
  const types = buildableTypes(state, lot);
  html += '<h3>Что можно открыть</h3>';
  if (!types.length) html += '<p class="muted">Здесь нечего строить.</p>';
  const forecasts = types.map((t) => forecast(state, lot.id, t, app.companyId)).sort((a, b) => b.profit - a.profit);
  for (const f of forecasts) {
    const def = BUSINESSES[f.type];
    const cost = f.capex + f.extra;
    const afford = app.company.cash >= cost && !f.locked;
    let activity;
    if (def.retail) activity = `${num(f.customers)} клиентов/день${f.competitors ? ` · конкурентов: ${f.competitors}` : ''}`;
    else if (def.production) activity = `${num(f.produced)} ${GOODS[f.output].unit}/день ${goodIcon(f.output, 'inline')}`;
    else if (def.service) activity = `заказы ИИ-клиентов · ${def.service.bonus.toLowerCase()}`;
    else activity = `запас для точек в радиусе ${num(def.storage.radiusKm)} км`;
    html += `<div class="offer">
      <div class="offer-head"><span class="li-icon big">${bizIcon(f.type)}</span><b>${def.name}</b><span class="tier">тир ${def.tier}</span></div>
      <div class="muted small">${def.description}</div>
      <div class="offer-grid">
        <span>Вложения</span><b>${money(f.capex)}</b>
        <span>Ожидается</span><b>${activity}</b>
        <span>Выручка/мес</span><b>${money(f.revenue)}</b>
        <span>Расходы/мес</span><b title="${costTitle(f.costs)}">${money(f.revenue - f.profit)} ⓘ</b>
        <span>Прибыль/мес</span><b class="${signClass(f.profit)}">${money(f.profit)}</b>
        <span>Окупаемость</span><b>${months(f.payback)}</b>
      </div>
      ${f.entryFee ? `<div class="note warn">🌍 Новая страна: выход на рынок ${money(f.entryFee)} (разово)${f.foreign ? `, без местной команды зарплаты и содержание +10% (пока меньше ${LOCAL_TEAM_UNITS} точек)` : ''}.</div>` : f.foreign ? `<div class="note warn">Пока у вас меньше ${LOCAL_TEAM_UNITS} точек в этой стране — зарплаты и содержание +10%.</div>` : ''}
      ${f.efficiency && f.efficiency < 1 ? `<div class="note warn">👔 Вам не хватает внимания на все точки: без управляющего эта будет работать на ${pct(f.efficiency / 1.06)}.</div>` : ''}
      ${f.locked ? `<div class="note warn">🔬 Нужна технология «${esc(f.locked)}» — <a href="#" data-action="openTab" data-tab="research">исследования</a>.</div>` : ''}
      ${f.license ? `<div class="note">📜 Нужна ${esc(f.license.name.toLowerCase())}: ${money(f.license.cost)} (разово, на всю страну).</div>` : ''}
      ${f.brandId ? `<div class="note">🏷️ В сети «${esc(state.brands[f.brandId].name)}»: узнаваемость бренда здесь ~${pct(f.brandAwareness)}, цены сети.</div>` : ''}
      <div class="btn-row">
      <button class="btn" data-action="open" data-lot="${lot.id}" data-type="${f.type}" data-brand="${f.brandId ?? ''}" data-profit="${def.storage ? 0 : f.profit}" data-capex="${cost}"
        data-costs="${f.revenue - f.profit}" ${afford ? '' : 'disabled'}>
        ${f.locked ? 'Нужна технология' : afford ? `Открыть${f.brandId ? ' в сети' : ''} за ${moneyShort(cost)}` : `Не хватает ${moneyShort(cost - app.company.cash)}`}</button>
      ${f.brandId && afford ? `<button class="btn ghost" data-action="open" data-lot="${lot.id}" data-type="${f.type}" data-brand="none" data-profit="${f.profit}" data-capex="${cost}" data-costs="${f.revenue - f.profit}">Отдельно</button>` : ''}
      </div>
    </div>`;
  }
  html += `<p class="muted small">Прогноз примерный: реальный результат зависит от цен, рекламы, качества и конкурентов. ${esc(place.name)}.</p>`;
  return html;
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
    html += `<button class="btn" data-action="buyRivalUnit" data-id="${u.id}" ${app.company.cash < price ? 'disabled' : ''}>🤝 Предложить выкуп · ${moneyShort(price)}</button>
      <div class="muted small">Корпорация продаст бизнес за стоимость оборудования +10% и полтора года его прибыли. Помещение, если оно её, — в придачу.</div>`;
  }
  html += lotOwnershipButtons(app, lot);
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

function renderStaff(app, u) {
  const { state } = app;
  const def = BUSINESSES[u.type];
  const place = state.world.places[u.placeId];
  const m = morale(u);
  const eff = efficiency(state, u);
  const att = attention(state, app.companyId);
  const moodText = m >= 75 ? 'довольны' : m >= 50 ? 'нормально' : m >= 35 ? 'недовольны' : 'на грани увольнения';
  let html = `<h3>Персонал</h3><div class="card">
    <div class="row"><span>${def.staff.role}: <b>${u.staff}</b><small class="muted"> · ${money(monthlyWage(state, u))}/мес каждый</small></span>
      <span class="price-ctl"><button class="mini" data-action="staff" data-id="${u.id}" data-delta="-1">−</button><button class="mini" data-action="staff" data-id="${u.id}" data-delta="1">+</button></span></div>
    ${u.brandId ? row('Зарплата', `${Math.round(wageLevel(u) * 100)}% <small class="muted">· задаёт сеть</small>`) : ''}
    <div class="row" ${u.brandId ? 'hidden' : ''}><span>Зарплата</span><span class="chips tight">${WAGE_LEVELS.map((l) => `<button class="chip ${wageLevel(u) === l ? 'active' : ''}" data-action="setWage" data-id="${u.id}" data-level="${l}">${Math.round(l * 100)}%</button>`).join('')}</span></div>
    <div class="row"><span>Мораль: ${moodText}</span><b>${num(m)} / 100</b></div>
    <div class="progress ${m < 35 ? 'bad' : m < 50 ? 'warn' : ''}"><span style="width:${m.toFixed(0)}%"></span></div>
    ${row('Производительность', `<span class="${signClass(eff - 1)}">${pct(eff)}</span>`)}`;
  if (u.manager) {
    html += `<div class="row"><span>👔 Управляющий · ${money(managerCost(place, u.type))}/мес</span><button class="mini wide" data-action="fireManager" data-id="${u.id}">Уволить</button></div>
      <label class="row check"><span>Сам подбирает число сотрудников под спрос</span><input type="checkbox" data-change="setAutoStaff" data-id="${u.id}" ${u.autoStaff ? 'checked' : ''}></label>`;
  } else {
    html += `<div class="row"><span>Управляющего нет${att.excess ? ' — <span class="neg">точка теряет эффективность</span>' : ''}</span>
      <button class="mini wide" data-action="hireManager" data-id="${u.id}">👔 Нанять · ${money(managerCost(place, u.type))}/мес</button></div>`;
  }
  html += `<div class="muted small">Мораль растёт от зарплаты выше рынка и управляющего, падает от перегрузки. Ниже 35 — увольнения, ниже 25 — забастовки.
    Вы лично ведёте до ${BASE_ATTENTION} точек без управляющих (сейчас ${att.used}); сверх этого каждая лишняя точка снижает эффективность всех неуправляемых на 4%.</div></div>`;
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

function renderUnit(app, u) {
  const { state } = app;
  if (u.companyId !== app.companyId) return renderRivalUnit(app, u);
  const def = BUSINESSES[u.type];
  const lot = state.world.lots[u.lotId];
  const d = state.world.districts[lot.districtId];
  const place = state.world.places[u.placeId];
  const t = u.today || {};
  let html = `<h2 class="with-icon">${bizIcon(u.type, 'title')} ${esc(u.name)}</h2>
    <div class="sub"><a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a> · уровень ${u.level}/${MAX_LEVEL} · с ${formatDate(u.opened)}</div>
    <div class="badges">${statusBadges(app, u)}</div><div class="kpis">`;
  if (def.retail) {
    html += `<div class="kpi"><small>Клиентов сегодня</small><b>${num(t.customers ?? 0)}</b><small>спрос ${num(t.potential ?? 0)} · мощность ${num(retailCapacity(state, u))}</small></div>
      <div class="kpi"><small>Рейтинг</small><b class="stars">${stars(u.quality)}</b><small>${num(u.quality, 1)} из 5</small></div>
      <div class="kpi"><small>Узнаваемость</small><b>${pct(effectiveAwareness(state, u))}</b><small>реклама ${money(u.marketing)}/мес</small></div>`;
  }
  if (def.production) {
    const out = GOODS[def.production.recipe.output];
    html += `<div class="kpi"><small>Выпуск сегодня</small><b>${num(t.produced ?? 0)} ${out.unit}</b><small>${goodIcon(def.production.recipe.output, 'inline')} ${out.name} · макс ${num(productionCapacity(state, u))}</small></div>
      <div class="kpi"><small>Цена продажи</small><b>${money(sellPrice(state, def.production.recipe.output, place), { cents: true })}</b><small>за ${out.unit} · рынок «${MARKET_REGIONS[regionOf(place)].name}»</small></div>`;
  }
  if (def.service) {
    html += `<div class="kpi"><small>Работают сегодня</small><b>${num(t.working ?? 0)} из ${u.staff}</b><small>${def.staff.role.toLowerCase()}</small></div>
      <div class="kpi"><small>Заказы сегодня</small><b>${money(t.revenue ?? 0)}</b><small>от ИИ-клиентов</small></div>`;
  }
  html += '</div>';
  if (def.service) html += `<div class="card small">🎁 <b>Бонус компании:</b> ${def.service.bonus}.</div>`;

  const brand = u.brandId ? state.brands[u.brandId] : null;
  if (def.retail) html += renderBrandRow(app, u, brand);
  if (def.retail && brand) {
    html += `<h3>Цены</h3><div class="card">${def.retail.products.map((p) => row(p.name, `${money(u.prices[p.id], { cents: true })} <small class="muted">· ${Math.round((brand.priceRatio[p.id] ?? 1) * 100)}% нормы</small>`)).join('')}
      <div class="muted small">Цены, рекламу и зарплаты задаёт сеть «${esc(brand.name)}» — <a href="#" data-action="openTab" data-tab="brands">настроить сеть</a>.</div></div>`;
  } else if (def.retail) {
    html += '<h3>Цены</h3><div class="card">';
    for (const p of def.retail.products) {
      const ref = refPrice(place, p);
      html += `<div class="row"><span>${p.name}<small class="muted"> · норма ${money(ref, { cents: true })}</small></span>
        <span class="price-ctl"><button class="mini" data-action="priceStep" data-id="${u.id}" data-product="${p.id}" data-step="-0.1">−</button>
        <input type="number" step="0.1" min="0.1" value="${u.prices[p.id].toFixed(2)}" data-change="setPrice" data-id="${u.id}" data-product="${p.id}">
        <button class="mini" data-action="priceStep" data-id="${u.id}" data-product="${p.id}" data-step="0.1">+</button></span></div>`;
    }
    html += '<div class="muted small">Дешевле нормы — больше клиентов, но меньше маржа. Дороже — наоборот.</div></div>';
  }

  html += renderStaff(app, u);
  html += '<h3>Управление</h3><div class="card">';
  if (def.retail && !brand) {
    html += renderAds(app, u);
  }
  if (def.production) {
    html += `<div class="row"><span>Сбыт продукции</span><select data-change="setSellMode" data-id="${u.id}">
      <option value="auto" ${u.sellMode === 'auto' ? 'selected' : ''}>Сначала своим, излишки — на рынок</option>
      <option value="all" ${u.sellMode === 'all' ? 'selected' : ''}>Всё на рынок (свои берут, что успеют)</option>
      <option value="hold" ${u.sellMode === 'hold' ? 'selected' : ''}>Только своим, не продавать</option></select></div>`;
  }
  html += row('Аренда', ownerText(app, lot)) + row('Коммунальные', `${money(monthlyUpkeep(state, u))}/мес`);
  const cond = condition(u);
  html += `<div class="row"><span>Состояние оборудования и интерьера</span><b class="${cond < 50 ? 'neg' : cond < 75 ? '' : 'pos'}">${num(cond)}%</b></div>
    <div class="progress ${cond < 50 ? 'bad' : cond < 75 ? 'warn' : ''}"><span style="width:${cond.toFixed(0)}%"></span></div>
    <div class="row"><span class="muted small">Изношенная точка теряет рейтинг, чаще ломается и дороже в обслуживании.${brand?.autoRenew ? ' Сеть обновит её сама при износе 35%.' : ''}</span>
    ${cond <= 95 ? `<button class="mini wide" data-action="renovate" data-id="${u.id}">🛠 Обновить · ${moneyShort(renovateCost(state, u))}</button>` : ''}</div>`;
  html += '</div><div class="btn-row">';
  if (u.level < MAX_LEVEL) {
    const cost = upgradeCost(state, u);
    html += `<button class="btn" data-action="upgrade" data-id="${u.id}" ${app.company.cash < cost ? 'disabled' : ''} title="Больше мощность и выше качество">⬆ Улучшить до ур. ${u.level + 1} · ${moneyShort(cost)}</button>`;
  }
  if (!lot.ownerId) html += lotOwnershipButtons(app, lot);
  html += `<button class="btn ghost" data-action="copySettings" data-id="${u.id}" title="Те же цены (относительно местной нормы), реклама и сбыт">📋 Применить настройки ко всем «${def.name}»</button>`;
  html += `<button class="btn danger" data-action="close" data-id="${u.id}">✖ Закрыть бизнес</button></div>`;

  if (def.storage) html += renderWarehouse(app, u);
  const goods = [...new Set([...Object.keys(u.usage), ...Object.keys(u.inv)])];
  if (goods.length) {
    html += `<h3>${def.storage ? 'Запасы' : 'Склад и поставки'}</h3><table class="tbl compact"><tr><th>Товар</th><th>Запас</th><th>Дней</th><th>В пути</th><th>Откуда</th><th>Цена</th></tr>`;
    const out = def.production?.recipe.output;
    for (const g of goods) {
      const q = invQty(u, g);
      const use = u.usage[g] || 0;
      const days = use > 0 ? q / use : null;
      const src = g === out ? '🏭 выпуск' : SUPPLY_LABEL[u.supplied?.[g]] || '—';
      html += `<tr><td>${goodIcon(g, 'inline')} ${GOODS[g].name}</td><td>${num(q, q < 10 ? 1 : 0)} ${GOODS[g].unit}</td>
        <td class="${days !== null && days < 1 ? 'neg' : ''}">${days === null ? '—' : num(days, 1)}</td>
        <td>${transitText(state, u, g)}</td><td>${src}</td>
        <td>${money(g === out ? sellPrice(state, g, place) : buyPrice(state, g, place, { bulk: !!def.storage }), { cents: true })}</td></tr>`;
    }
    html += `</table><div class="muted small">Закупки идут автоматически: запас на ~${coverDays('flour')} дн. (скоропорт — на ${coverDays('milk')}) плюс дни в пути.
      Сначала со своих производств и складов (если с доставкой дешевле рынка), потом с рынка региона «${MARKET_REGIONS[regionOf(place)].name}».</div>`;
  }
  html += renderContracts(app, u);

  if (u.history.length) html += `<h3>Прибыль по месяцам</h3>${bars(u.history.slice(-12), 300, 48)}`;
  html += plTable(u.month, `Текущий месяц (${u.month.days} дн.)`);
  if (u.last) html += plTable(u.last, 'Прошлый месяц');
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
