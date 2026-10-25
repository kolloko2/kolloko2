import { bizIcon, goodIcon } from './icons.js';
import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { GOODS } from '../data/goods.js';
import { MARKET_REGIONS } from '../data/regions.js';
import { COUNTRIES, BLOCS } from '../data/cities.js';
import { LICENSES } from '../data/laws.js';
import { TECHS, BRANCHES, STAT_EFFECTS } from '../data/tech.js';
import { AD_CHANNELS } from '../data/ads.js';
import {
  ARCHETYPES, truceCost, TRUCE_MONTHS, offerText, techLevel, hasTech, techCost, techLocked, researchSpeed, lobbyCost, lobbyChance, employees, taxBreak,
  LOBBY_GOALS, LOBBY_COOLDOWN, BIG_EMPLOYER, loanRate,
  companyAlerts, ALERT_KINDS, directorCost, condition, companyReport, defaultRules,
  overhead, countryState, franchiseCount, franchiseAppeal, packageCost, ROYALTIES, FRANCHISE_MIN_UNITS,
  listingOf, controllerOf, stakeOf, ipoCheck, absorbCost, portfolioValue, fairCompanyPrice,
  IPO_MIN_WORTH, IPO_MIN_MONTHS, ABSORB_SHARE, CONTROL_SHARE, TRADE_FEE,
  BRAND_TIERS, brandAwareness, WAGE_LEVELS, presenceByCountry, hasLocalTeam, purchasingDiscount, LOCAL_TEAM_UNITS,
  regionOf, midPrice, buyPrice, sellPrice, monthProfit, netWorth, loanLimit, formatDate, newsFor, companyUnits, GOALS, goalContext, victoryText,
  recipeOf,
} from '../sim/index.js';
import { SPEEDS } from '../net/session.js';
import { tabHint } from './tutorial.js';
import { money, moneyShort, num, pct, stars, esc, signClass, sparkline, bars, lineChart } from './format.js';

export const TABS = [
  { id: 'units', icon: '🏢', img: 'city', name: 'Бизнесы' },
  { id: 'tasks', icon: '⚠️', img: 'tasks', name: 'Задачи' },
  { id: 'search', icon: '🔍', img: 'search', name: 'Поиск мест' },
  { id: 'market', icon: '💹', img: 'market', name: 'Рынок' },
  { id: 'finance', icon: '🏦', img: 'finance', name: 'Финансы' },
  { id: 'news', icon: '📰', img: 'news', name: 'Новости' },
  { id: 'brands', icon: '🏷️', img: 'franchise', name: 'Сети' },
  { id: 'countries', icon: '🌍', img: 'globe', name: 'Страны' },
  { id: 'stocks', icon: '📈', img: 'stocks', name: 'Биржа' },
  { id: 'rivals', icon: '🦈', img: 'rivals', name: 'Соперники' },
  { id: 'research', icon: '🔬', img: 'research', name: 'Исследования' },
  { id: 'goals', icon: '🏆', img: 'capital', name: 'Цели' },
  { id: 'room', icon: '👥', img: 'loan', name: 'Игроки' },
  { id: 'help', icon: '❓', img: 'help', name: 'Как играть' },
];

// Фильтр списка бизнесов (страна, тип) — к нему применяются массовые действия
export function filteredUnits(app) {
  const f = app.unitFilter || {};
  return companyUnits(app.state, app.companyId).filter((u) => (!f.country || app.state.world.places[u.placeId].country === f.country) && (!f.type || u.type === f.type));
}

