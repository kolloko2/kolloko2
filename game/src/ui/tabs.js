import { bizIcon, goodIcon } from './icons.js';
import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { MARKET_REGIONS } from '../data/regions.js';
import {
  regionOf, midPrice, buyPrice, sellPrice, monthProfit, netWorth, loanLimit, formatDate, newsFor, companyUnits, GOALS, goalContext, victoryText,
} from '../sim/index.js';
import { SPEEDS } from '../net/session.js';
import { money, moneyShort, num, pct, stars, esc, signClass, sparkline, bars, lineChart } from './format.js';

export const TABS = [
  { id: 'units', icon: '🏢', img: 'city', name: 'Бизнесы' },
  { id: 'market', icon: '💹', img: 'market', name: 'Рынок' },
  { id: 'finance', icon: '🏦', img: 'finance', name: 'Финансы' },
  { id: 'news', icon: '📰', img: 'news', name: 'Новости' },
  { id: 'goals', icon: '🏆', img: 'capital', name: 'Цели' },
  { id: 'room', icon: '👥', img: 'loan', name: 'Игроки' },
  { id: 'help', icon: '❓', img: 'help', name: 'Как играть' },
];

function renderUnits(app) {
  const { state } = app;
  const units = companyUnits(state, app.companyId);
  if (!units.length) {
    return '<h2>🏢 Бизнесы</h2><p class="muted">Пока ничего нет. Выберите город на карте, приблизьтесь к району и нажмите на свободный участок 🏬.</p>';
  }
  let total = 0;
  let html = '<h2>🏢 Бизнесы</h2><table class="tbl hover"><tr><th></th><th>Название</th><th>Сегодня</th><th>Рейтинг</th><th>Прошлый мес.</th></tr>';
  for (const u of units) {
    const def = BUSINESSES[u.type];
    const place = state.world.places[u.placeId];
    const t = u.today || {};
    const profit = u.last ? monthProfit(u.last) : null;
    if (profit !== null) total += profit;
    const warn = u.broken > 0 || t.stockout || t.inputShort ? ' ⚠️' : '';
    let today = 'склад';
    if (def.retail) today = `${num(t.customers ?? 0)} кл.`;
    else if (def.production) today = `${num(t.produced ?? 0)} ${GOODS[def.production.recipe.output].unit}`;
    else if (def.service) today = moneyShort(t.revenue ?? 0);
    html += `<tr data-action="selectUnit" data-fly="1" data-id="${u.id}"><td>${bizIcon(u.type, 'row')}</td><td>${esc(u.name)}${warn}<small class="muted"><br>${esc(place.name)}</small></td>
      <td>${today}</td><td class="stars">${def.retail ? stars(u.quality) : '—'}</td>
      <td class="${signClass(profit ?? 0)}">${profit === null ? '—' : moneyShort(profit)}</td></tr>`;
  }
  html += `<tr class="total"><td></td><td>Итого (${units.length})</td><td></td><td></td><td class="${signClass(total)}">${moneyShort(total)}</td></tr></table>`;
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
    ${row('Кредит', `${money(co.loan)} под ${pct(co.loanRate)} годовых`)}
    ${row('Банк готов выдать ещё', money(Math.max(0, limit - co.loan)))}
    </div>
    <div class="card"><div class="row"><span>Сумма</span><span class="price-ctl"><input id="loan-amount" type="number" step="5000" min="0" value="10000"></span></div>
    <div class="btn-row"><button class="btn" data-action="takeLoan">Взять кредит</button><button class="btn ghost" data-action="repayLoan">Погасить</button></div>
    <div class="muted small">Лимит растёт с прибылью и стоимостью ваших бизнесов и недвижимости. Если касса в минусе 45 дней — банкротство.</div></div>`;
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
      <table class="tbl"><tr><th>Месяц</th><th>Выручка</th><th>Прибыль</th><th>Налог</th><th>Проценты</th><th>Касса</th></tr>`;
    for (const m of h) {
      html += `<tr><td>${m.label}</td><td>${moneyShort(m.revenue)}</td><td class="${signClass(m.profit)}">${moneyShort(m.profit)}</td>
        <td>${moneyShort(m.tax)}</td><td>${moneyShort(m.interest)}</td><td>${moneyShort(m.cash)}</td></tr>`;
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
    <li><b>Рынки региональные:</b> во вкладке 💹 видно, где товар дешевле всего.</li>
    <li>Не хватает денег — возьмите <b>кредит</b> во вкладке 🏦. Касса в минусе 45 дней — банкротство.</li>
    <li>Время: ⏸ пауза, ▶ ⏩ ⏭ — скорость. Игра сохраняется автоматически каждый месяц.</li>
  </ol>
  <button class="btn ghost" data-action="restartTutorial">🎓 Пройти обучение заново</button>
  <p class="muted small">Прототип (см. docs/PLAN.md). Дальше: контракты, склады и логистика, новые бизнесы, персонал.</p>`;
}

export function renderDrawer(app) {
  const el = document.getElementById('drawer');
  const nav = document.getElementById('nav');
  nav.querySelectorAll('button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === app.tab));
  if (!app.tab) {
    el.classList.remove('open');
    return;
  }
  const active = el.contains(document.activeElement) ? document.activeElement : null;
  const chatDraft = active?.closest('#chat-form') ? active.value : null;
  if (active?.tagName === 'INPUT' && chatDraft === null) return; // не мешаем вводу суммы кредита и т.п.
  const render = { units: renderUnits, market: renderMarket, finance: renderFinance, news: renderNews, goals: renderGoals, room: renderRoom, help: renderHelp }[app.tab];
  const scroll = el.scrollTop;
  el.innerHTML = `<button class="close-x" data-action="closeTab" title="Закрыть">×</button>${render(app)}`;
  el.scrollTop = scroll;
  if (chatDraft !== null) {
    const input = el.querySelector('#chat-form input');
    input.value = chatDraft;
    input.focus();
  }
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
  el.classList.add('open');
}
