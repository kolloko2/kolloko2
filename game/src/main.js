import { loadIcons, uiIcon } from './ui/icons.js';
import { createGame, formatDate, netWorth, newsFor, isOver, attention, companyAlerts, SAVE_VERSION, VICTORY_OPTIONS } from './sim/index.js';
import { renderTutorial, restartTutorial, skipTutorial, advisorAction, hideHint, resetHints } from './ui/tutorial.js';
import { LocalSession, RemoteSession, SPEEDS } from './net/session.js';
import { initMap, refreshMap, refreshWarnings, resetMap, flyToDistrict, flyToLot } from './ui/map.js';
import { renderPanel } from './ui/panels.js';
import { renderDrawer, TABS, filteredUnits } from './ui/tabs.js';
import { money, moneyShort, signClass, esc } from './ui/format.js';

const SAVE_KEY = 'magnat-save-v3';
const MP_KEY = 'magnat-mp';

const app = {
  session: null,
  started: false, // false, пока игрок не начал игру (под лобби крутится демо-мир, его не сохраняем)
  selection: null,
  tab: null,
  chat: [],
  get state() {
    return this.session.state;
  },
  get companyId() {
    return this.session.companyId;
  },
  get company() {
    return this.session.state.companies[this.session.companyId];
  },
  select(sel) {
    app.selection = sel;
    renderPanel(app);
    refreshMap(app);
    renderTutorial(app);
  },
  async dispatch(cmd) {
    const r = await app.session.dispatch(cmd);
    if (!r.ok) toast(r.error, 'bad');
    render();
    refreshMap(app);
    return r;
  },
  sendChat(text) {
    app.session.chat?.(text);
  },
};

// ---------- сохранения (соло) ----------
function save(silent = false) {
  if (!app.started || app.session.multiplayer) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.state));
    if (!silent) toast('Игра сохранена');
  } catch {
    if (!silent) toast('Не удалось сохранить (хранилище браузера недоступно)', 'bad');
  }
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно — просто не запоминаем
  }
}

function loadSolo() {
  const s = readJson(SAVE_KEY);
  return s && s.version === SAVE_VERSION ? s : null;
}

// ---------- HUD ----------
function renderHud() {
  const { state, session } = app;
  const co = app.company;
  const last = co.history.at(-1);
  document.getElementById('hud-company').textContent = co.name;
  document.getElementById('hud-company').style.borderLeft = `4px solid ${co.color}`;
  const cash = document.getElementById('hud-cash');
  cash.textContent = money(co.cash);
  cash.className = co.cash < 0 ? 'neg' : '';
  document.getElementById('hud-worth').textContent = moneyShort(netWorth(state, app.companyId));
  const profit = document.getElementById('hud-profit');
  profit.textContent = last ? moneyShort(last.profit) : '—';
  profit.className = last ? signClass(last.profit) : '';
  document.getElementById('hud-date').textContent = formatDate(state.day);
  const att = attention(state, app.companyId);
  const attEl = document.getElementById('hud-attention');
  attEl.textContent = `${att.used} / ${att.limit}`;
  attEl.className = att.excess ? 'neg' : '';

  const mine = session.multiplayer ? session.mySpeed() : session.speed;
  document.querySelectorAll('#speed button').forEach((b) => {
    const i = Number(b.dataset.speed);
    b.classList.toggle('active', i === mine);
    b.classList.toggle('effective', session.multiplayer && i === session.speed && i !== mine);
  });

  const room = document.getElementById('hud-room');
  if (session.multiplayer) {
    const online = session.players.filter((p) => p.online).length;
    room.hidden = false;
    room.innerHTML = `<small>${session.mode === 'coop' ? 'Кооператив' : 'Против друзей'}</small><b>${session.code} · 👥 ${online}</b>`;
  } else {
    room.hidden = true;
  }
  document.getElementById('btn-save').hidden = session.multiplayer;

  const unread = newsFor(state, app.companyId).filter((n) => n.day >= state.day - 7 && (n.kind === 'bad' || n.kind === 'warn')).length;
  document.querySelector('#nav button[data-tab="news"] .nav-badge').textContent = unread || '';
  document.querySelector('#nav button[data-tab="room"]').hidden = !session.multiplayer;
  const tasks = companyAlerts(state, app.companyId).filter((a) => a.kind !== 'contract').length;
  document.querySelector('#nav button[data-tab="tasks"] .nav-badge').textContent = tasks || '';
}