function renderUnits(app) {
  const { state } = app;
  const all = companyUnits(state, app.companyId);
  if (!all.length) {
    return '<h2>🏢 Бизнесы</h2><p class="muted">Пока ничего нет. Выберите город на карте, приблизьтесь к району и нажмите на свободный участок 🏬.</p>';
  }
  const f = app.unitFilter || {};
  const countries = [...new Set(all.map((u) => state.world.places[u.placeId].country))];
  const types = [...new Set(all.map((u) => u.type))];
  const units = filteredUnits(app);
  let html = `<h2>🏢 Бизнесы</h2><div class="filters">
    <select data-change="unitFilter" data-key="country"><option value="">Все страны</option>${countries.map((c) => `<option value="${c}" ${f.country === c ? 'selected' : ''}>${COUNTRIES[c].name}</option>`).join('')}</select>
    <select data-change="unitFilter" data-key="type"><option value="">Все типы</option>${types.map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${BUSINESSES[t].name}</option>`).join('')}</select></div>
    <div class="card"><div class="muted small">Массовые действия для ${units.length} бизнесов в списке:</div><div class="btn-row">
    <button class="mini wide" data-action="bulk" data-op="renovate">🛠 Обновить изношенные</button>
    <span class="price-ctl"><input id="bulk-ratio" type="number" min="50" max="200" step="5" value="100">%</span><button class="mini wide" data-action="bulk" data-op="priceNorm">🏷️ Цены → % нормы</button>
    <button class="mini wide" data-action="bulk" data-op="fitStaff">👥 Штат под спрос</button>
    <button class="mini wide" data-action="bulk" data-op="hireManager">👔 Управляющих всем</button></div></div>`;
  let total = 0;
  html += '<table class="tbl hover"><tr><th></th><th>Название</th><th>Сегодня</th><th>Сост.</th><th>Прошлый мес.</th></tr>';
  for (const u of units) {
    const def = BUSINESSES[u.type];
    const place = state.world.places[u.placeId];
    const t = u.today || {};
    const profit = u.last ? monthProfit(u.last) : null;
    if (profit !== null) total += profit;
    const warn = (u.broken > 0 || t.stockout || t.inputShort ? ' ⚠️' : '') + ((u.morale ?? 65) < 35 ? ' 😠' : '') + (u.manager ? ' 👔' : '');
    let today = 'склад';
    if (def.retail) today = `${num(t.customers ?? 0)} кл.<br><small class="stars">${stars(u.quality)}</small>`;
    else if (def.production) today = `${num(t.produced ?? 0)} ${GOODS[recipeOf(u).output].unit}`;
    else if (def.service) today = moneyShort(t.revenue ?? 0);
    const cond = condition(u);
    html += `<tr data-action="selectUnit" data-fly="1" data-id="${u.id}"><td>${bizIcon(u.type, 'row')}</td><td>${esc(u.name)}${warn}<small class="muted"><br>${esc(place.name)}</small></td>
      <td>${today}</td><td class="${cond < 60 ? 'neg' : ''}">${num(cond)}%</td>
      <td class="${signClass(profit ?? 0)}">${profit === null ? '—' : moneyShort(profit)}</td></tr>`;
  }
  html += `<tr class="total"><td></td><td>Итого (${units.length})</td><td></td><td></td><td class="${signClass(total)}">${moneyShort(total)}</td></tr></table>`;
  return html;
}

// Поиск мест: лучшие участки для выбранного бизнеса (считается по кнопке — это долго)
// Группы в списке типов бизнеса: так длинный список легче листать
const SEARCH_GROUPS = [
  ['Магазины и общепит', (d) => Boolean(d.retail)],
  ['Услуги и недвижимость', (d) => !d.retail && Boolean(d.service)],
  ['Сырьё: земля и недра', (d) => !d.retail && ['farm', 'mining', 'oil'].includes(d.category)],
  ['Заводы и фабрики', (d) => !d.retail && !d.service && !['farm', 'mining', 'oil'].includes(d.category)],
];

function renderSearch(app) {
  const { state } = app;
  const q = app.search || { type: 'coffee_shop', country: '' };
  const types = Object.entries(BUSINESSES).filter(([, d]) => !d.storage);
  let html = `<h2>🔍 Поиск мест</h2><p class="muted small">Лучшие свободные участки по окупаемости для выбранного бизнеса. Прогноз — примерный: учтены спрос, конкуренты, аренда, сборы и лицензии.</p>
    <div class="filters"><select id="search-type">${SEARCH_GROUPS.map(([name, test]) => `<optgroup label="${name}">${types.filter(([, d]) => test(d))
      .map(([id, d]) => `<option value="${id}" ${q.type === id ? 'selected' : ''}>${d.icon} ${d.name}</option>`).join('')}</optgroup>`).join('')}</select>
    <select id="search-country"><option value="">Весь мир</option>${Object.entries(COUNTRIES).sort((a, z) => a[1].name.localeCompare(z[1].name, 'ru')).map(([c, d]) => `<option value="${c}" ${q.country === c ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>
    <button class="btn" data-action="search">Найти</button>`;
  const res = app.searchResults;
  if (!res) return html;
  if (!res.length) return `${html}<p class="muted">Подходящих мест с прибылью не нашлось.</p>`;
  html += '<table class="tbl hover compact"><tr><th>Где</th><th>Прибыль/мес</th><th>Окупаемость</th><th>Вложения</th></tr>';
  for (const r of res) {
    const d = state.world.districts[r.districtId];
    html += `<tr data-action="selectLot" data-id="${r.lotId}"><td>${esc(state.world.places[r.placeId].name)}<small class="muted"><br>${esc(DISTRICTS[d.type].name)}</small></td>
      <td class="pos">${moneyShort(r.profit)}</td><td>${r.payback < 1000 ? `${Math.round(r.payback)} мес.` : '—'}</td><td>${moneyShort(r.cost)}${r.locked ? ' 🔬' : ''}</td></tr>`;
  }
  return `${html}</table>`;
}

// Задачи: что требует внимания, с исправлением в один клик
function renderTasks(app) {
  const { state } = app;
  const alerts = companyAlerts(state, app.companyId);
  let html = `<h2>⚠️ Задачи</h2><p class="muted small">Всё, что сейчас теряет вам деньги. Исправляйте по одной или всё сразу.
    Чтобы задач было меньше, наймите региональных директоров (вкладка 🌍 «Страны») — они сами следят за штатом, ценами и износом.</p>`;
  if (!alerts.length) return `${html}<div class="card">✓ Всё в порядке.</div>`;
  for (const [kind, k] of Object.entries(ALERT_KINDS)) {
    const list = alerts.filter((a) => a.kind === kind);
    if (!list.length) continue;
    const cost = list.reduce((s, a) => s + (a.cost || 0), 0);
    const ids = list.map((a) => a.unitId).join(',');
    html += `<div class="card"><div class="row"><b>${k.icon} ${k.title}: ${list.length}</b>
      ${k.fix ? `<button class="mini wide" data-action="bulk" data-op="${k.fix}" data-ids="${ids}">${k.fixName} все${cost ? ` · ${moneyShort(cost)}` : ''}</button>` : ''}</div>
      <table class="tbl compact">${list.slice(0, 40).map((a) => {
        const u = state.units[a.unitId];
        return `<tr><td><a href="#" data-action="selectUnit" data-fly="1" data-id="${a.unitId}">${esc(u?.name ?? '—')}</a><small class="muted"> · ${esc(u ? state.world.places[u.placeId].name : '')}</small></td>
          <td>${esc(a.text)}</td><td>${k.fix ? `<button class="mini wide" data-action="bulk" data-op="${k.fix}" data-ids="${a.unitId}">${k.fixName}${a.cost ? ` · ${moneyShort(a.cost)}` : ''}</button>` : ''}</td></tr>`;
      }).join('')}</table>${list.length > 40 ? `<div class="muted small">…и ещё ${list.length - 40}</div>` : ''}</div>`;
  }
  return html;
}

// Региональные директора: автопилот по стране
function renderDirectors(app) {
  const { state } = app;
  const co = app.company;
  const pres = presenceByCountry(state, app.companyId);
  const list = Object.keys(pres);
  if (!list.length) return '';
  let html = `<h3>👔 Региональные директора</h3><div class="muted small">Директор следит за всеми вашими бизнесами в стране: раз в неделю подгоняет штат под спрос,
    раз в месяц поднимает цены отдельных точек вслед за инфляцией и обновляет изношенные (если в кассе хватает денег).
    Точки под его присмотром почти не требуют вашего внимания.</div>`;
  for (const c of list) {
    const d = co.directors?.[c];
    html += `<div class="card"><div class="row"><b>${COUNTRIES[c].name}</b> <small class="muted">${pres[c].any} бизнесов</small>
      ${d ? `<button class="mini wide" data-action="fireDirector" data-country="${c}">Уволить</button>` : `<button class="mini wide" data-action="hireDirector" data-country="${c}">Нанять · ${moneyShort(directorCost(state, c))}/мес</button>`}</div>`;
    if (d) {
      html += `<label class="row check"><span>👥 Штат под спрос</span><input type="checkbox" data-change="director" data-country="${c}" data-key="staff" ${d.staff ? 'checked' : ''}></label>
        <label class="row check"><span>🛠 Обновлять изношенные точки</span><input type="checkbox" data-change="director" data-country="${c}" data-key="renovate" ${d.renovate ? 'checked' : ''}></label>
        <label class="row check"><span>🏷️ Держать цены отдельных точек на уровне</span><input type="checkbox" data-change="director" data-country="${c}" data-key="prices" ${d.prices ? 'checked' : ''}></label>
        <div class="row"><span>…% от местной нормы</span><span class="price-ctl"><input type="number" min="70" max="150" step="5" value="${Math.round(d.priceRatio * 100)}" data-change="directorRatio" data-country="${c}"></span></div>`;
    }
    html += '</div>';
  }
  return html;
}

function defaultRegion(app) {
  const u = companyUnits(app.state, app.companyId)[0];
  return u ? regionOf(app.state.world.places[u.placeId]) : 'eu';
}

function renderMarket(app) {
  const { state } = app;
  const region = app.marketRegion || defaultRegion(app);
  let html = `<h2>💹 Товарные рынки</h2><p class="muted small">У каждого региона свои цены: где товар производят — дешевле, где ввозят — дороже.
    Ваши бизнесы покупают и продают на рынке своего региона. Крупные объёмы двигают цену. Закупка дороже на 7% (склады — 3%), продажа дешевле на 8%.</p>
    <div class="chips">${Object.entries(MARKET_REGIONS).map(([id, r]) => `<button class="chip ${id === region ? 'active' : ''}" data-action="marketRegion" data-region="${id}">${r.name}</button>`).join('')}</div>`;
  html += '<table class="tbl"><tr><th>Товар</th><th>Купить</th><th>Продать</th><th>Дешевле всего</th><th>Тренд</th></tr>';
  for (const [g, m] of Object.entries(state.market.goods)) {
    const def = GOODS[g];
    const now = midPrice(state, g, region);
    const hist = m.regions[region].hist.length > 1 ? m.regions[region].hist : m.hist;
    const prev = hist.length > 4 ? hist[hist.length - 5] : hist[0];
    const ch = now / prev - 1;
    const cheapest = Object.keys(MARKET_REGIONS).reduce((a, b) => (midPrice(state, g, a) <= midPrice(state, g, b) ? a : b));
    const shock = m.shockDays > 0 ? ` <span class="tag ${m.shock > 1 ? 'bad' : 'good'}" title="Осталось ${m.shockDays} дн.">${m.shock > 1 ? '▲ шок' : '▼ избыток'}</span>` : '';
    const mid = now * (1 + 0.07);
    const sell = now * (1 - 0.08);
    html += `<tr><td>${goodIcon(g, 'inline')} ${def.name}${shock}<small class="muted"><br>за ${def.unit}${def.local ? ', цена зависит от города' : ''}</small></td>
      <td>${money(mid, { cents: true })}</td><td>${money(sell, { cents: true })}</td>
      <td>${cheapest === region ? '<small class="pos">здесь</small>' : `<small>${MARKET_REGIONS[cheapest].name}<br>${money(midPrice(state, g, cheapest), { cents: true })}</small>`}</td>
      <td>${sparkline(hist, 70, 22)}<br><small class="muted">${ch >= 0 ? '▲ +' : '▼ '}${pct(ch, 1)} за 4 нед.</small></td></tr>`;
  }
  return `${html}</table>`;
}

function renderFinance(app) {
  const { state } = app;
  const co = app.company;
  const limit = loanLimit(state, app.companyId);
  const h = co.history.slice(-12).reverse();
  let html = `<h2>🏦 Финансы</h2><div class="card">
    ${row('Касса', money(co.cash), signClass(co.cash))}
    ${row('Капитал (активы − долг)', money(netWorth(state, app.companyId)))}
    ${row('Кредит', `${money(co.loan)} под ${pct(loanRate(state, app.companyId))} годовых`)}
    ${row('Банк готов выдать ещё', money(Math.max(0, limit - co.loan)))}
    ${row('Расходы штаба', `${money(overhead(state, app.companyId))}/мес`)}
    </div>
    <div class="muted small">Штаб (бухгалтерия, юристы, закупки) дорожает быстрее, чем растёт число бизнесов: огромная сеть мелких точек себя не окупает.
    Точки в сетях обходятся штабу дешевле, франчайзи — бесплатно. Цены и зарплаты каждый год растут на инфляцию — следите за ценами отдельных точек.</div>
    <div class="card"><div class="row"><span>Сумма</span><span class="price-ctl"><input id="loan-amount" type="number" step="5000" min="0" value="10000"></span></div>
    <div class="btn-row"><button class="btn" data-action="takeLoan">Взять кредит</button><button class="btn ghost" data-action="repayLoan">Погасить</button></div>
    <div class="muted small">Лимит растёт с прибылью и стоимостью ваших бизнесов и недвижимости. Если касса в минусе 45 дней — банкротство.</div></div>`;
  html += renderRules(app) + renderReport(app) + renderPresence(app);
  if (h.length) {
    const hist = co.history.slice(-36);
    html += `<h3>Капитал и касса</h3>${lineChart([
      { values: hist.map((m) => m.netWorth), color: '#2f6fed', label: 'Капитал' },
      { values: hist.map((m) => m.cash), color: '#1e8e4e', label: 'Касса' },
    ])}
      <h3>Выручка и прибыль</h3>${lineChart([
      { values: hist.map((m) => m.revenue), color: '#e8590c', label: 'Выручка' },
      { values: hist.map((m) => m.profit), color: '#ae3ec9', label: 'Прибыль' },
    ])}
      <table class="tbl"><tr><th>Месяц</th><th>Выручка</th><th>Прибыль</th><th>Налог</th><th>Проценты</th><th>Роялти и дивиденды</th><th>Касса</th></tr>`;
    for (const m of h) {
      html += `<tr><td>${m.label}</td><td>${moneyShort(m.revenue)}</td><td class="${signClass(m.profit)}">${moneyShort(m.profit)}</td>
        <td>${moneyShort(m.tax)}</td><td>${moneyShort(m.interest)}</td><td>${moneyShort((m.royalty || 0) + (m.dividendsIn || 0))}</td><td>${moneyShort(m.cash)}</td></tr>`;
    }
    html += '</table>';
  } else {
    html += '<p class="muted">Отчёт появится в конце первого месяца.</p>';
  }
  return html;
}

function row(label, value, cls = '') {
  return `<div class="row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
}

function renderNews(app) {
  const { state } = app;
  const news = newsFor(state, app.companyId);
  if (!news.length) return '<h2>📰 Новости</h2><p class="muted">Пока тихо.</p>';
  let html = '<h2>📰 Новости</h2><div class="news">';
  for (const n of news.slice(0, 80)) {
    const action = n.ref?.unitId && state.units[n.ref.unitId] ? `data-action="selectUnit" data-fly="1" data-id="${n.ref.unitId}"` : '';
    html += `<div class="news-item ${n.kind}" ${action}><small>${formatDate(n.day)}</small>${esc(n.text)}</div>`;
  }
  return `${html}</div>`;
}

function renderRoom(app) {
  const { state, session } = app;
  if (!session.multiplayer) return '<h2>👥 Игроки</h2><p class="muted">Это одиночная игра. Чтобы играть с друзьями, выйдите в меню (🚪) и создайте комнату.</p>';
  const coop = session.mode === 'coop';
  let html = `<h2>👥 ${coop ? 'Кооператив' : 'Против друзей'}</h2>
    <div class="card"><div class="row"><span>Код комнаты</span><span class="code-big">${esc(session.code)}</span></div>
    <div class="muted small">Друзья открывают этот же адрес игры, выбирают «Войти по коду» и вводят код.</div>
    <button class="btn ghost" data-action="copyCode">📋 Скопировать код</button></div>`;
  html += '<h3>Игроки</h3><div class="card">';
  for (const p of session.players) {
    const co = state.companies[p.companyId];
    const vote = coop ? '' : ` · голос: ${SPEEDS[p.speed]?.icon ?? '?'}`;
    html += `<div class="player-row"><span class="dot ${p.online ? 'on' : ''}"></span><b>${esc(p.name)}</b>
      <small class="muted">${p.id === session.playerId ? '(вы) ' : ''}${coop ? '' : `<span class="swatch" style="background:${co?.color}"></span>${esc(co?.name ?? '')}`}${vote}</small></div>`;
  }
  html += `</div>${coop ? '' : '<div class="muted small">Время идёт со скоростью самого медленного голоса: пауза одного игрока ставит игру на паузу.</div>'}`;
  if (!coop) {
    const ranking = Object.values(state.companies).map((c) => ({ c, worth: netWorth(state, c.id), n: companyUnits(state, c.id).length }))
      .sort((a, b) => b.worth - a.worth);
    html += '<h3>Рейтинг компаний</h3><table class="tbl"><tr><th>#</th><th>Компания</th><th>Бизнесов</th><th>Капитал</th></tr>';
    ranking.forEach(({ c, worth, n }, i) => {
      html += `<tr><td>${i + 1}</td><td><span class="swatch" style="background:${c.color}"></span>${esc(c.name)}${c.bankrupt ? ' 💀' : ''}</td><td>${n}</td><td>${moneyShort(worth)}</td></tr>`;
    });
    html += '</table>';
    html += `<div class="muted small">Цель: ${victoryText(state.victory)}</div>`;
    const companies = Object.values(state.companies);
    if (companies.some((c) => c.history.length > 1)) {
      html += `<h3>Капитал по месяцам</h3>${lineChart(companies.map((c) => ({ values: c.history.slice(-36).map((m) => m.netWorth), color: c.color, label: esc(c.name) })))}`;
    }
  }
  html += '<h3>Чат</h3><div class="chat" id="chat-log">';
  if (!app.chat.length) html += '<span class="muted small">Сообщений пока нет.</span>';
  for (const m of app.chat) html += `<div class="chat-msg"><b style="color:${m.color || 'inherit'}">${esc(m.from)}:</b>${esc(m.text)}</div>`;
  html += '</div><form id="chat-form"><input maxlength="300" placeholder="Сообщение…" autocomplete="off"><button class="btn" type="submit">➤</button></form>';
  return html;
}

// Автопилот компании
function renderRules(app) {
  const r = app.company.rules || defaultRules();
  return `<h3>🤖 Автопилот</h3><div class="card">
    <div class="row"><span>Держать в кассе не меньше, $</span><span class="price-ctl"><input type="number" min="0" step="10000" value="${r.reserve}" data-change="rules" data-key="reserve"></span></div>
    <label class="row check"><span>Гасить кредит всем, что выше резерва</span><input type="checkbox" data-change="rules" data-key="autoRepay" ${r.autoRepay ? 'checked' : ''}></label>
    <label class="row check"><span>Обновлять изношенные точки (если касса выше резерва)</span><input type="checkbox" data-change="rules" data-key="autoRenovate" ${r.autoRenovate ? 'checked' : ''}></label>
    <div class="row"><span>Закрывать точку после убытка</span><select data-change="rules" data-key="closeAfter">${[0, 3, 6, 12].map((m) => `<option value="${m}" ${r.closeAfter === m ? 'selected' : ''}>${m ? `${m} мес. подряд` : 'никогда'}</option>`).join('')}</select></div>
    <div class="muted small">Правила срабатывают в конце каждого месяца.</div></div>`;
}

// Отчёты: где компания зарабатывает и где теряет
function renderReport(app) {
  const { state } = app;
  const rep = companyReport(state, app.companyId);
  const table = (title, groups, name) => {
    const rows = Object.entries(groups).sort((a, b) => b[1].profit - a[1].profit);
    if (!rows.length) return '';
    return `<h3>${title}</h3><table class="tbl compact"><tr><th></th><th>Точек</th><th>Выручка</th><th>Прибыль</th><th>На точку</th></tr>${rows.map(([k, g]) => `<tr><td>${esc(name(k))}</td><td>${g.n}</td><td>${moneyShort(g.revenue)}</td>
      <td class="${signClass(g.profit)}">${moneyShort(g.profit)}</td><td class="${signClass(g.profit)}">${moneyShort(g.profit / g.n)}</td></tr>`).join('')}</table>`;
  };
  const list = (title, items) => (items.length ? `<h3>${title}</h3><div class="list">${items.map((x) => {
    const u = state.units[x.id];
    return `<button class="list-item" data-action="selectUnit" data-fly="1" data-id="${x.id}"><span class="li-icon">${bizIcon(u.type)}</span><span class="li-main">${esc(u.name)}<small>${esc(state.world.places[u.placeId].name)} · <span class="${signClass(x.profit)}">${moneyShort(x.profit)}</span></small></span></button>`;
  }).join('')}</div>` : '');
  return table('📊 Прибыль по странам (прошлый месяц)', rep.country, (c) => COUNTRIES[c].name)
    + table('По сетям', rep.brand, (b) => b)
    + table('По типам бизнеса', rep.type, (t) => BUSINESSES[t].name)
    + list('🏆 Лучшие точки', rep.best.filter((x) => x.profit > 0))
    + list('🕳 Худшие точки', rep.worst.filter((x) => x.profit < 0));
}

// Где работает компания: домашняя страна, местные команды, оптовые скидки
function renderPresence(app) {
  const { state } = app;
  const co = app.company;
  const pres = presenceByCountry(state, app.companyId);
  const list = Object.entries(pres);
  if (!list.length) return '';
  let html = `<h3>Присутствие по странам</h3><table class="tbl compact"><tr><th>Страна</th><th>Точек</th><th>Команда</th><th>Опт. скидка</th></tr>`;
  for (const [c, n] of list) {
    const place = Object.values(state.world.places).find((p) => p.country === c);
    const team = c === co.homeCountry ? '🏠 домашняя' : hasLocalTeam(state, app.companyId, c) ? '✓ своя' : `нет (${n.consumer}/${LOCAL_TEAM_UNITS}) · +10%`;
    html += `<tr><td>${COUNTRIES[c].name}</td><td>${n.any}</td><td>${team}</td><td>${pct(purchasingDiscount(state, app.companyId, place))}</td></tr>`;
  }
  return `${html}</table><div class="muted small">В новой стране — разовый сбор за выход на рынок и +10% к зарплатам и содержанию точек, пока их меньше ${LOCAL_TEAM_UNITS}.
    Чем больше точек в регионе, тем больше оптовая скидка у поставщиков. Сырьё и производство продаются на весь мир без надбавок.</div>`;
}

function renderBrands(app) {
  const { state } = app;
  const brands = Object.values(state.brands).filter((b) => b.companyId === app.companyId);
  const mine = companyUnits(state, app.companyId);
  let html = `<h2>🏷️ Сети</h2><p class="muted small">Объедините точки одного типа в сеть: общие цены (в % от местной нормы — сами подстраиваются под город),
    реклама и зарплаты. Точки одной сети в городе поднимают узнаваемость бренда друг другу — сеть получает больше клиентов, чем отдельные точки.
    Сделайте эконом-сеть для спальных районов и премиум-сеть для центра.</p>`;
  for (const b of brands) {
    const def = BUSINESSES[b.type];
    const units = mine.filter((u) => u.brandId === b.id);
    const cities = [...new Set(units.map((u) => u.placeId))];
    const countries = [...new Set(units.map((u) => state.world.places[u.placeId].country))];
    html += `<div class="card brand"><div class="row"><span>${bizIcon(b.type, 'inline')} <b>${esc(b.name)}</b> <small class="muted">${def.name} · ${units.length} точек</small></span>
      <span class="chips tight">${Object.entries(BRAND_TIERS).map(([id, t]) => `<button class="chip ${b.tier === id ? 'active' : ''}" data-action="brandTier" data-id="${b.id}" data-tier="${id}">${t.name}</button>`).join('')}</span></div>`;
    for (const p of def.retail.products) {
      const r = b.priceRatio[p.id] ?? 1;
      html += `<div class="row"><span>${p.name}: <b>${Math.round(r * 100)}%</b> от местной нормы</span>
        <span class="price-ctl"><button class="mini" data-action="brandPrice" data-id="${b.id}" data-product="${p.id}" data-step="-0.05">−</button>
        <button class="mini" data-action="brandPrice" data-id="${b.id}" data-product="${p.id}" data-step="0.05">+</button></span></div>`;
    }
    html += `<div class="muted small">Реклама на каждую точку, $/мес при уровне цен 1 (в дорогих городах больше):</div>
      ${Object.entries(AD_CHANNELS).map(([ch, c]) => `<div class="row"><span title="${esc(c.desc)}">${c.icon} ${c.name}</span><span class="price-ctl"><input type="number" min="0" step="50" value="${b.ads?.[ch] || 0}" data-change="brandAds" data-id="${b.id}" data-channel="${ch}"></span></div>`).join('')}
      <label class="row check"><span>🛠 Автообновление: сеть сама ремонтирует точки при износе 35% (если в кассе есть деньги)</span><input type="checkbox" data-change="setAutoRenew" data-id="${b.id}" ${b.autoRenew ? 'checked' : ''}></label>
      <div class="row"><span>Зарплаты</span><span class="chips tight">${WAGE_LEVELS.map((l) => `<button class="chip ${b.wageLevel === l ? 'active' : ''}" data-action="brandWage" data-id="${b.id}" data-level="${l}">${Math.round(l * 100)}%</button>`).join('')}</span></div>`;
    if (cities.length) {
      html += '<table class="tbl compact"><tr><th>Город</th><th>Точек</th><th>Узнаваемость бренда</th></tr>';
      for (const pid of cities) {
        const n = units.filter((u) => u.placeId === pid).length;
        html += `<tr><td>${esc(state.world.places[pid].name)}</td><td>${n}</td><td>${pct(brandAwareness(b, pid))}</td></tr>`;
      }
      html += '</table>';
    }
    for (const c of countries) {
      html += `<div class="row"><span>📺 ТВ-реклама по стране: ${COUNTRIES[c].name}, $/мес</span><span class="price-ctl"><input type="number" min="0" step="1000" value="${b.national[c] || 0}" data-change="brandNational" data-id="${b.id}" data-country="${c}"></span></div>`;
    }
    html += renderFranchise(app, b, units.length);
    const free = mine.filter((u) => u.type === b.type && u.brandId !== b.id);
    html += `<div class="btn-row">${free.length ? `<button class="btn ghost" data-action="brandAddAll" data-id="${b.id}">➕ Добавить мои «${def.name}» (${free.length})</button>` : ''}
      <button class="btn danger" data-action="deleteBrand" data-id="${b.id}">Распустить сеть</button></div></div>`;
  }
  const retailTypes = Object.entries(BUSINESSES).filter(([, d]) => d.retail);
  html += `<h3>Новая сеть</h3><div class="card"><div class="row"><span>Название</span><span class="price-ctl"><input id="brand-name" maxlength="30" placeholder="Например, Bean Express" style="width:180px;text-align:left"></span></div>
    <div class="row"><span>Тип точек</span><select id="brand-type">${retailTypes.map(([id, d]) => `<option value="${id}">${d.name}</option>`).join('')}</select></div>
    <div class="row"><span>Позиционирование</span><select id="brand-tier">${Object.entries(BRAND_TIERS).map(([id, t]) => `<option value="${id}" ${id === 'std' ? 'selected' : ''}>${t.name} — цены ${Math.round(t.price * 100)}%${t.quality ? `, качество ${t.quality > 0 ? '+' : ''}${t.quality}` : ''}</option>`).join('')}</select></div>
    <label class="row check"><span>Сразу включить мои точки этого типа, которые не в сети</span><input id="brand-all" type="checkbox" checked></label>
    <button class="btn" data-action="createBrand">Создать сеть</button></div>`;
  return html;
}

// Франшиза сети: страны продаж, роялти, франчайзи
function renderFranchise(app, b, ownCount) {
  const { state } = app;
  const fr = b.franchise || {};
  const total = franchiseCount(b);
  let html = `<h3>🤝 Франшиза</h3>`;
  if (ownCount < FRANCHISE_MIN_UNITS && !Object.keys(fr).length) {
    return `${html}<div class="muted small">Франшизу можно продавать, когда у сети будет ${FRANCHISE_MIN_UNITS} свои точки (сейчас ${ownCount}).
      Франчайзи сами открывают точки под вашей маркой в выбранных странах, платят взнос и роялти с выручки — без сбора за выход на рынок и своей команды.</div>`;
  }
  html += `<div class="row"><span>Роялти с выручки франчайзи</span><span class="chips tight">${ROYALTIES.map((r) => `<button class="chip ${b.royalty === r ? 'active' : ''}" data-action="setRoyalty" data-id="${b.id}" data-royalty="${r}">${Math.round(r * 100)}%</button>`).join('')}</span></div>
    <div class="muted small">Чем выше роялти, тем меньше желающих и тем чаще франчайзи закрываются. Франчайзи поднимают узнаваемость бренда и вашим точкам.</div>`;
  if (Object.keys(fr).length) {
    html += '<table class="tbl compact"><tr><th>Страна</th><th>Франчайзи</th><th>Шанс нового в месяц</th><th></th></tr>';
    for (const c of Object.keys(fr)) {
      const n = Object.entries(b.franchisees || {}).filter(([pid]) => state.world.places[pid].country === c).reduce((s, [, k]) => s + k, 0);
      html += `<tr><td>${COUNTRIES[c].name}</td><td>${n}</td><td>${ownCount >= FRANCHISE_MIN_UNITS ? pct(franchiseAppeal(state, b, c)) : 'нужно 3 свои точки'}</td>
        <td><button class="mini wide" data-action="closeFranchise" data-id="${b.id}" data-country="${c}">Закрыть</button></td></tr>`;
    }
    html += `</table><div class="muted small">Всего франчайзи: ${total}. Роялти за прошлый месяц: ${money(b.lastRoyalty || 0)}.</div>`;
  }
  const options = Object.keys(COUNTRIES).filter((c) => !fr[c]).sort((a, z) => COUNTRIES[a].name.localeCompare(COUNTRIES[z].name, 'ru'));
  html += `<div class="row"><select id="fr-country-${b.id}">${options.map((c) => `<option value="${c}">${COUNTRIES[c].name} — ${moneyShort(packageCost(c))}</option>`).join('')}</select>
    <button class="mini wide" data-action="openFranchise" data-id="${b.id}">Продавать франшизу</button></div>`;
  return html;
}

// Страны: законы, налоги, пошлины и состояние экономики
function renderCountries(app) {
  const { state } = app;
  const co = app.company;
  const pres = presenceByCountry(state, app.companyId);
  let html = `<h2>🌍 Страны</h2><p class="muted small">У каждой страны свои законы. <b>Налог на прибыль</b> берётся с прибыли ваших бизнесов в стране.
    <b>Пошлина</b> — когда вы везёте свой товар из другой страны (внутри торгового союза — бесплатно), поэтому завод часто выгоднее строить там же, где продаёте.
    <b>Бюрократия</b> делает дороже лицензии и выход на рынок. В <b>нестабильных</b> странах чаще кризисы и смена законов.</p>
    <table class="tbl compact"><tr><th>Страна</th><th>Налог</th><th>Пошлина</th><th>Бюрокр.</th><th>Инфляция</th><th>Стабильность</th><th>Экономика</th><th>Ваши точки</th></tr>`;
  const list = Object.keys(COUNTRIES).sort((a, z) => (pres[z]?.any || 0) - (pres[a]?.any || 0) || COUNTRIES[a].name.localeCompare(COUNTRIES[z].name, 'ru'));
  for (const c of list) {
    const d = COUNTRIES[c];
    const cs = countryState(state, c);
    const econ = cs.demand < 1 ? `<span class="tag bad">спад ${pct(cs.demand - 1)}</span>` : cs.demand > 1 ? `<span class="tag good">подъём +${pct(cs.demand - 1)}</span>` : '<small class="muted">норма</small>';
    const stab = d.stability >= 0.8 ? '<span class="pos">высокая</span>' : d.stability >= 0.6 ? 'средняя' : '<span class="neg">низкая</span>';
    const home = c === co.homeCountry ? ' 🏠' : '';
    html += `<tr><td>${d.name}${home}${d.bloc ? `<small class="muted"><br>${BLOCS[d.bloc]}</small>` : ''}</td><td>${pct(cs.tax)}</td><td>${pct(cs.tariff)}</td>
      <td>×${d.bureaucracy.toFixed(2)}</td><td>${pct(cs.inflation ?? 0, 1)}</td><td>${stab}</td><td>${econ}</td><td>${pres[c]?.any || '—'}</td></tr>`;
  }
  html += '</table><h3>Лицензии</h3><table class="tbl compact"><tr><th>Лицензия</th><th>Базовая цена</th><th>Есть у вас</th></tr>';
  for (const [id, l] of Object.entries(LICENSES)) {
    const have = (co.licenses || []).filter((x) => x.endsWith(`:${id}`)).map((x) => COUNTRIES[x.split(':')[0]].name);
    html += `<tr><td>${l.name}</td><td>${moneyShort(l.cost)}</td><td>${have.length ? have.join(', ') : '—'}</td></tr>`;
  }
  return `${html}</table><div class="muted small">Лицензия покупается один раз на страну при открытии первого такого бизнеса. Цена × уровень цен × бюрократия страны.</div>${renderDirectors(app)}${renderLobby(app)}`;
}

function stockRow(app, l) {
  const { state } = app;
  const mine = l.holders[app.companyId] || 0;
  const prev = l.hist.length > 4 ? l.hist[l.hist.length - 5] : l.hist[0];
  const ch = l.price / prev - 1;
  const own = l.id === app.companyId;
  const color = l.kind === 'company' ? `<span class="swatch" style="background:${state.companies[l.id]?.color}"></span>` : '';
  // доходность: у корпораций — 40% прибыли, у компаний игроков — последние дивиденды
  const div = l.kind === 'corp' ? l.eps * 0.4 : l.div;
  const yieldY = l.price > 0 ? (div * 12) / l.price : 0;
  return `<tr><td>${color}<b>${esc(l.name)}</b>${own ? ' (вы)' : ''}<small class="muted"><br>${esc(l.sector)}</small><br>${sparkline(l.hist, 90, 18)}</td>
    <td>${money(l.price, { cents: true })}<br><small class="${signClass(ch)}">${ch >= 0 ? '▲ +' : '▼ '}${pct(ch, 1)} за 4 нед.</small><br><small class="muted">див. ${pct(yieldY, 1)} в год</small></td>
    <td>${mine ? `${num(mine)}<small class="muted"><br>${pct(mine / l.shares, 1)} · ${moneyShort(mine * l.price)}</small>` : '—'}</td>
    <td class="trade-btns"><button class="mini wide" data-action="trade" data-id="${l.id}" data-side="1" title="Купить на сумму из поля выше">Купить</button>
    <button class="mini wide" data-action="trade" data-id="${l.id}" data-side="-1" ${mine ? '' : 'disabled'} title="Продать на сумму из поля выше">Продать</button></td></tr>`;
}

// Биржа: акции корпораций и компаний игроков, IPO, контроль и поглощения
function renderStocks(app) {
  const { state } = app;
  const co = app.company;
  const me = listingOf(state, app.companyId);
  const listings = Object.values(state.stocks?.listings || {});
  let html = `<h2>📈 Биржа</h2><p class="muted small">Покупайте акции корпораций ради роста и дивидендов. Выйдите на биржу сами (IPO), чтобы привлечь деньги.
    Но осторожно: купивший больше ${CONTROL_SHARE * 100}% ваших акций решает, сколько прибыли уходит на дивиденды, а от ${ABSORB_SHARE * 100}% может поглотить компанию целиком.</p>
    <div class="card">${row('Портфель (чужие акции)', money(portfolioValue(state, app.companyId)))}
    <div class="row"><span>Сумма сделки, $</span><span class="price-ctl"><input id="trade-amount" type="number" min="0" step="10000" value="50000"></span></div>
    <div class="muted small">Комиссия брокера ${pct(TRADE_FEE, 1)}. Крупные сделки двигают цену.</div></div>`;
  // своя компания
  html += '<h3>Ваша компания</h3><div class="card">';
  if (!me) {
    const why = ipoCheck(state, app.companyId);
    const est = fairCompanyPrice(state, app.companyId) * 0.9;
    html += `${row('Оценка за акцию (при IPO, со скидкой 10%)', money(est, { cents: true }))}${row('Вся компания', moneyShort(est * 1e6))}`;
    if (why) html += `<div class="muted small">Выйти на биржу пока нельзя: ${esc(why)}. Условия: капитал от ${moneyShort(IPO_MIN_WORTH)} и ${IPO_MIN_MONTHS} месяцев отчётности.</div>`;
    else {
      html += `<div class="row"><span>Продать публике</span><select id="ipo-share">${[0.1, 0.2, 0.3, 0.4, 0.49].map((s) => `<option value="${s}" ${s === 0.2 ? 'selected' : ''}>${Math.round(s * 100)}% — около ${moneyShort(est * 1e6 * s * 0.95)}</option>`).join('')}</select></div>
        <button class="btn" data-action="ipo">🔔 Выйти на биржу</button>
        <div class="muted small">Деньги получает компания (минус 5% андеррайтерам). Оставьте себе больше 50%, чтобы не потерять контроль.</div>`;
    }
  } else {
    const ctrl = controllerOf(state, me);
    const self = stakeOf(me, app.companyId);
    html += row('Цена акции', money(me.price, { cents: true })) + row('Стоимость компании', moneyShort(me.price * me.shares)) +
      row('Ваш пакет', `${pct(self, 1)}${self <= CONTROL_SHARE ? ' <span class="neg">— нет контроля!</span>' : ''}`) + row('У публики', pct(me.float / me.shares, 1));
    const others = Object.entries(me.holders).filter(([id]) => id !== app.companyId);
    for (const [id, n] of others) html += row(`Акционер «${esc(state.companies[id]?.name ?? id)}»`, `<span class="${n / me.shares > 0.25 ? 'neg' : ''}">${pct(n / me.shares, 1)}</span>`);
    if (ctrl) html += `<div class="note warn">🦈 Контроль у «${esc(state.companies[ctrl].name)}»: дивиденды решает он.</div>`;
    html += `<div class="row"><span>Дивиденды, доля прибыли</span><span class="chips tight">${[0, 0.25, 0.5, 0.75, 1].map((p) => `<button class="chip ${co.payout === p ? 'active' : ''}" data-action="setPayout" data-id="${app.companyId}" data-payout="${p}" ${ctrl ? 'disabled' : ''}>${Math.round(p * 100)}%</button>`).join('')}</span></div>
      <div class="muted small">Свои акции можно докупить (выкуп у публики) или продать (допэмиссия: деньги — компании) кнопками в таблице ниже.</div>`;
  }
  html += '</div>';
  // компании, которые вы контролируете
  for (const l of listings.filter((x) => x.kind === 'company' && x.id !== app.companyId && controllerOf(state, x) === app.companyId)) {
    const target = state.companies[l.id];
    html += `<div class="card"><b>🦈 Вы контролируете «${esc(l.name)}»</b> (${pct(stakeOf(l, app.companyId), 1)})
      <div class="row"><span>Её дивиденды</span><span class="chips tight">${[0, 0.25, 0.5, 0.75, 1].map((p) => `<button class="chip ${target.payout === p ? 'active' : ''}" data-action="setPayout" data-id="${l.id}" data-payout="${p}">${Math.round(p * 100)}%</button>`).join('')}</span></div>
      ${stakeOf(l, app.companyId) >= ABSORB_SHARE ? `<button class="btn danger" data-action="absorb" data-id="${l.id}">Поглотить — выкупить остальных за ${moneyShort(absorbCost(state, app.companyId, l.id))}</button>` : `<div class="muted small">С ${ABSORB_SHARE * 100}% акций можно поглотить компанию со всеми бизнесами.</div>`}</div>`;
  }
  html += '<h3>Котировки</h3><table class="tbl compact"><tr><th>Бумага</th><th>Цена</th><th>У вас</th><th></th></tr>';
  for (const l of listings.filter((x) => x.kind === 'company')) html += stockRow(app, l);
  for (const l of listings.filter((x) => x.kind === 'corp')) html += stockRow(app, l);
  return `${html}</table>`;
}

// ИИ-корпорации: кто они, где работают, сделки
function renderRivals(app) {
  const { state } = app;
  const co = app.company;
  const rivals = Object.values(state.companies).filter((c) => c.ai);
  let html = `<h2>🦈 Соперники</h2><p class="muted small">В мире работают ИИ-корпорации со своим характером. Они открывают точки рядом с вашими, выкупают помещения и акции.
    С ними можно договориться: выкупить их бизнес (нажмите на их точку на карте), заплатить за перемирие или купить их акции на бирже и поглотить.</p>`;
  if (!rivals.length) return `${html}<p class="muted">В этой игре корпораций нет.</p>`;
  const offers = (state.offers || []).filter((o) => o.to === app.companyId && o.until > state.day);
  if (offers.length) {
    html += '<h3>📨 Предложения</h3>';
    for (const o of offers) {
      html += `<div class="card"><div>${esc(offerText(state, o))}</div><div class="row"><small class="muted">действует ещё ${o.until - state.day} дн.</small>
        <span><button class="mini wide" data-action="answerOffer" data-id="${o.id}" data-accept="1">Принять</button>
        <button class="mini wide" data-action="answerOffer" data-id="${o.id}" data-accept="0">Отказать</button></span></div></div>`;
    }
  }
  for (const r of rivals) {
    const arch = ARCHETYPES[r.ai.archetype];
    const units = companyUnits(state, r.id);
    const countries = [...new Set(units.map((u) => COUNTRIES[state.world.places[u.placeId].country].name))];
    const near = units.filter((u) => companyUnits(state, app.companyId).some((m) => m.placeId === u.placeId)).length;
    const l = listingOf(state, r.id);
    const truce = co.truces?.[r.id] > state.day;
    html += `<div class="card"><div class="row"><span><span class="swatch" style="background:${r.color}"></span><b>${esc(r.name)}</b> <small class="muted">${arch.name}</small></span>
      <b>${r.bankrupt ? (r.absorbedBy ? 'поглощена' : '💀 банкрот') : moneyShort(netWorth(state, r.id))}</b></div>
      <div class="muted small">${arch.desc}</div>
      ${r.bankrupt ? '' : `${row('Бизнесов', `${units.length}${near ? ` · ${near} в ваших городах` : ''}`)}
      ${countries.length ? row('Страны', countries.slice(0, 6).join(', ') + (countries.length > 6 ? '…' : '')) : ''}
      ${l ? row('Акции', `${money(l.price, { cents: true })} · у вас ${pct(stakeOf(l, app.companyId), 1)}`) : row('Акции', 'ещё не на бирже')}
      <div class="row"><span>${truce ? `🕊 Перемирие до ${formatDate(co.truces[r.id])}` : `Перемирие на ${TRUCE_MONTHS} мес.: не открывается в ваших городах, не трогает помещения и акции`}</span>
      ${truce ? '' : `<button class="mini wide" data-action="buyTruce" data-id="${r.id}">🕊 ${moneyShort(truceCost(state, r))}</button>`}</div>`}</div>`;
  }
  return html;
}

// Исследования: дерево технологий — ветки колонками, ряды сверху вниз, стрелки от требуемых технологий
const NODE_W = 150;
const NODE_H = 74;
const GAP_X = 22;
const GAP_Y = 34;
const TECH_LAYOUT = (() => {
  const cols = {};
  for (const t of Object.values(TECHS)) cols[t.branch] = Math.max(cols[t.branch] ?? 0, t.col + 1);
  let x = 0;
  const branchX = {};
  for (const b of Object.keys(BRANCHES)) {
    branchX[b] = x;
    x += (cols[b] || 1) * (NODE_W + GAP_X) + 26;
  }
  const rows = Math.max(...Object.values(TECHS).map((t) => t.row)) + 1;
  const pos = {};
  for (const [id, t] of Object.entries(TECHS)) pos[id] = { x: branchX[t.branch] + t.col * (NODE_W + GAP_X), y: 40 + t.row * (NODE_H + GAP_Y) };
  return { pos, branchX, cols, width: x, height: 40 + rows * (NODE_H + GAP_Y) };
})();

function renderResearch(app) {
  const { state } = app;
  const co = app.company;
  const r = co.research;
  const done = Object.keys(TECHS).filter((id) => hasTech(state, app.companyId, id)).length;
  let html = `<h2>🔬 Исследования <small class="muted">${done} из ${Object.keys(TECHS).length}</small></h2><p class="muted small">Дерево технологий: стрелки показывают, что нужно изучить раньше (бывают связи между ветками).
    Деньги списываются каждый день, пока идёт работа. IT-студии с 3+ программистами ускоряют исследования (+25% каждая, до +50%; сейчас ×${researchSpeed(state, app.companyId).toFixed(2)}).</p>`;
  if (r) {
    const t = TECHS[r.id];
    const p = Math.min(1, r.progress / r.days);
    html += `<div class="card"><div class="row"><b>${t.icon} ${t.name}</b><button class="mini wide" data-action="cancelResearch">Остановить</button></div>
      <div class="progress"><span style="width:${(p * 100).toFixed(0)}%"></span></div>
      <div class="muted small">Готово ${pct(p)} · осталось ~${Math.ceil((r.days - r.progress) / researchSpeed(state, app.companyId) / 30)} мес. · бюджет ${moneyShort(r.cost)}</div></div>`;
  }
  const bonuses = Object.entries(STAT_EFFECTS).map(([k, d]) => ({ d, n: techLevel(state, app.companyId, k) })).filter((b) => b.n > 0);
  if (bonuses.length) html += `<div class="card small"><b>Действует:</b> ${bonuses.map((b) => `${esc(b.d)}${b.n > 1 ? ` ×${b.n}` : ''}`).join(' · ')}</div>`;
  const L = TECH_LAYOUT;
  let lines = '';
  let nodes = '';
  for (const [id, t] of Object.entries(TECHS)) {
    const p = L.pos[id];
    for (const req of t.requires) {
      const q = L.pos[req];
      const x1 = q.x + NODE_W / 2;
      const y1 = q.y + NODE_H;
      const x2 = p.x + NODE_W / 2;
      const y2 = p.y;
      const ok = hasTech(state, app.companyId, req);
      const cross = TECHS[req].branch !== t.branch;
      lines += `<path d="M${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2 - 4}" class="${ok ? 'done' : ''} ${cross ? 'cross' : ''}" marker-end="url(#arr)"/>`;
    }
    const have = hasTech(state, app.companyId, id);
    const why = techLocked(state, app.companyId, id);
    const active = r?.id === id;
    const cls = have ? 'done' : active ? 'active' : why ? 'locked' : 'open';
    const color = BRANCHES[t.branch].color;
    const title = `${t.name}\n${t.desc}${have ? '\n✓ изучено' : why ? `\n${why}` : `\n${moneyShort(techCost(state, app.companyId, id))} · ${t.months} мес.`}`;
    nodes += `<div class="tnode ${cls}" style="left:${p.x}px;top:${p.y}px;width:${NODE_W}px;height:${NODE_H}px;--c:${color}" title="${esc(title)}"
      ${!have && !why && !r ? `data-action="startResearch" data-id="${id}"` : ''}>
      <div class="tn-head"><span>${t.icon}</span><b>${esc(t.name)}</b></div>
      <div class="tn-desc">${esc(t.desc)}</div>
      <div class="tn-foot">${have ? '✓ изучено' : active ? `идёт · ${pct(Math.min(1, r.progress / r.days))}` : why ? '🔒' : `${moneyShort(techCost(state, app.companyId, id))} · ${t.months} мес.`}</div>
    </div>`;
  }
  const heads = Object.entries(BRANCHES).map(([b, d]) => `<div class="tbranch" style="left:${L.branchX[b]}px;width:${(L.cols[b] || 1) * (NODE_W + GAP_X) - GAP_X}px;--c:${d.color}">${d.icon} ${d.name}</div>`).join('');
  html += `<div class="tech-tree" id="tech-tree"><div class="tech-canvas" style="width:${L.width}px;height:${L.height}px">${heads}
    <svg width="${L.width}" height="${L.height}"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>${lines}</svg>
    ${nodes}</div></div>
    <div class="muted small">Нажмите на доступную технологию, чтобы начать. Колёсиком или перетаскиванием можно листать дерево.</div>`;
  return html;
}

// Лоббирование и льготы в странах, где работает компания
function renderLobby(app) {
  const { state } = app;
  const co = app.company;
  const pres = presenceByCountry(state, app.companyId);
  const list = Object.keys(pres);
  if (!list.length) return '';
  let html = `<h3>🏛️ Лоббирование и льготы</h3><div class="muted small">Чем больше у вас работников в стране, тем охотнее власти принимают нужные вам законы (снижение налога или пошлин — для всех).
    Раз в год на страну. Крупный работодатель (${BIG_EMPLOYER}+ сотрудников) платит налог на 5 п.п. меньше.</div><table class="tbl compact"><tr><th>Страна</th><th>Работников</th><th>Льгота</th><th>Шанс</th><th></th></tr>`;
  for (const c of list) {
    const wait = co.lobbied?.[c] && state.day - co.lobbied[c] < LOBBY_COOLDOWN;
    html += `<tr><td>${COUNTRIES[c].name}</td><td>${num(employees(state, app.companyId, c))}</td><td>${taxBreak(state, app.companyId, c) ? `−${Math.round(taxBreak(state, app.companyId, c) * 100)} п.п.` : '—'}</td>
      <td>${pct(lobbyChance(state, app.companyId, c))}</td><td>${wait ? '<small class="muted">через год</small>' : Object.entries(LOBBY_GOALS).map(([g, x]) => `<button class="mini wide" data-action="lobby" data-country="${c}" data-goal="${g}" title="${x.name}">${g === 'tax' ? '↓ налог' : '↓ пошлины'} · ${moneyShort(lobbyCost(state, c))}</button>`).join(' ')}</td></tr>`;
  }
  return `${html}</table>`;
}

function renderGoals(app) {
  const { state } = app;
  const co = app.company;
  const ctx = goalContext(state, co);
  const done = GOALS.filter((g) => co.goals?.[g.id] !== undefined).length;
  let html = `<h2>🏆 Цели</h2><div class="sub">Выполнено ${done} из ${GOALS.length}</div>`;
  if (state.victory) {
    html += `<div class="card"><b>Условие победы:</b> ${victoryText(state.victory)}${state.winner ? `<br>🏆 Победитель — «${esc(state.companies[state.winner.companyId].name)}»` : ''}</div>`;
  }
  html += '<div class="goals">';
  for (const g of GOALS) {
    const day = co.goals?.[g.id];
    const [cur, need] = g.progress(ctx);
    const p = Math.min(1, cur / need);
    const value = need >= 1000 ? `${moneyShort(Math.min(cur, need))} / ${moneyShort(need)}` : `${num(Math.min(cur, need))} / ${num(need)}`;
    html += `<div class="goal ${day !== undefined ? 'done' : ''}"><span class="goal-icon">${g.icon}</span>
      <div class="goal-main"><b>${g.name}</b><small>${g.desc}</small>
      ${day !== undefined ? `<small class="pos">✓ ${formatDate(day)}</small>` : `<div class="progress"><span style="width:${(p * 100).toFixed(0)}%"></span></div><small class="muted">${value}</small>`}</div></div>`;
  }
  return `${html}</div>`;
}

function renderHelp() {
  return `<h2>❓ Как играть</h2>
  <ol class="help">
    <li><b>Выберите город</b> на карте (🏙️) и приблизьтесь. Цветные круги — районы: деловой центр, спальный, студенческий и т.д.</li>
    <li><b>Нажмите на район</b>, чтобы увидеть спрос и конкурентов, затем на <b>свободный участок 🏬</b>.</li>
    <li>В панели участка есть <b>прогноз</b> для каждого подходящего бизнеса: клиенты, выручка, расходы, окупаемость. Откройте лучший.</li>
    <li>Бизнес сам закупает сырьё (молоко, зерно, стаканы…) на мировом рынке. Следите за <b>ценами</b>, <b>персоналом</b> (иначе очереди) и <b>рекламой</b> (узнаваемость).</li>
    <li><b>Связывайте бизнесы в цепочки:</b> плантация 🌳 → обжарка 🔥 → кофейни; ферма 🌾 → мельница ⚙️ → пекарни и фастфуд; скот 🐂 → мясокомбинат → рестораны; молочная ферма 🐄 → молокозавод 🧀 → супермаркеты. Своё везётся, только если с доставкой дешевле рынка. Линии цепочек видны на карте.</li>
    <li><b>Склад</b> 🏗️ держит запас для точек рядом, закупает оптом и получает дальние партии по оптовому тарифу. <b>Контракты</b> в панели бизнеса фиксируют цену на 3–12 месяцев.</li>
    <li><b>Услуги</b> дают бонус всей компании: грузоперевозки 🚚 — дешёвая доставка в регионе, рекламное агентство 📣 — реклама эффективнее, IT-студия 💻 — +10% мощности точек.</li>
    <li><b>Сети</b> 🏷️: объединяйте точки одного типа — общие цены в % от местной нормы, реклама и зарплаты. Несколько точек одной сети в городе поднимают узнаваемость бренда: сеть получает больше клиентов, чем отдельные точки. Расширяйтесь как в жизни: город → страна → другие страны (выход на новый рынок стоит денег, без 3 точек в стране нет своей команды).</li>
    <li><b>Страны</b> 🌍: свои налоги, пошлины на ввоз (внутри союзов вроде ЕС — без пошлин), лицензии для ресторанов, АЗС, заводов и нефти. Бывают кризисы и подъёмы — следите за новостями.</li>
    <li><b>Франшиза</b> 🤝: когда у сети 3 свои точки, продавайте франшизу в любых странах — франчайзи откроют точки под вашей маркой и будут платить роялти.</li>
    <li><b>Тир III:</b> нефтяная скважина 🛢️ → НПЗ (топливо) → АЗС ⛽ и грузоперевозки; нефтехимия (пластик) → упаковка; пищевая фабрика 🥫 делает товары для магазинов.</li>
    <li><b>Биржа</b> 📈: покупайте акции корпораций ради дивидендов, выходите на IPO за деньгами. В игре против друзей можно скупить контрольный пакет соперника и поглотить его.</li>
    <li><b>Рынки региональные:</b> во вкладке 💹 видно, где товар дешевле всего.</li>
    <li><b>Без управления бизнес хиреет.</b> Цены и зарплаты каждый год растут на инфляцию, оборудование изнашивается 🛠, конкуренты со временем становятся сильнее,
      спрос меняется по сезонам, а на прибыльные места приходят новые конкуренты. Поднимайте цены, обновляйте точки, подстраивайте штат, нанимайте управляющих.
      Сети делают часть рутины сами: пересчитывают цены по инфляции и (по галочке) обновляют изношенные точки.</li>
    <li><b>Управление большой компанией:</b> вкладка ⚠️ «Задачи» показывает всё, что теряет деньги, и чинит в один клик; во вкладке 🏢 «Бизнесы» — фильтры и массовые действия;
      региональные директора (🌍 «Страны») сами держат штат, цены и обновления по стране.</li>
    <li><b>Соперники</b> 🦈: ИИ-корпорации со своим характером (дискаунтер, премиум, сырьевик, агрессор) открываются рядом, выкупают помещения и акции. Их точки можно выкупить, с ними — заключить перемирие, их акции — скупить и поглотить.</li>
    <li><b>Исследования</b> 🔬 дают бонусы всей компании и открывают тир IV: банк (дешёвые кредиты), электроника, облачный сервис. <b>Лоббирование</b> снижает налоги и пошлины; крупный работодатель получает налоговую льготу.</li>
    <li><b>У каждого бизнеса свой характер</b> (метка риска на карточке): 🟢 недвижимость, электростанция, аптеки — дорого, но стабильно;
      🔴 застройщик, фарма, автосалоны, нефть — могут принести очень много, а могут и убытки. Отели живут туристами и сезоном.</li>
    <li><b>Цепочки</b>: нефтехимия → завод запчастей → автозавод → автосалоны и автосервисы; фармзавод → аптеки; косметическая фабрика → салоны и аптеки;
      пищевая фабрика → магазины и отели; служба доставки → своя доставка для кафе. Порт ускоряет межконтинентальные поставки.
      Недра: шахты (руда, уголь, литий…) → металлургия → кабель, техника, грузовики и роботы; карьеры → стройматериалы → стройгипермаркет;
      лес → лесопилка → мебель и бумага; хлопок → ткань → одежда; виноград → вино → бары. Заводы с выбором продукции можно перенастроить (неделя простоя).</li>
    <li><b>Удобство</b>: 🔍 «Поиск мест» находит лучшие участки; 💾 шаблон точки переносит настройки в новый город; 🤖 автопилот в «Финансах»
      гасит кредит, обновляет и закрывает точки; ⚙️ настройки — громкость, скорость дня, размер, пауза при важных событиях; три слота сохранений и файл.</li>
    <li><b>Расходы штаба</b> растут быстрее числа бизнесов: тысяча мелких киосков — не империя. Растите в крупные и прибыльные активы, цепочки, франшизу.</li>
    <li>Не хватает денег — возьмите <b>кредит</b> во вкладке 🏦. Касса в минусе 45 дней — банкротство.</li>
    <li>Время: ⏸ пауза, ▶ ⏩ ⏭ — скорость. Игра сохраняется автоматически каждый месяц.</li>
  </ol>
  <button class="btn ghost" data-action="restartTutorial">🎓 Пройти обучение заново</button>
  <p class="muted small">Прототип (см. docs/PLAN.md).</p>`;
}

export function renderDrawer(app, force = false) {
  const el = document.getElementById('drawer');
  const nav = document.getElementById('nav');
  /** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('button[data-tab]')).forEach((b) => b.classList.toggle('active', b.dataset.tab === app.tab));
  if (!app.tab) {
    el.classList.remove('open');
    return;
  }
  const active = /** @type {HTMLInputElement | null} */ (el.contains(document.activeElement) ? document.activeElement : null);
  const chatDraft = active?.closest('#chat-form') ? active.value : null;
  // не мешаем вводу суммы кредита и выбору в выпадающем списке (перерисовка закрыла бы его)
  if ((active?.tagName === 'INPUT' || active?.tagName === 'SELECT') && chatDraft === null && !force) return;
  const render = {
    units: renderUnits, tasks: renderTasks, search: renderSearch, market: renderMarket, finance: renderFinance, news: renderNews, brands: renderBrands,
    countries: renderCountries, stocks: renderStocks, rivals: renderRivals, research: renderResearch, goals: renderGoals, room: renderRoom, help: renderHelp,
  }[app.tab];
  const scroll = el.scrollTop;
  const tree = document.getElementById('tech-tree');
  const treeScroll = tree ? [tree.scrollLeft, tree.scrollTop] : null;
  el.classList.toggle('wide', app.tab === 'research');
  el.innerHTML = `<button class="close-x" data-action="closeTab" title="Закрыть">×</button>${tabHint(app.tab)}${render(app)}`;
  el.scrollTop = scroll;
  const tree2 = document.getElementById('tech-tree');
  if (tree2 && treeScroll) [tree2.scrollLeft, tree2.scrollTop] = treeScroll;
  if (chatDraft !== null) {
    const input = /** @type {HTMLInputElement} */ (el.querySelector('#chat-form input'));
    input.value = chatDraft;
    input.focus();
  }
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
  el.classList.add('open');
}
