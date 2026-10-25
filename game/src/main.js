import { loadIcons, uiIcon } from './ui/icons.js';
import {
  createGame, formatDate, netWorth, newsFor, isOver, attention, companyAlerts, migrate, VICTORY_OPTIONS,
  lobbyCost, lobbyChance, offerText, bidForUnit, rivalUnitQuote, truceQuote, TRUCE_MONTHS,
  lotAtCell, makeCellLot, capexFor, entryFee, licenseNeeded, costIndex, cellBuildable, cellInfo, gridOf, equipmentCost,
} from './sim/index.js';
import { renderTutorial, restartTutorial, skipTutorial, advisorAction, hideHint, resetHints } from './ui/tutorial.js';
import { LocalSession, RemoteSession, SPEEDS, setDayScale } from './net/session.js';
import { initMap, refreshMap, refreshWarnings, resetMap, flyToDistrict, flyToLot } from './ui/map.js';
import { renderPanel } from './ui/panels.js';
import { renderDrawer, TABS, filteredUnits } from './ui/tabs.js';
import { openCity, closeCity, renderCity, startBuild, cancelBuild, cellFacts } from './ui/city.js';
import { money, moneyShort, signClass, esc, num } from './ui/format.js';
import { BUSINESSES, EQUIPMENT } from './data/businesses.js';
import { GOODS } from './data/goods.js';
import { play, toggleSound, soundOn, setVolume } from './ui/sound.js';

const SAVE_KEY = 'magnat-save-v3';

// Типизированный доступ к элементам формы (для проверки типов)
/** @param {string} id @returns {HTMLInputElement} */
const $in = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
/** @param {string} sel @returns {HTMLElement[]} */
const $all = (sel) => /** @type {HTMLElement[]} */ ([...document.querySelectorAll(sel)]);
/** @param {Event} e @returns {HTMLInputElement} */
const target = (e) => /** @type {HTMLInputElement} */ (e.target);
/** @param {Event} e @param {string} sel @returns {HTMLElement | null} */
const closestEl = (e, sel) => target(e).closest(sel);
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
    // на телефоне панель объекта и вкладка не помещаются вместе
    if (sel && window.innerWidth < 760 && app.tab) {
      app.tab = null;
      renderDrawer(app);
    }
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
  openCity(placeId) {
    openCity(app, placeId);
  },
  sendChat(text) {
    app.session.chat?.(text);
  },
};

// ---------- сохранения (соло) ----------
// Три слота; первый — по старому ключу, чтобы не потерять прежние сохранения
const SLOTS = [1, 2, 3];
const slotKey = (n) => (n === 1 ? SAVE_KEY : `${SAVE_KEY}:${n}`);
let slot = 1;

function save(silent = false) {
  if (!app.started || app.session.multiplayer) return;
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(app.state));
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

// Старые сохранения переводятся на текущую версию игры (см. sim/migrate.js)
function loadSolo(n = slot) {
  return migrate(readJson(slotKey(n)));
}

function freeSlot() {
  return SLOTS.find((n) => !loadSolo(n)) ?? null;
}

