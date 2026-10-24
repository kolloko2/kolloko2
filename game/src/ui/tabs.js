import { bizIcon, goodIcon } from './icons.js';
import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { midPrice, buyPrice, sellPrice, monthProfit, netWorth, loanLimit, formatDate, newsFor, companyUnits } from '../sim/index.js';
import { SPEEDS } from '../net/session.js';
import { money, moneyShort, num, pct, stars, esc, signClass, sparkline, bars } from './format.js';

export const TABS = [
  { id: 'units', icon: '🏢', img: 'city', name: 'Бизнесы' },
  { id: 'market', icon: '💹', img: 'market', name: 'Рынок' },
  { id: 'finance', icon: '🏦', img: 'finance', name: 'Финансы' },
  { id: 'news', icon: '📰', img: 'news', name: 'Новости' },
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
    const today = def.retail ? `${num(t.customers ?? 0)} кл.` : `${num(t.produced ?? 0)} ${GOODS[def.production.recipe.output].unit}`;
    html += `<tr data-action="selectUnit" data-fly="1" data-id="${u.id}"><td>${bizIcon(u.type, 'row')}</td><td>${esc(u.name)}${warn}<small class="muted"><br>${esc(place.name)}</small></td>
      <td>${today}</td><td class="stars">${def.retail ? stars(u.quality) : '—'}</td>
      <td class="${signClass(profit ?? 0)}">${profit === null ? '—' : moneyShort(profit)}</td></tr>`;
  }
  html += `<tr class="total"><td></td><td>Итого (${units.length})</td><td></td><td></td><td class="${signClass(total)}">${moneyShort(total)}</td></tr></table>`;
  return html;
}

function renderMarket(app) {
  const { state } = app;
  let html = '<h2>💹 Мировой рынок</h2><p class="muted small">Цены меняются каждый день. Ваши крупные покупки и продажи двигают цену. Закупка дороже на 7%, продажа дешевле на 8% (посредники).</p>';
  html += '<table class="tbl"><tr><th>Товар</th><th>Купить</th><th>Продать</th><th>За 4 нед.</th><th>Тренд (2 года)</th></tr>';
  for (const [g, m] of Object.entries(state.market.goods)) {
    const def = GOODS[g];
    const now = midPrice(state, g);
    const prev = m.hist.length > 4 ? m.hist[m.hist.length - 5] : m.hist[0];
    const ch = now / prev - 1;
    const shock = m.shockDays > 0 ? ` <span class="tag ${m.shock > 1 ? 'bad' : 'good'}" title="Осталось ${m.shockDays} дн.">${m.shock > 1 ? '▲ шок' : '▼ избыток'}</span>` : '';
    html += `<tr><td>${goodIcon(g, 'inline')} ${def.name}${shock}<small class="muted"><br>за ${def.unit}${def.local ? ', цена зависит от города' : ''}</small></td>
      <td>${money(buyPrice(state, g), { cents: true })}</td><td>${money(sellPrice(state, g), { cents: true })}</td>
      <td>${ch >= 0 ? '▲ +' : '▼ '}${pct(ch, 1)}</td><td>${sparkline(m.hist)}</td></tr>`;
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
    html += `<h3>Прибыль компании по месяцам</h3>${bars(co.history.slice(-24).map((m) => m.profit), 340, 56)}
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
  }
  html += '<h3>Чат</h3><div class="chat" id="chat-log">';
  if (!app.chat.length) html += '<span class="muted small">Сообщений пока нет.</span>';
  for (const m of app.chat) html += `<div class="chat-msg"><b style="color:${m.color || 'inherit'}">${esc(m.from)}:</b>${esc(m.text)}</div>`;
  html += '</div><form id="chat-form"><input maxlength="300" placeholder="Сообщение…" autocomplete="off"><button class="btn" type="submit">➤</button></form>';
  return html;
}

function renderHelp() {
  return `<h2>❓ Как играть</h2>
  <ol class="help">
    <li><b>Выберите город</b> на карте (🏙️) и приблизьтесь. Цветные круги — районы: деловой центр, спальный, студенческий и т.д.</li>
    <li><b>Нажмите на район</b>, чтобы увидеть спрос и конкурентов, затем на <b>свободный участок 🏬</b>.</li>
    <li>В панели участка есть <b>прогноз</b> для каждого подходящего бизнеса: клиенты, выручка, расходы, окупаемость. Откройте лучший.</li>
    <li>Бизнес сам закупает сырьё (молоко, зерно, стаканы…) на мировом рынке. Следите за <b>ценами</b>, <b>персоналом</b> (иначе очереди) и <b>рекламой</b> (узнаваемость).</li>
    <li><b>Связывайте бизнесы в цепочки:</b> обжарка 🔥 в промзоне снабжает ваши кофейни дешевле рынка, плантация 🌳 в Бразилии снабжает обжарку, мельница ⚙️ — пекарни и фастфуд, ферма 🐄 — молоком.</li>
    <li>Не хватает денег — возьмите <b>кредит</b> во вкладке 🏦. Касса в минусе 45 дней — банкротство.</li>
    <li>Время: ⏸ пауза, ▶ ⏩ ⏭ — скорость. Игра сохраняется автоматически каждый месяц.</li>
  </ol>
  <p class="muted small">Прототип этапа 0 (см. docs/PLAN.md). Дальше: контракты, региональные рынки, мультиплеер.</p>`;
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
  const render = { units: renderUnits, market: renderMarket, finance: renderFinance, news: renderNews, room: renderRoom, help: renderHelp }[app.tab];
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