function render() {
  renderHud();
  renderTutorial(app);
  checkWinner();
  const panel = document.getElementById('panel');
  const editing = panel.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName);
  if (!editing) renderPanel(app);
  renderDrawer(app);
}

// ---------- победа ----------
let shownWinner = null;
function checkWinner() {
  const w = app.state.winner;
  if (!app.started || !w || shownWinner === `${app.session.code || 'solo'}:${w.day}`) return;
  shownWinner = `${app.session.code || 'solo'}:${w.day}`;
  const co = app.state.companies[w.companyId];
  const me = w.companyId === app.companyId;
  document.getElementById('winner-text').innerHTML = `${me ? '🎉 Вы победили!' : '🏆 Игра окончена'}<br>
    Компания <b style="color:${co.color}">«${esc(co.name)}»</b> — капитал ${money(w.worth)} на ${formatDate(w.day)}.`;
  document.getElementById('winner').classList.add('open');
}

// ---------- уведомления ----------
let toastTimer;
function toast(text, kind = 'info') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 3500);
}

let lastNewsSeq = 0;
function announceNews() {
  const news = newsFor(app.state, app.companyId);
  const fresh = news.filter((n) => n.seq > lastNewsSeq);
  if (fresh.length && lastNewsSeq > 0) {
    const n = fresh[0];
    if (n.kind === 'bad' || n.kind === 'warn' || n.kind === 'good') toast(n.text, n.kind);
  }
  if (news.length) lastNewsSeq = Math.max(lastNewsSeq, news[0].seq);
}

// ---------- игровой цикл ----------
let prev = performance.now();
let lastMonths = 0;
function loop(now) {
  const dt = Math.min(now - prev, 1000);
  prev = now;
  app.session.update(dt);
  requestAnimationFrame(loop);
}

function onTick() {
  if (!app.started) return;
  announceNews();
  render();
  refreshWarnings(app);
  const months = app.company.history.length;
  if (months !== lastMonths) {
    lastMonths = months;
    save(true);
  }
  if (!app.session.multiplayer && isOver(app.state)) app.session.setSpeed(0);
}

function setSpeed(i) {
  app.session.setSpeed(i);
  renderHud();
}

// ---------- сессии ----------
function useSession(session) {
  if (app.session?.multiplayer && app.session !== session) app.session.close();
  app.session = session;
  app.selection = null;
  app.chat = [];
  lastNewsSeq = 0;
  lastMonths = app.company.history.length;
  session.on('tick', onTick);
  session.on('change', render);
  session.on('speed', renderHud);
  session.on('room', () => {
    renderHud();
    if (app.tab === 'room') renderDrawer(app);
  });
  session.on('chat', (m) => {
    app.chat.push(m);
    if (app.chat.length > 100) app.chat.shift();
    if (app.tab === 'room') renderDrawer(app);
    else toast(`💬 ${m.from}: ${m.text}`);
  });
  session.on('close', () => {
    if (app.session !== session) return;
    toast('Связь с сервером потеряна', 'bad');
    showLobby('Связь с сервером потеряна. Можно вернуться в комнату.');
  });
  session.on('error', (message) => toast(message, 'bad'));
  resetMap(app);
  render();
}

function startSolo(companyName) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const session = new LocalSession(createGame({ seed, companyNames: [companyName || 'Моя компания'] }));
  app.started = true;
  useSession(session);
  app.tab = 'help';
  save(true);
  render();
  setSpeed(1);
}

function resumeSolo(state) {
  app.started = true;
  useSession(new LocalSession(state));
  toast(`С возвращением, ${app.company.name}! Игра на паузе.`);
}

async function startRemote(hello) {
  const session = await RemoteSession.connect(hello);
  app.started = true;
  useSession(session);
  writeJson(MP_KEY, { code: session.code, playerId: session.playerId, mode: session.mode, name: hello.name });
  app.tab = 'room';
  render();
  toast(`Вы в комнате ${session.code}. Отправьте код друзьям!`, 'good');
}