// Скачать текущую игру файлом
function exportSave() {
  if (app.session.multiplayer) return toast('В мультиплеере игра хранится на сервере', 'bad');
  const blob = new Blob([JSON.stringify(app.state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `magnat-${app.company.name.replace(/[^\wа-яё]+/gi, '_')}-${app.state.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importSave(file) {
  try {
    const s = migrate(JSON.parse(await file.text()));
    if (!s) throw new Error('Файл от слишком старой или неизвестной версии игры');
    slot = freeSlot() ?? 1;
    if (loadSolo(slot) && !(await ask({ title: 'Все слоты заняты', text: `Записать поверх слота ${slot}?`, ok: 'Записать', danger: true }))) return;
    localStorage.setItem(slotKey(slot), JSON.stringify(s));
    hideLobby();
    resumeSolo(s);
  } catch (err) {
    document.getElementById('lobby-error').textContent = `Не удалось загрузить: ${err.message}`;
  }
}

// ---------- HUD ----------
function renderHud() {
  const { state, session } = app;
  const co = app.company;
  const last = co.history.at(-1);
  document.getElementById('hud-company').textContent = co.name;
  document.getElementById('hud-company').style.borderLeft = `4px solid ${co.color}`;
  const cash = document.getElementById('hud-cash');
  tween('hud-cash', co.cash, (v) => money(v));
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
  $all('#speed button').forEach((b) => {
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
  document.querySelector('#nav button[data-tab="news"] .nav-badge').textContent = String(unread || '');
  /** @type {HTMLElement} */ (document.querySelector('#nav button[data-tab="room"]')).hidden = !session.multiplayer;
  const tasks = companyAlerts(state, app.companyId).filter((a) => a.kind !== 'contract').length;
  document.querySelector('#nav button[data-tab="tasks"] .nav-badge').textContent = String(tasks || '');
}

// На быстрой скорости дни идут часто. Если перерисовать панель между нажатием и отпусканием кнопки,
// кнопка заменится новой и клик пропадёт. Поэтому: пока кнопка зажата — не трогаем панели,
// а по таймеру дней рисуем их не чаще PANEL_MS (действия игрока рисуются сразу).
const PANEL_MS = 250;
let pressing = false;
let panelsPending = false;
let lastPanels = 0;
let panelsTimer = /** @type {any} */ (0);

function renderPanels(force) {
  if (pressing) {
    panelsPending = true;
    return;
  }
  const wait = PANEL_MS - (performance.now() - lastPanels);
  if (!force && wait > 0) {
    if (!panelsTimer) panelsTimer = setTimeout(() => {
      panelsTimer = 0;
      renderPanels(true);
    }, wait);
    return;
  }
  lastPanels = performance.now();
  panelsPending = false;
  const panel = document.getElementById('panel');
  const editing = panel.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName);
  if (!editing) renderPanel(app);
  renderDrawer(app);
  renderCity(app);
  renderTutorial(app);
}

function bindPress() {
  const zones = ['panel', 'drawer', 'city', 'tutorial'].map((id) => document.getElementById(id));
  window.addEventListener('pointerdown', (e) => {
    if (zones.some((z) => z?.contains(/** @type {Node} */ (e.target)))) pressing = true;
  }, true);
  const release = () => {
    if (!pressing) return;
    // отпускаем после того, как браузер доставит click
    setTimeout(() => {
      pressing = false;
      if (panelsPending) renderPanels(true);
    }, 0);
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
}

function render(force = true) {
  renderHud();
  checkWinner();
  renderPanels(force);
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
  play('win');
}

// ---------- настройки ----------
const SETTINGS_KEY = 'magnat-settings';
const settings = {
  volume: 0.8, dayScale: 1, uiScale: 1, noMotion: false, pauseBad: false, pauseOffer: true, pauseCash: true,
  ...(readJson(SETTINGS_KEY) || {}),
};

function applySettings() {
  setVolume(settings.volume);
  setDayScale(settings.dayScale);
  document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  /** @type {any} */ (document.body.style).zoom = settings.uiScale === 1 ? '' : String(settings.uiScale);
  document.body.classList.toggle('no-motion', settings.noMotion);
  writeJson(SETTINGS_KEY, settings);
}

function bindSettings() {
  const modal = document.getElementById('settings');
  const fields = { 'set-volume': 'volume', 'set-day': 'dayScale', 'set-scale': 'uiScale', 'set-motion': 'noMotion', 'set-pause-bad': 'pauseBad', 'set-pause-offer': 'pauseOffer', 'set-pause-cash': 'pauseCash' };
  const fill = () => {
    $in('set-volume').value = String(Math.round(settings.volume * 100));
    $in('set-day').value = String(settings.dayScale);
    $in('set-scale').value = String(settings.uiScale);
    for (const [id, k] of Object.entries(fields)) if (typeof settings[k] === 'boolean') $in(id).checked = settings[k];
  };
  document.getElementById('btn-settings').addEventListener('click', () => {
    fill();
    modal.classList.add('open');
  });
  document.getElementById('settings-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('change', (e) => {
    const k = fields[target(e).id];
    if (!k) return;
    const el = target(e);
    settings[k] = el.type === 'checkbox' ? el.checked : k === 'volume' ? Number(el.value) / 100 : Number(el.value);
    applySettings();
  });
  document.getElementById('set-export').addEventListener('click', exportSave);
  applySettings();
}

// ---------- анимации ----------
// Прибыль месяца всплывает над кассой
function floatMoney(amount) {
  const anchor = document.getElementById('hud-cash').getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `fx-money ${amount >= 0 ? 'pos' : 'neg'}`;
  el.textContent = `${amount >= 0 ? '+' : '−'}${moneyShort(Math.abs(amount))}`;
  el.style.left = `${anchor.left}px`;
  el.style.top = `${anchor.bottom}px`;
  document.getElementById('fx').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// Плавный счётчик денег в шапке
const shown = {};
function tween(id, value, format) {
  const el = document.getElementById(id);
  const from = shown[id] ?? value;
  shown[id] = value;
  if (Math.abs(value - from) < 1 || Math.abs(value - from) > Math.abs(from) * 5 + 1e6) {
    el.textContent = format(value);
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 400);
    el.textContent = format(from + (value - from) * (1 - (1 - k) ** 3));
    if (k < 1 && shown[id] === value) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- окна подтверждения (вместо системных confirm/prompt браузера) ----------
// ask({ title, text, parts, ok, danger }) → true/false; parts — строки «что влияет на цену»
let dialogDone = null;
function openDialog({ title, text = '', parts = null, ok = 'Да', cancel = 'Отмена', danger = false, input = null }) {
  const box = document.getElementById('dialog');
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-body').innerHTML = `${text ? `<p>${text.split('\n').filter(Boolean).map(esc).join('</p><p>')}</p>` : ''}${parts?.length
    ? `<div class="dialog-parts">${parts.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>` : ''}`;
  const inp = $in('dialog-input');
  inp.hidden = input === null;
  inp.value = input ?? '';
  const okBtn = document.getElementById('dialog-ok');
  okBtn.textContent = ok;
  okBtn.className = `btn ${danger ? 'danger' : ''}`;
  document.getElementById('dialog-cancel').textContent = cancel;
  box.classList.add('open');
  setTimeout(() => (input !== null ? inp : okBtn).focus(), 30);
  return new Promise((resolve) => {
    dialogDone = (v) => {
      box.classList.remove('open');
      dialogDone = null;
      resolve(v);
    };
  });
}
const ask = (opts) => openDialog(opts).then((v) => v !== null);
const askText = (title, value) => openDialog({ title, input: value, ok: 'Сохранить' });

function bindDialog() {
  document.getElementById('dialog-form').addEventListener('submit', (e) => {
    e.preventDefault();
    dialogDone?.($in('dialog-input').hidden ? '' : $in('dialog-input').value);
  });
  document.getElementById('dialog-cancel').addEventListener('click', () => dialogDone?.(null));
  document.getElementById('dialog').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) dialogDone?.(null);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialogDone) dialogDone(null);
  });
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
    // пауза по важным событиям (настройки)
    const stop = fresh.find((x) => (settings.pauseBad && x.kind === 'bad') || (settings.pauseOffer && x.text.startsWith('📨'))
      || (settings.pauseCash && x.text.startsWith('Касса ушла в минус')));
    const mine = app.session.multiplayer ? app.session.mySpeed() : app.session.speed;
    if (stop && mine !== 0) {
      setSpeed(0);
      toast(`⏸ Пауза: ${stop.text}`, stop.kind === 'good' ? 'good' : 'warn');
    }
    play(n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : 'click');
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
  render(false);
  refreshWarnings(app);
  const months = app.company.history.length;
  if (months !== lastMonths) {
    lastMonths = months;
    save(true);
    const h = app.company.history.at(-1);
    if (h) {
      floatMoney(h.profit);
      play(h.profit >= 0 ? 'month' : 'bad');
    }
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
  slot = freeSlot() ?? 1;
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
  $all('#lobby-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === lobbyMode));
  document.getElementById('lobby-desc').textContent = cfg.desc;
  $all('#lobby-form [data-field]').forEach((el) => (el.hidden = !cfg.fields.includes(el.dataset.field)));
  document.getElementById('lobby-submit').textContent = cfg.submit;
  const resume = [];
  for (const n of SLOTS) {
    const s = loadSolo(n);
    if (!s) continue;
    const co = Object.values(s.companies).find((c) => !c.ai);
    resume.push(`<div class="slot"><button type="button" class="btn ghost" data-resume="solo" data-slot="${n}">▶ ${esc(co?.name ?? 'Игра')} · ${formatDate(s.day)}${co?.history?.length ? ` · ${moneyShort(co.history.at(-1).netWorth)}` : ''}</button>
      <button type="button" class="mini" data-delete-slot="${n}" title="Удалить сохранение">🗑</button></div>`);
  }
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
  $in('lobby-player').value = mp?.name || '';
  $in('lobby-company').value = 'Bean & Co';
  document.getElementById('lobby-victory').innerHTML = VICTORY_OPTIONS.map((v) => `<option value="${v.id}" ${v.id === 'worth1m' ? 'selected' : ''}>${v.name}</option>`).join('');
  document.getElementById('lobby-tabs').addEventListener('click', (e) => {
    const b = closestEl(e, 'button[data-mode]');
    if (!b) return;
    lobbyMode = b.dataset.mode;
    document.getElementById('lobby-error').textContent = '';
    renderLobby();
  });
  document.getElementById('lobby-resume').addEventListener('click', async (e) => {
    const del = closestEl(e, '[data-delete-slot]');
    if (del) {
      if (await ask({ title: 'Удалить сохранение?', text: 'Сохранение удалится навсегда.', ok: 'Удалить', danger: true })) {
        localStorage.removeItem(slotKey(Number(del.dataset.deleteSlot)));
        renderLobby();
      }
      return;
    }
    const b = closestEl(e, '[data-resume]');
    if (!b) return;
    if (b.dataset.resume === 'solo') {
      slot = Number(b.dataset.slot) || 1;
      hideLobby();
      resumeSolo(loadSolo(slot));
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
    const name = $in('lobby-player').value.trim();
    const companyName = $in('lobby-company').value.trim();
    const code = $in('lobby-code').value.trim().toUpperCase();
    const errorEl = document.getElementById('lobby-error');
    errorEl.textContent = '';
    if (lobbyMode === 'solo') {
      if (!freeSlot() && !(await ask({ title: 'Все три слота заняты', text: 'Начать новую игру поверх слота 1?', ok: 'Начать', danger: true }))) return;
      hideLobby();
      startSolo(companyName);
      return;
    }
    if (!name) {
      errorEl.textContent = 'Введите имя — его увидят другие игроки';
      return;
    }
    const victory = $in('lobby-victory').value;
    const hello = lobbyMode === 'join' ? { t: 'join', code, name, companyName } : { t: 'create', mode: lobbyMode, name, companyName, victory };
    if (lobbyMode === 'join' && !/^[A-Z0-9]{5}$/.test(code)) {
      errorEl.textContent = 'Код комнаты — 5 символов';
      return;
    }
    const btn = /** @type {HTMLButtonElement} */ (document.getElementById('lobby-submit'));
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
      const cell = el.dataset.place ? { placeId: el.dataset.place, cell: [Number(el.dataset.x), Number(el.dataset.y)] } : { lotId: el.dataset.lot };
      await confirmBuild(cell, el.dataset.type, el.dataset.recipe || undefined);
      break;
    }
    case 'openCity':
      openCity(app, id);
      break;
    case 'close':
      if (await ask({ title: `Закрыть «${state.units[id]?.name}»?`, text: 'Запасы будут проданы, оборудование — за 30% стоимости.', ok: 'Закрыть', danger: true })) {
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
    case 'buyEquipment': {
      const u = state.units[id];
      const level = Number(el.dataset.level);
      const cost = equipmentCost(state, u, level);
      if (await ask({ title: `${EQUIPMENT[level - 1].name} оборудование`, text: `«${u.name}»: новое оборудование поднимет мощность и качество. Старое уходит в зачёт.`, parts: [['Стоимость', money(cost)]], ok: `Купить · ${moneyShort(cost)}` })) {
        app.dispatch({ type: 'buyEquipment', unitId: id, level });
      }
      break;
    }
    case 'brandGrade': {
      // класс закупки для всех основных товаров сети
      const b = state.brands[id];
      const goods = new Set((BUSINESSES[b.type].retail?.products || []).flatMap((p) => Object.keys(p.recipe)));
      for (const good of goods) await app.session.dispatch({ type: 'setGrade', brandId: id, good, grade: el.dataset.grade });
      render();
      break;
    }
    case 'unitTab':
      app.unitTab = el.dataset.tab;
      renderPanel(app);
      break;
    case 'bulk': {
      const op = el.dataset.op;
      const unitIds = el.dataset.ids ? el.dataset.ids.split(',') : filteredUnits(app).map((u) => u.id);
      const ratio = op === 'priceNorm' ? Number($in('bulk-ratio')?.value || 100) / 100 : undefined;
      if (op === 'close' && !(await ask({ title: `Закрыть бизнесов: ${unitIds.length}?`, text: 'Оборудование продаётся за 30% стоимости.', ok: 'Закрыть', danger: true }))) break;
      const r = await app.dispatch({ type: 'bulk', op, unitIds, ratio });
      if (r.ok) toast(r.done ? `Готово: ${r.done}${r.spent > 0 ? `, потрачено ${money(r.spent)}` : ''}` : 'Нечего менять', r.done ? 'good' : 'info');
      break;
    }
    case 'hireDirector':
      app.dispatch({ type: 'hireDirector', country: el.dataset.country });
      break;
    case 'fireDirector':
      if (await ask({ title: 'Уволить регионального директора?', ok: 'Уволить', danger: true })) app.dispatch({ type: 'fireDirector', country: el.dataset.country });
      break;
    case 'startResearch':
      app.dispatch({ type: 'startResearch', techId: id });
      break;
    case 'cancelResearch':
      if (await ask({ title: 'Остановить исследование?', text: 'Потраченные деньги не вернутся.', ok: 'Остановить', danger: true })) app.dispatch({ type: 'cancelResearch' });
      break;
    case 'lobby': {
      if (!(await ask({ title: 'Лоббирование', text: `Стоимость: ${money(lobbyCost(state, el.dataset.country))}. Шанс успеха: ${Math.round(lobbyChance(state, app.companyId, el.dataset.country) * 100)}%. Деньги не вернутся, даже если закон не пройдёт.`, ok: 'Лоббировать' }))) break;
      const r = await app.dispatch({ type: 'lobby', country: el.dataset.country, goal: el.dataset.goal });
      if (r.ok) toast(r.success ? 'Закон принят!' : 'Лоббирование не удалось', r.success ? 'good' : 'bad');
      break;
    }
    case 'answerOffer': {
      const accept = el.dataset.accept === '1';
      const offer = (state.offers || []).find((o) => o.id === Number(id));
      if (accept && !(await ask({ title: 'Принять предложение?', text: offer ? offerText(state, offer) : '', ok: 'Принять' }))) break;
      const r = await app.dispatch({ type: 'answerOffer', offerId: Number(id), accept });
      if (r.ok && accept) toast('Сделка заключена', 'good');
      break;
    }
    case 'sellToRival': {
      if (!(await ask({ title: `Продать «${state.units[id]?.name}»?`, text: `Корпорация «${state.companies[$in(`sell-to-${id}`).value]?.name}» заплатит около ${money(bidForUnit(state, state.units[id]))}: оборудование и два года прибыли точки, с поправкой на экономику страны и настроение рынка.`, ok: 'Продать' }))) break;
      const r = await app.dispatch({ type: 'sellToRival', unitId: id, rivalId: $in(`sell-to-${id}`).value });
      if (r.ok) {
        toast(`Продано за ${money(r.price)}`, 'good');
        app.select(null);
      }
      break;
    }
    case 'buyRivalUnit': {
      const q = rivalUnitQuote(state, state.units[id]);
      if (await ask({ title: `Выкупить «${state.units[id]?.name}»?`, text: `Цена сделки: ${money(q.price)}. Из чего она складывается:`, parts: q.parts, ok: `Выкупить за ${moneyShort(q.price)}` })) {
        const r = await app.dispatch({ type: 'buyRivalUnit', unitId: id });
        if (r.ok) toast('Бизнес куплен', 'good');
      }
      break;
    }
    case 'buyTruce': {
      const rival = state.companies[id];
      const q = truceQuote(state, rival, app.companyId);
      if (await ask({ title: `Перемирие с «${rival.name}»`, text: `${TRUCE_MONTHS} месяцев корпорация не открывается в ваших городах, не выкупает ваши помещения и акции.\nЦена: ${money(q.price)}. Из чего она складывается:`, parts: q.parts, ok: `Заплатить ${moneyShort(q.price)}` })) app.dispatch({ type: 'buyTruce', rivalId: id });
      break;
    }
    case 'saveTemplate': {
      const name = await askText('Название шаблона', `Как «${state.units[id].name}»`);
      if (name === null) break;
      const r = await app.dispatch({ type: 'saveTemplate', unitId: id, name });
      if (r.ok) toast('Шаблон сохранён: он появится на карточках участков для этого типа бизнеса', 'good');
      break;
    }
    case 'trainStaff':
      app.dispatch({ type: 'trainStaff', unitId: id });
      break;
    case 'releaseStar':
      if (await ask({ title: 'Отпустить звёздного сотрудника?', ok: 'Отпустить', danger: true })) app.dispatch({ type: 'releaseStar', unitId: id });
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
      if (await ask({ title: 'Продать помещение?', text: 'Придётся снова платить аренду.', ok: 'Продать' })) app.dispatch({ type: 'sellLot', lotId: id });
      break;
    case 'takeLoan':
    case 'repayLoan': {
      const amount = Math.round(Number($in('loan-amount').value));
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
      if (await ask({ title: 'Уволить управляющего?', text: 'Мораль сотрудников упадёт.', ok: 'Уволить', danger: true })) app.dispatch({ type: 'fireManager', unitId: id });
      break;
    case 'signContract': {
      const r = await app.dispatch({ type: 'signContract', unitId: id, good: el.dataset.good, side: el.dataset.side, months: Number(el.dataset.months) });
      if (r.ok) toast('Контракт подписан', 'good');
      break;
    }
    case 'cancelContract':
      if (await ask({ title: 'Расторгнуть контракт досрочно?', text: el.title, ok: 'Расторгнуть', danger: true })) app.dispatch({ type: 'cancelContract', contractId: Number(id) });
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
      const businessType = $in('brand-type').value;
      const unitIds = $in('brand-all').checked
        ? Object.values(state.units).filter((u) => u.companyId === app.companyId && u.type === businessType && !u.brandId).map((u) => u.id)
        : [];
      const r = await app.dispatch({ type: 'createBrand', name: $in('brand-name').value, businessType, tier: $in('brand-tier').value, unitIds });
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
      if (await ask({ title: 'Распустить сеть?', text: 'Точки станут отдельными (настройки сохранятся).', ok: 'Распустить', danger: true })) app.dispatch({ type: 'deleteBrand', brandId: id });
      break;
    case 'setRoyalty':
      app.dispatch({ type: 'setRoyalty', brandId: id, royalty: Number(el.dataset.royalty) });
      break;
    case 'openFranchise': {
      const country = $in(`fr-country-${id}`).value;
      const r = await app.dispatch({ type: 'openFranchise', brandId: id, country });
      if (r.ok) toast('Франшиза выставлена на продажу', 'good');
      break;
    }
    case 'closeFranchise':
      if (await ask({ title: 'Закрыть франшизу в стране?', text: 'Франчайзи там закроются.', ok: 'Закрыть', danger: true })) app.dispatch({ type: 'closeFranchise', brandId: id, country: el.dataset.country });
      break;
    case 'ipo': {
      const share = Number($in('ipo-share').value);
      if (!(await ask({ title: `IPO: продать ${Math.round(share * 100)}% акций?`, text: 'Вернуть их можно только выкупом по рыночной цене.', ok: 'Выйти на биржу' }))) break;
      const r = await app.dispatch({ type: 'ipo', share });
      if (r.ok) toast(`IPO состоялось: привлечено ${money(r.cash)}`, 'good');
      break;
    }
    case 'trade': {
      const l = state.stocks.listings[id];
      const amount = Number($in('trade-amount').value);
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
      if (await ask({ title: 'Поглотить компанию?', text: 'Вы выкупите акции остальных акционеров по рынку, а все её бизнесы, долги и деньги перейдут вам.', ok: 'Поглотить' })) {
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
    case 'setRecipe':
      app.dispatch({ type: 'setRecipe', unitId: id, recipe: el.value });
      break;
    case 'setGrade':
      app.dispatch({ type: 'setGrade', unitId: id, good: el.dataset.good, grade: el.value });
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
    case 'rules': {
      const k = el.dataset.key;
      const value = k === 'reserve' || k === 'closeAfter' ? Number(el.value) : /** @type {HTMLInputElement} */ (el).checked;
      app.dispatch({ type: 'setRules', [k]: value });
      break;
    }
    case 'setDelivery':
      app.dispatch({ type: 'setDelivery', unitId: id, mode: el.value });
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

// Постройка: окно с фактами (вложения, аренда, зарплаты, содержание) — без прогноза прибыли
async function confirmBuild(where, type, recipe) {
  const { state } = app;
  const def = BUSINESSES[type];
  let lot = where.lotId ? state.world.lots[where.lotId] : null;
  const place = state.world.places[lot ? lot.placeId : where.placeId];
  if (!lot) lot = lotAtCell(state, place, ...where.cell) || makeCellLot(state, place, ...where.cell, type);
  const capex = capexFor(state, lot, type);
  const fee = entryFee(state, app.companyId, place, type);
  const lic = licenseNeeded(state, app.companyId, place, type);
  const wages = def.staff.def * def.staff.wage * place.wage;
  const upkeep = (def.upkeep.base + def.upkeep.perArea * lot.area) * costIndex(place);
  const monthly = wages + upkeep + (lot.ownerId === app.companyId ? 0 : lot.rent);
  const total = capex + fee + (lic?.cost ?? 0);
  const parts = [['Площадь', `${num(lot.area)} ${lot.zoning === 'farmland' ? 'га' : 'м²'}`], ['Строительство и оборудование', money(capex)]];
  if (fee) parts.push(['Выход на рынок страны', money(fee)]);
  if (lic) parts.push([lic.name, money(lic.cost)]);
  parts.push(['Аренда', `${money(lot.ownerId === app.companyId ? 0 : lot.rent)}/мес`], [`Зарплаты (${def.staff.def} чел.)`, `${money(wages)}/мес`], ['Содержание', `${money(upkeep)}/мес`]);
  if (recipe) parts.push(['Продукция', `${GOODS[recipe].icon} ${GOODS[recipe].name}`]);
  const left = app.company.cash - total;
  const text = `${esc(place.name)}. Всего к оплате: ${money(total)}.${left < monthly ? `\nПосле этого в кассе останется ${money(left)} — меньше месячных расходов (${money(monthly)}).` : ''}`;
  if (!(await ask({ title: `Построить «${def.name}»?`, text, parts, ok: `Построить · ${moneyShort(total)}` }))) return false;
  const r = await app.dispatch({ type: 'openBusiness', ...where, businessType: type, recipe });
  if (r.ok) {
    play('coin');
    app.select({ kind: 'unit', id: r.unitId });
    renderCity(app, true);
  }
  return r.ok;
}

// Экран города: клики по клеткам, подсказки, меню «Построить»
function bindCity() {
  const root = document.getElementById('city');
  const cellAt = (e) => {
    const r = /** @type {any} */ (closestEl(e, 'rect[data-x]'));
    if (r) return [Number(r.dataset.x), Number(r.dataset.y)];
    const svg = /** @type {any} */ (closestEl(e, 'svg'));
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = /** @type {MouseEvent} */ (e).clientX;
    pt.y = /** @type {MouseEvent} */ (e).clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.floor(p.x), Math.floor(p.y)];
  };
  root.addEventListener('click', async (e) => {
    const b = closestEl(e, '[data-city]');
    if (b) {
      const what = b.dataset.city;
      if (what === 'close') closeCity(app);
      else if (what === 'menu') {
        app.city.menu = !app.city.menu;
        renderCity(app, true);
      } else if (what === 'build') {
        if (!b.classList.contains('locked')) startBuild(app, b.dataset.type);
      } else if (what === 'cancel') cancelBuild(app);
      return;
    }
    const act = closestEl(e, '[data-action]');
    if (act) return handleAction(act);
    if (!closestEl(e, '#city-svg')) return;
    const place = app.state.world.places[app.city.placeId];
    const c = cellAt(e);
    if (!c) return;
    const [x, y] = c;
    if (app.city.build) {
      const why = cellBuildable(app.state, place, x, y, app.city.build);
      if (why) return toast(why, 'bad');
      const ok = await confirmBuild({ placeId: place.id, cell: [x, y] }, app.city.build, app.city.recipe || undefined);
      if (ok) cancelBuild(app);
      return;
    }
    const lot = lotAtCell(app.state, place, x, y);
    if (lot?.unitId) app.select({ kind: 'unit', id: lot.unitId });
    else if (cellInfo(app.state, place, x, y).land) app.select({ kind: 'cell', placeId: place.id, x, y });
    renderCity(app, true);
  });
  root.addEventListener('change', (e) => {
    if (target(e).matches('[data-city-recipe]')) app.city.recipe = target(e).value;
  });
  root.addEventListener('mousemove', (e) => {
    const tip = document.getElementById('city-tip');
    if (!tip || !app.city) return;
    const c = closestEl(e, '#city-svg') ? cellAt(e) : null;
    const place = app.state.world.places[app.city.placeId];
    const { n } = gridOf(place);
    if (!c || c[0] < 0 || c[1] < 0 || c[0] >= n || c[1] >= n) {
      tip.hidden = true;
      return;
    }
    const key = `${c[0]}|${c[1]}|${app.city.build}`;
    if (tip.dataset.key !== key) {
      const f = cellFacts(app, place, c[0], c[1], app.city.build);
      tip.innerHTML = `<b>${esc(f.title)}</b>${f.rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('')}`;
      tip.dataset.key = key;
    }
    tip.hidden = false;
    const me = /** @type {MouseEvent} */ (e);
    const left = Math.min(me.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
    const top = Math.min(me.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  root.addEventListener('mouseleave', () => {
    const tip = document.getElementById('city-tip');
    if (tip) tip.hidden = true;
  });
}

// Дерево исследований листается перетаскиванием (клик по узлу без сдвига — начать исследование)
function bindTreeDrag(drawer) {
  let drag = null;
  let dragEnded = 0;
  // клик сразу после перетаскивания не считается
  drawer.addEventListener('click', (ev) => {
    if (performance.now() - dragEnded < 250) ev.stopPropagation();
  }, true);
  drawer.addEventListener('pointerdown', (e) => {
    const tree = /** @type {HTMLElement|null} */ (closestEl(e, '#tech-tree'));
    if (!tree || e.button !== 0) return;
    drag = { tree, x: e.clientX, y: e.clientY, left: tree.scrollLeft, top: tree.scrollTop, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    drag.tree.classList.add('dragging');
    drag.tree.scrollLeft = drag.left - dx;
    drag.tree.scrollTop = drag.top - dy;
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) {
      dragEnded = performance.now();
      drag.tree.classList.remove('dragging');
    }
    drag = null;
  });
}

function bindUi() {
  bindTreeDrag(document.getElementById('drawer'));
  for (const root of [document.getElementById('panel'), document.getElementById('drawer')]) {
    root.addEventListener('click', (e) => {
      const el = closestEl(e, '[data-action]');
      if (!el || !root.contains(el)) return;
      e.preventDefault();
      handleAction(el);
    });
    root.addEventListener('change', (e) => {
      if (target(e).dataset.change) {
        target(e).blur(); // сначала снять фокус: иначе панель не перерисуется после изменения
        handleChange(e.target);
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && target(e).dataset.change) target(e).blur();
    });
    root.addEventListener('submit', (e) => {
      if (target(e).id !== 'chat-form') return;
      e.preventDefault();
      const input = target(e).querySelector('input');
      if (input.value.trim()) app.sendChat(input.value);
      input.value = '';
    });
  }

  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map((t) => `<button data-tab="${t.id}" title="${t.name}"><span>${uiIcon(t.img, t.icon, 'nav')}</span><small>${t.name}</small><i class="nav-badge"></i></button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = closestEl(e, 'button[data-tab]');
    if (!b) return;
    app.tab = app.tab === b.dataset.tab ? null : b.dataset.tab;
    renderDrawer(app);
    renderTutorial(app);
  });

  const speed = document.getElementById('speed');
  speed.innerHTML = SPEEDS.map((s, i) => `<button data-speed="${i}" title="${s.title}">${s.icon}</button>`).join('');
  speed.addEventListener('click', (e) => {
    const b = closestEl(e, 'button[data-speed]');
    if (b) setSpeed(Number(b.dataset.speed));
  });

  document.getElementById('btn-save').addEventListener('click', () => save());
  const soundBtn = document.getElementById('btn-sound');
  soundBtn.textContent = soundOn() ? '🔊' : '🔇';
  soundBtn.addEventListener('click', () => (soundBtn.textContent = toggleSound() ? '🔊' : '🔇'));
  document.getElementById('btn-new').addEventListener('click', async () => {
    const msg = app.session.multiplayer ? 'Вернуться можно по коду комнаты.' : 'Игра сохранится.';
    if (!(await ask({ title: app.session.multiplayer ? 'Выйти из комнаты?' : 'Выйти в меню?', text: msg, ok: 'Выйти' }))) return;
    save(true);
    showLobby();
  });
  document.getElementById('hud-room').addEventListener('click', () => {
    app.tab = 'room';
    renderDrawer(app);
  });
  document.getElementById('hud-company').addEventListener('click', async () => {
    const name = await askText('Название компании', app.company.name);
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
      if (dialogDone) return;
      if (cancelBuild(app)) return; // сначала — выйти из режима стройки
      if (app.selection) app.select(null);
      else if (app.city) closeCity(app);
    }
  });
}

// ---------- старт ----------
async function boot() {
  await loadIcons();
  // Пока открыто лобби, под ним показываем демо-мир (не сохраняется)
  app.session = new LocalSession(createGame({ seed: 1 }));
  bindUi();
  bindPress();
  bindDialog();
  bindCity();
  bindLobby();
  bindSettings();
  document.getElementById('lobby-import').addEventListener('change', (e) => {
    const f = target(e).files?.[0];
    if (f) importSave(f);
    target(e).value = '';
  });
  document.getElementById('tutorial').addEventListener('click', (e) => {
    if (closestEl(e, '[data-tutorial="skip"]')) {
      skipTutorial();
      renderTutorial(app);
    }
    const a = closestEl(e, '[data-advisor]');
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
