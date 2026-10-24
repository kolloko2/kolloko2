import { bizIcon, districtIcon, goodIcon } from './icons.js';
import { BUSINESSES, MAX_LEVEL } from '../data/businesses.js';
import { DISTRICTS, ZONING_NAMES } from '../data/districts.js';
import { COUNTRIES } from '../data/cities.js';
import { GOODS } from '../data/goods.js';
import {
  forecast, buildableTypes, districtShares, refPrice, upgradeCost, monthProfit, monthlyWage, monthlyRent,
  monthlyUpkeep, retailCapacity, productionCapacity, invQty, buyPrice, sellPrice, coverDays, formatDate,
} from '../sim/index.js';
import { money, moneyShort, num, pct, stars, months, esc, signClass, bars } from './format.js';

const CATEGORY_LABEL = { coffee: '☕ Кофе', fastfood: '🌭 Фастфуд', grocery: '🏪 Продукты', bakery: '🥐 Выпечка' };
const SUPPLY_LABEL = { internal: '🔗 свои', market: '💹 рынок', nocash: '⛔ нет денег' };

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
  let html = `<h2>${place.kind === 'city' ? '🏙️' : '🌾'} ${esc(place.name)}</h2>
    <div class="sub">${country.name} · налог на прибыль ${pct(country.tax)}</div><div class="card">`;
  if (place.kind === 'city') {
    html += row('Население', `${num(place.pop, 1)} млн`) + row('Доходы жителей', pct(place.income)) +
      row('Уровень аренды', pct(place.rent)) + row('Уровень зарплат', pct(place.wage));
  } else {
    html += row('Можно выращивать', place.kinds.map((k) => `${bizIcon(k, 'inline')} ${BUSINESSES[k].name}`).join('<br>')) +
      row('Урожайность', pct(place.productivity)) + row('Аренда земли', `${money(place.landRent)}/га в мес`) +
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
    html += '<h3>Спрос в районе</h3><table class="tbl"><tr><th>Категория</th><th>Покупателей/день</th><th>Конкуренты</th></tr>';
    for (const c of cats) {
      const sh = districtShares(state, d, c);
      const owners = Object.keys(sh.byUnit).map((id) => state.units[id].companyId);
      const mine = owners.filter((c) => c === app.companyId).length;
      const rivals = owners.length - mine;
      html += `<tr><td>${CATEGORY_LABEL[c]}</td><td>${num(sh.potential)}</td><td>${sh.ai} ИИ${mine ? ` + ${mine} ваших` : ''}${rivals ? ` + ${rivals} соперников` : ''}</td></tr>`;
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
    const afford = app.company.cash >= f.capex;
    const activity = def.retail
      ? `${num(f.customers)} клиентов/день${f.competitors ? ` · конкурентов: ${f.competitors}` : ''}`
      : `${num(f.produced)} ${GOODS[f.output].unit}/день ${goodIcon(f.output, 'inline')}`;
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
      <button class="btn" data-action="open" data-lot="${lot.id}" data-type="${f.type}" ${afford ? '' : 'disabled'}>
        ${afford ? `Открыть за ${moneyShort(f.capex)}` : `Не хватает ${moneyShort(f.capex - app.company.cash)}`}</button>
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
  const names = { inputs: 'Сырьё и товары', wages: 'Зарплаты', rent: 'Аренда', upkeep: 'Коммунальные и обслуживание', marketing: 'Реклама' };
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
    <div class="sub"><span class="swatch" style="background:${co.color}"></span>Соперник: <b>${esc(co.name)}</b> ·
    <a href="#" data-action="selectDistrict" data-id="${d.id}">${districtTitle(state, d)}</a></div><div class="card">`;
  html += row('Уровень', `${u.level}`);
  if (def.retail) {
    html += row('Рейтинг', `<span class="stars">${stars(u.quality)}</span>`);
    for (const p of def.retail.products) html += row(`Цена: ${p.name}`, `${money(u.prices[p.id], { cents: true })} <small class="muted">(норма ${money(refPrice(place, p), { cents: true })})</small>`);
  }
  html += row('Помещение', ownerText(app, lot)) + '</div>';
  html += lotOwnershipButtons(app, lot);
  return html;
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
      <div class="kpi"><small>Узнаваемость</small><b>${pct(u.awareness)}</b><small>реклама ${money(u.marketing)}/мес</small></div>`;
  }
  if (def.production) {
    const out = GOODS[def.production.recipe.output];
    html += `<div class="kpi"><small>Выпуск сегодня</small><b>${num(t.produced ?? 0)} ${out.unit}</b><small>${goodIcon(def.production.recipe.output, 'inline')} ${out.name} · макс ${num(productionCapacity(state, u))}</small></div>
      <div class="kpi"><small>Цена продажи</small><b>${money(sellPrice(state, def.production.recipe.output), { cents: true })}</b><small>за ${out.unit} на рынке</small></div>`;
  }
  html += '</div>';

  if (def.retail) {
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

  html += `<h3>Управление</h3><div class="card">
    <div class="row"><span>${def.staff.role}: ${u.staff}<small class="muted"> · ${money(monthlyWage(state, u))}/мес каждый</small></span>
      <span class="price-ctl"><button class="mini" data-action="staff" data-id="${u.id}" data-delta="-1">−</button><button class="mini" data-action="staff" data-id="${u.id}" data-delta="1">+</button></span></div>`;
  if (def.retail) {
    html += `<div class="row"><span>Реклама, $/мес</span><span class="price-ctl"><input type="number" step="100" min="0" value="${u.marketing}" data-change="setMarketing" data-id="${u.id}"></span></div>`;
  }
  if (def.production) {
    html += `<div class="row"><span>Сбыт продукции</span><select data-change="setSellMode" data-id="${u.id}">
      <option value="auto" ${u.sellMode === 'auto' ? 'selected' : ''}>Сначала своим, излишки — на рынок</option>
      <option value="all" ${u.sellMode === 'all' ? 'selected' : ''}>Всё на рынок (свои берут, что успеют)</option>
      <option value="hold" ${u.sellMode === 'hold' ? 'selected' : ''}>Только своим, не продавать</option></select></div>`;
  }
  html += row('Аренда', ownerText(app, lot)) + row('Коммунальные', `${money(monthlyUpkeep(state, u))}/мес`);
  html += '</div><div class="btn-row">';
  if (u.level < MAX_LEVEL) {
    const cost = upgradeCost(state, u);
    html += `<button class="btn" data-action="upgrade" data-id="${u.id}" ${app.company.cash < cost ? 'disabled' : ''} title="Больше мощность и выше качество">⬆ Улучшить до ур. ${u.level + 1} · ${moneyShort(cost)}</button>`;
  }
  if (!lot.ownerId) html += lotOwnershipButtons(app, lot);
  html += `<button class="btn ghost" data-action="copySettings" data-id="${u.id}" title="Те же цены (относительно местной нормы), реклама и сбыт">📋 Применить настройки ко всем «${def.name}»</button>`;
  html += `<button class="btn danger" data-action="close" data-id="${u.id}">✖ Закрыть бизнес</button></div>`;

  const goods = [...new Set([...Object.keys(u.usage), ...Object.keys(u.inv)])];
  if (goods.length) {
    html += '<h3>Склад и поставки</h3><table class="tbl"><tr><th>Товар</th><th>Запас</th><th>Дней</th><th>Откуда</th><th>Цена</th></tr>';
    const out = def.production?.recipe.output;
    for (const g of goods) {
      const q = invQty(u, g);
      const use = u.usage[g] || 0;
      const days = use > 0 ? q / use : null;
      const src = g === out ? '🏭 своё производство' : SUPPLY_LABEL[u.supplied?.[g]] || '—';
      html += `<tr><td>${goodIcon(g, 'inline')} ${GOODS[g].name}</td><td>${num(q, q < 10 ? 1 : 0)} ${GOODS[g].unit}</td>
        <td class="${days !== null && days < 1 ? 'neg' : ''}">${days === null ? '—' : num(days, 1)}</td><td>${src}</td>
        <td>${money(g === out ? sellPrice(state, g) : buyPrice(state, g, place), { cents: true })}</td></tr>`;
    }
    html += `</table><div class="muted small">Закупки идут автоматически: запас на ~${coverDays('flour')} дн. (скоропорт — на ${coverDays('milk')}). Сначала со своих производств, потом с рынка.</div>`;
  }

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