// ---------- лобби ----------
const LOBBY = {
  solo: { title: 'Одиночная игра', desc: 'Вы против ИИ-конкурентов. Игра сохраняется в этом браузере.', fields: ['company'], submit: 'Начать' },
  coop: { title: 'Кооператив', desc: 'Одна общая компания на всех: каждый может открывать бизнесы и управлять ими. Друзья входят по коду комнаты.', fields: ['player', 'company'], submit: 'Создать комнату' },
  pvp: { title: 'Против друзей', desc: 'У каждого своя компания в одном мире: конкуренция за районы и покупателей, можно выкупить помещение соперника.', fields: ['player', 'company', 'victory'], submit: 'Создать комнату' },
  join: { title: 'Войти по коду', desc: 'Введите код комнаты, который прислал друг. Название компании нужно только в игре против друзей.', fields: ['player', 'code', 'company'], submit: 'Войти' },
};
let lobbyMode = 'solo';

function renderLobby() {
  const cfg = LOBBY[lobbyMode];
  document.querySelectorAll('#lobby-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === lobbyMode));
  document.getElementById('lobby-desc').textContent = cfg.desc;
  document.querySelectorAll('#lobby-form [data-field]').forEach((el) => (el.hidden = !cfg.fields.includes(el.dataset.field)));
  document.getElementById('lobby-submit').textContent = cfg.submit;
  const resume = [];
  if (loadSolo()) resume.push('<button type="button" class="btn ghost" data-resume="solo">▶ Продолжить одиночную игру</button>');
  const mp = readJson(MP_KEY);
  if (mp?.code) resume.push(`<button type="button" class="btn ghost" data-resume="mp">↩ Вернуться в комнату ${esc(mp.code)}</button>`);
  document.getElementById('lobby-resume').innerHTML = resume.join('');
}

function showLobby(error = '') {
  if (app.session && !app.session.multiplayer) app.session.setSpeed(0);
  document.getElementById('welcome').classList.add('open');
  document.getElementById('lobby-error').textContent = error;
  renderLobby();
}

function hideLobby() {
  document.getElementById('welcome').classList.remove('open');
}

function bindLobby() {
  const mp = readJson(MP_KEY);
  document.getElementById('lobby-player').value = mp?.name || '';
  document.getElementById('lobby-company').value = 'Bean & Co';
  document.getElementById('lobby-victory').innerHTML = VICTORY_OPTIONS.map((v) => `<option value="${v.id}" ${v.id === 'worth1m' ? 'selected' : ''}>${v.name}</option>`).join('');
  document.getElementById('lobby-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    lobbyMode = b.dataset.mode;
    document.getElementById('lobby-error').textContent = '';
    renderLobby();
  });
  document.getElementById('lobby-resume').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-resume]');
    if (!b) return;
    if (b.dataset.resume === 'solo') {
      hideLobby();
      resumeSolo(loadSolo());
      return;
    }
    const saved = readJson(MP_KEY);
    try {
      await startRemote({ t: 'join', code: saved.code, playerId: saved.playerId, name: saved.name });
      hideLobby();
    } catch (err) {
      document.getElementById('lobby-error').textContent = err.message;
    }
  });
  document.getElementById('lobby-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('lobby-player').value.trim();
    const companyName = document.getElementById('lobby-company').value.trim();
    const code = document.getElementById('lobby-code').value.trim().toUpperCase();
    const errorEl = document.getElementById('lobby-error');
    errorEl.textContent = '';
    if (lobbyMode === 'solo') {
      if (loadSolo() && !confirm('Начать новую одиночную игру? Сохранение будет перезаписано.')) return;
      hideLobby();
      startSolo(companyName);
      return;
    }
    if (!name) {
      errorEl.textContent = 'Введите имя — его увидят другие игроки';
      return;
    }
    const victory = document.getElementById('lobby-victory').value;
    const hello = lobbyMode === 'join' ? { t: 'join', code, name, companyName } : { t: 'create', mode: lobbyMode, name, companyName, victory };
    if (lobbyMode === 'join' && !/^[A-Z0-9]{5}$/.test(code)) {
      errorEl.textContent = 'Код комнаты — 5 символов';
      return;
    }
    const btn = document.getElementById('lobby-submit');
    btn.disabled = true;
    try {
      await startRemote(hello);
      hideLobby();
    } catch (err) {
      errorEl.textContent = location.protocol === 'file:' ? 'Для мультиплеера запустите сервер: npm start' : err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- обработка действий ----------
async function handleAction(el) {
  const { action, id } = el.dataset;
  const { state } = app;
  switch (action) {
    case 'selectDistrict':
      app.select({ kind: 'district', id });
      flyToDistrict(state.world.districts[id]);
      break;
    case 'selectLot':
      app.select({ kind: 'lot', id });
      flyToLot(state.world.lots[id]);
      break;
    case 'selectUnit':
      if (!state.units[id]) return;
      app.select({ kind: 'unit', id });
      if (el.dataset.fly) flyToLot(state.world.lots[state.units[id].lotId]);
      break;
    case 'deselect':
      app.select(null);
      break;
    case 'closeTab':
      app.tab = null;
      renderDrawer(app);
      break;
    case 'open': {
      // Защита новичка: предупреждаем об убыточном прогнозе и о пустой кассе после покупки
      const profit = Number(el.dataset.profit);
      const left = app.company.cash - Number(el.dataset.capex);
      const warn = [];
      if (profit < 0) warn.push(`По прогнозу бизнес убыточен (${money(profit)} в месяц).`);
      if (left < Number(el.dataset.costs)) warn.push(`После открытия в кассе останется ${money(left)} — меньше месячных расходов. Пока точка раскручивается, деньги могут кончиться (через 45 дней в минусе — банкротство).`);
      if (warn.length && !confirm(`${warn.join('\n\n')}\n\nВсё равно открыть?`)) break;
      const brand = el.dataset.brand;
      const brandId = brand === 'none' ? null : brand || undefined;
      const r = await app.dispatch({ type: 'openBusiness', lotId: el.dataset.lot, businessType: el.dataset.type, brandId: brandId ?? null });
      if (r.ok) app.select({ kind: 'unit', id: r.unitId });
      break;
    }
    case 'close':
      if (confirm('Закрыть бизнес? Запасы будут проданы, оборудование — за 30% стоимости.')) {
        await app.dispatch({ type: 'closeBusiness', unitId: id });
        app.select(null);
      }
      break;
    case 'priceStep': {
      const u = state.units[id];
      const p = el.dataset.product;
      app.dispatch({ type: 'setPrice', unitId: id, productId: p, price: Math.max(0.1, u.prices[p] + Number(el.dataset.step)) });
      break;
    }
    case 'staff':
      app.dispatch({ type: 'setStaff', unitId: id, staff: state.units[id].staff + Number(el.dataset.delta) });
      break;
    case 'upgrade':
      app.dispatch({ type: 'upgrade', unitId: id });
      break;
    case 'bulk': {
      const op = el.dataset.op;
      const unitIds = el.dataset.ids ? el.dataset.ids.split(',') : filteredUnits(app).map((u) => u.id);
      const ratio = op === 'priceNorm' ? Number(document.getElementById('bulk-ratio')?.value || 100) / 100 : undefined;
      if (op === 'close' && !confirm(`Закрыть бизнесов: ${unitIds.length}? Оборудование продаётся за 30% стоимости.`)) break;
      const r = await app.dispatch({ type: 'bulk', op, unitIds, ratio });
      if (r.ok) toast(r.done ? `Готово: ${r.done}${r.spent > 0 ? `, потрачено ${money(r.spent)}` : ''}` : 'Нечего менять', r.done ? 'good' : 'info');
      break;
    }
    case 'hireDirector':
      app.dispatch({ type: 'hireDirector', country: el.dataset.country });
      break;
    case 'fireDirector':
      if (confirm('Уволить регионального директора?')) app.dispatch({ type: 'fireDirector', country: el.dataset.country });
      break;
    case 'startResearch':
      app.dispatch({ type: 'startResearch', techId: id });
      break;
    case 'cancelResearch':
      if (confirm('Остановить исследование? Потраченные деньги не вернутся.')) app.dispatch({ type: 'cancelResearch' });
      break;
    case 'lobby': {
      if (!confirm('Потратить деньги на лоббирование? Успех не гарантирован.')) break;
      const r = await app.dispatch({ type: 'lobby', country: el.dataset.country, goal: el.dataset.goal });
      if (r.ok) toast(r.success ? 'Закон принят!' : 'Лоббирование не удалось', r.success ? 'good' : 'bad');
      break;
    }
    case 'answerOffer': {
      const accept = el.dataset.accept === '1';
      if (accept && !confirm('Принять предложение?')) break;
      const r = await app.dispatch({ type: 'answerOffer', offerId: Number(id), accept });
      if (r.ok && accept) toast('Сделка заключена', 'good');
      break;
    }
    case 'sellToRival': {
      if (!confirm('Продать бизнес корпорации?')) break;
      const r = await app.dispatch({ type: 'sellToRival', unitId: id, rivalId: document.getElementById(`sell-to-${id}`).value });
      if (r.ok) {
        toast(`Продано за ${money(r.price)}`, 'good');
        app.select(null);
      }
      break;
    }
    case 'buyRivalUnit':
      if (confirm('Выкупить этот бизнес у корпорации?')) {
        const r = await app.dispatch({ type: 'buyRivalUnit', unitId: id });
        if (r.ok) toast('Бизнес куплен', 'good');
      }
      break;
    case 'buyTruce':
      if (confirm('Заплатить корпорации за перемирие?')) app.dispatch({ type: 'buyTruce', rivalId: id });
      break;
    case 'renovate':
      app.dispatch({ type: 'renovate', unitId: id });
      break;
    case 'copySettings': {
      const r = await app.dispatch({ type: 'copySettings', unitId: id });
      if (r.ok) toast(`Настройки применены к ${r.count} бизнесам`);
      break;
    }
    case 'buyLot':
      app.dispatch({ type: 'buyLot', lotId: id });
      break;
    case 'sellLot':
      if (confirm('Продать помещение? Придётся снова платить аренду.')) app.dispatch({ type: 'sellLot', lotId: id });
      break;
    case 'takeLoan':
    case 'repayLoan': {
      const amount = Math.round(Number(document.getElementById('loan-amount').value));
      const r = await app.dispatch({ type: action, amount });
      if (r.ok) toast(action === 'takeLoan' ? 'Кредит получен' : 'Кредит погашен', 'good');
      break;
    }
    case 'setWage':
      app.dispatch({ type: 'setWage', unitId: id, level: Number(el.dataset.level) });
      break;
    case 'hireManager':
      app.dispatch({ type: 'hireManager', unitId: id });
      break;
    case 'fireManager':
      if (confirm('Уволить управляющего? Мораль сотрудников упадёт.')) app.dispatch({ type: 'fireManager', unitId: id });
      break;
    case 'signContract': {
      const r = await app.dispatch({ type: 'signContract', unitId: id, good: el.dataset.good, side: el.dataset.side, months: Number(el.dataset.months) });
      if (r.ok) toast('Контракт подписан', 'good');
      break;
    }
    case 'cancelContract':
      if (confirm(`Расторгнуть контракт досрочно? ${el.title}`)) app.dispatch({ type: 'cancelContract', contractId: Number(id) });
      break;
    case 'marketRegion':
      app.marketRegion = el.dataset.region;
      renderDrawer(app);
      break;
    case 'openTab':
      app.tab = el.dataset.tab;
      renderDrawer(app);
      break;
    case 'createBrand': {
      const businessType = document.getElementById('brand-type').value;
      const unitIds = document.getElementById('brand-all').checked
        ? Object.values(state.units).filter((u) => u.companyId === app.companyId && u.type === businessType && !u.brandId).map((u) => u.id)
        : [];
      const r = await app.dispatch({ type: 'createBrand', name: document.getElementById('brand-name').value, businessType, tier: document.getElementById('brand-tier').value, unitIds });
      if (r.ok) toast('Сеть создана', 'good');
      break;
    }
    case 'brandPrice': {
      const b = state.brands[id];
      const p = el.dataset.product;
      app.dispatch({ type: 'updateBrand', brandId: id, priceRatio: { [p]: Math.round(((b.priceRatio[p] ?? 1) + Number(el.dataset.step)) * 100) / 100 } });
      break;
    }
    case 'brandTier':
      app.dispatch({ type: 'updateBrand', brandId: id, tier: el.dataset.tier });
      break;
    case 'brandWage':
      app.dispatch({ type: 'updateBrand', brandId: id, wageLevel: Number(el.dataset.level) });
      break;
    case 'brandAddAll': {
      const b = state.brands[id];
      for (const u of Object.values(state.units)) {
        if (u.companyId === app.companyId && u.type === b.type && u.brandId !== id) await app.session.dispatch({ type: 'joinBrand', unitId: u.id, brandId: id });
      }
      render();
      break;
    }
    case 'deleteBrand':
      if (confirm('Распустить сеть? Точки станут отдельными (настройки сохранятся).')) app.dispatch({ type: 'deleteBrand', brandId: id });
      break;
    case 'setRoyalty':
      app.dispatch({ type: 'setRoyalty', brandId: id, royalty: Number(el.dataset.royalty) });
      break;
    case 'openFranchise': {
      const country = document.getElementById(`fr-country-${id}`).value;
      const r = await app.dispatch({ type: 'openFranchise', brandId: id, country });
      if (r.ok) toast('Франшиза выставлена на продажу', 'good');
      break;
    }
    case 'closeFranchise':
      if (confirm('Перестать продавать франшизу в этой стране? Франчайзи там закроются.')) app.dispatch({ type: 'closeFranchise', brandId: id, country: el.dataset.country });
      break;
    case 'ipo': {
      const share = Number(document.getElementById('ipo-share').value);
      if (!confirm(`Продать публике ${Math.round(share * 100)}% акций компании? Вернуть их можно только выкупом по рыночной цене.`)) break;
      const r = await app.dispatch({ type: 'ipo', share });
      if (r.ok) toast(`IPO состоялось: привлечено ${money(r.cash)}`, 'good');
      break;
    }
    case 'trade': {
      const l = state.stocks.listings[id];
      const amount = Number(document.getElementById('trade-amount').value);
      const side = Number(el.dataset.side);
      let qty = Math.floor(amount / l.price);
      if (side < 0) qty = Math.min(qty, l.holders[app.companyId] || 0);
      if (!(qty > 0)) {
        toast('Укажите сумму сделки', 'bad');
        break;
      }
      const r = await app.dispatch({ type: 'tradeShares', listingId: id, qty: side * qty });
      if (r.ok) toast(`${side > 0 ? 'Куплено' : 'Продано'} ${qty.toLocaleString('ru-RU')} акций «${l.name}» на ${money(Math.abs(r.total))}`, 'good');
      break;
    }
    case 'setPayout':
      app.dispatch({ type: 'setPayout', listingId: id, payout: Number(el.dataset.payout) });
      break;
    case 'absorb':
      if (confirm('Поглотить компанию? Вы выкупите акции остальных акционеров по рынку, а все её бизнесы, долги и деньги перейдут вам.')) {
        const r = await app.dispatch({ type: 'absorbCompany', targetId: id });
        if (r.ok) toast('Компания поглощена', 'good');
      }
      break;
    case 'hintOk':
      hideHint(el.dataset.tab);
      renderDrawer(app);
      break;
    case 'restartTutorial':
      restartTutorial();
      resetHints();
      app.tab = null;
      renderDrawer(app);
      renderTutorial(app);
      break;
    case 'copyCode':
      navigator.clipboard?.writeText(app.session.code).then(() => toast('Код скопирован'), () => {});
      break;
    default:
  }
}

function handleChange(el) {
  const { id } = el.dataset;
  switch (el.dataset.change) {
    case 'setPrice':
      app.dispatch({ type: 'setPrice', unitId: id, productId: el.dataset.product, price: Number(el.value) });
      break;
    case 'setMarketing':
      app.dispatch({ type: 'setMarketing', unitId: id, budget: Number(el.value) });
      break;
    case 'setSellMode':
      app.dispatch({ type: 'setSellMode', unitId: id, mode: el.value });
      break;
    case 'joinBrand':
      app.dispatch({ type: 'joinBrand', unitId: id, brandId: el.value || null });
      break;
    case 'brandAds':
      app.dispatch({ type: 'updateBrand', brandId: id, ads: { [el.dataset.channel]: Number(el.value) } });
      break;
    case 'setAds':
      app.dispatch({ type: 'setAds', unitId: id, channel: el.dataset.channel, budget: Number(el.value) });
      break;
    case 'brandNational':
      app.dispatch({ type: 'setBrandNational', brandId: id, country: el.dataset.country, budget: Number(el.value) });
      break;
    case 'unitFilter':
      app.unitFilter = { ...app.unitFilter, [el.dataset.key]: el.value || undefined };
      renderDrawer(app);
      break;
    case 'director':
      app.dispatch({ type: 'setDirector', country: el.dataset.country, [el.dataset.key]: el.checked });
      break;
    case 'directorRatio':
      app.dispatch({ type: 'setDirector', country: el.dataset.country, priceRatio: Number(el.value) / 100 });
      break;
    case 'setAutoRenew':
      app.dispatch({ type: 'setAutoRenew', brandId: id, on: el.checked });
      break;
    case 'setAutoStaff':
      app.dispatch({ type: 'setAutoStaff', unitId: id, on: el.checked });
      break;
    case 'setWarehouseCover':
      app.dispatch({ type: 'setWarehouseCover', unitId: id, days: Math.round(Number(el.value)) });
      break;
    default:
  }
}

function bindUi() {
  for (const root of [document.getElementById('panel'), document.getElementById('drawer')]) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      e.preventDefault();
      handleAction(el);
    });
    root.addEventListener('change', (e) => {
      if (e.target.dataset.change) {
        handleChange(e.target);
        e.target.blur();
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.dataset.change) e.target.blur();
    });
    root.addEventListener('submit', (e) => {
      if (e.target.id !== 'chat-form') return;
      e.preventDefault();
      const input = e.target.querySelector('input');
      if (input.value.trim()) app.sendChat(input.value);
      input.value = '';
    });
  }

  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map((t) => `<button data-tab="${t.id}" title="${t.name}"><span>${uiIcon(t.img, t.icon, 'nav')}</span><small>${t.name}</small><i class="nav-badge"></i></button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    app.tab = app.tab === b.dataset.tab ? null : b.dataset.tab;
    renderDrawer(app);
    renderTutorial(app);
  });

  const speed = document.getElementById('speed');
  speed.innerHTML = SPEEDS.map((s, i) => `<button data-speed="${i}" title="${s.title}">${s.icon}</button>`).join('');
  speed.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-speed]');
    if (b) setSpeed(Number(b.dataset.speed));
  });

  document.getElementById('btn-save').addEventListener('click', () => save());
  document.getElementById('btn-new').addEventListener('click', () => {
    const msg = app.session.multiplayer ? 'Выйти из комнаты? Вернуться можно по коду.' : 'Выйти в меню? Игра сохранится.';
    if (!confirm(msg)) return;
    save(true);
    showLobby();
  });
  document.getElementById('hud-room').addEventListener('click', () => {
    app.tab = 'room';
    renderDrawer(app);
  });
  document.getElementById('hud-company').addEventListener('click', () => {
    const name = prompt('Название компании', app.company.name);
    if (name) app.dispatch({ type: 'renameCompany', name });
  });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (document.getElementById('welcome').classList.contains('open')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const mine = app.session.multiplayer ? app.session.mySpeed() : app.session.speed;
      setSpeed(mine === 0 ? 1 : 0);
    } else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      setSpeed(Number(e.code.slice(-1)));
    } else if (e.key === 'Escape') {
      app.select(null);
    }
  });
}

// ---------- старт ----------
async function boot() {
  await loadIcons();
  // Пока открыто лобби, под ним показываем демо-мир (не сохраняется)
  app.session = new LocalSession(createGame({ seed: 1 }));
  bindUi();
  bindLobby();
  document.getElementById('tutorial').addEventListener('click', (e) => {
    if (e.target.closest('[data-tutorial="skip"]')) {
      skipTutorial();
      renderTutorial(app);
    }
    const a = e.target.closest('[data-advisor]');
    if (!a) return;
    if (a.dataset.advisor === 'open') {
      app.tab = a.dataset.tab;
      renderDrawer(app);
    }
    advisorAction(app, a.dataset.advisor);
  });
  document.getElementById('winner-close').addEventListener('click', () => document.getElementById('winner').classList.remove('open'));
  initMap(app);
  render();
  showLobby();
  requestAnimationFrame(loop);
  window.addEventListener('beforeunload', () => save(true));
}

boot();
