import { createGame, stepDay, applyCommand, formatDate, netWorth, SAVE_VERSION } from './sim/index.js';
import { initMap, refreshMap, refreshWarnings, flyToDistrict, flyToLot } from './ui/map.js';
import { renderPanel } from './ui/panels.js';
import { renderDrawer, TABS } from './ui/tabs.js';
import { money, moneyShort, signClass } from './ui/format.js';

const SAVE_KEY = 'magnat-save-v1';
// Длительность игрового дня в мс для каждой скорости
const SPEEDS = [
  { ms: Infinity, icon: '⏸', title: 'Пауза (пробел)' },
  { ms: 1500, icon: '▶', title: 'Обычная скорость (1)' },
  { ms: 500, icon: '⏩', title: 'Быстро (2)' },
  { ms: 120, icon: '⏭', title: 'Очень быстро (3)' },
];

const app = {
  state: null,
  started: false, // false, пока игрок не начал игру (не сохраняем демо-мир под приветствием)
  speed: 0,
  selection: null,
  tab: null,
  select(sel) {
    app.selection = sel;
    renderPanel(app);
    refreshMap(app, true);
  },
  dispatch(cmd) {
    const r = applyCommand(app.state, cmd);
    if (!r.ok) toast(r.error, 'bad');
    render();
    refreshMap(app, true);
    return r;
  },
};

// ---------- сохранения ----------
function save(silent = false) {
  if (!app.started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.state));
    if (!silent) toast('Игра сохранена');
  } catch {
    if (!silent) toast('Не удалось сохранить (хранилище браузера недоступно)', 'bad');
  }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

// ---------- HUD ----------
function renderHud() {
  const { state } = app;
  const co = state.company;
  const last = co.history.at(-1);
  document.getElementById('hud-company').textContent = co.name;
  const cash = document.getElementById('hud-cash');
  cash.textContent = money(co.cash);
  cash.className = co.cash < 0 ? 'neg' : '';
  document.getElementById('hud-worth').textContent = moneyShort(netWorth(state));
  const profit = document.getElementById('hud-profit');
  profit.textContent = last ? moneyShort(last.profit) : '—';
  profit.className = last ? signClass(last.profit) : '';
  document.getElementById('hud-date').textContent = formatDate(state.day);
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === app.speed));
  const unread = state.news.filter((n) => n.day >= state.day - 7 && (n.kind === 'bad' || n.kind === 'warn')).length;
  const badge = document.querySelector('#nav button[data-tab="news"] .nav-badge');
  badge.textContent = unread || '';
}

function render() {
  renderHud();
  const panel = document.getElementById('panel');
  const editing = (el) => el.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName);
  if (!editing(panel)) renderPanel(app);
  renderDrawer(app);
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

let lastNewsCount = 0;
function announceNews() {
  const news = app.state.news;
  const fresh = news.length - lastNewsCount;
  if (fresh > 0 && lastNewsCount > 0) {
    const n = news[0];
    if (n.kind === 'bad' || n.kind === 'warn' || n.kind === 'good') toast(n.text, n.kind);
  }
  lastNewsCount = news.length;
}

// ---------- игровой цикл ----------
let acc = 0;
let prev = performance.now();
function loop(now) {
  const dt = Math.min(now - prev, 1000);
  prev = now;
  const speed = SPEEDS[app.speed];
  if (Number.isFinite(speed.ms) && !app.state.company.bankrupt) {
    acc += dt;
    let steps = 0;
    while (acc >= speed.ms && steps < 5) {
      const months = app.state.company.history.length;
      stepDay(app.state);
      acc -= speed.ms;
      steps++;
      if (app.state.company.history.length !== months) save(true);
    }
    if (steps) {
      announceNews();
      render();
      refreshWarnings(app);
      if (app.state.company.bankrupt) setSpeed(0);
    }
  }
  requestAnimationFrame(loop);
}

function setSpeed(i) {
  app.speed = i;
  acc = 0;
  renderHud();
}

// ---------- обработка действий ----------
function handleAction(el) {
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
      const r = app.dispatch({ type: 'openBusiness', lotId: el.dataset.lot, businessType: el.dataset.type });
      if (r.ok) app.select({ kind: 'unit', id: r.unitId });
      break;
    }
    case 'close':
      if (confirm('Закрыть бизнес? Запасы будут проданы, оборудование — за 30% стоимости.')) {
        app.dispatch({ type: 'closeBusiness', unitId: id });
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
    case 'copySettings': {
      const r = app.dispatch({ type: 'copySettings', unitId: id });
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
      const r = app.dispatch({ type: action, amount });
      if (r.ok) toast(action === 'takeLoan' ? 'Кредит получен' : 'Кредит погашен', 'good');
      break;
    }
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
  }

  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map((t) => `<button data-tab="${t.id}" title="${t.name}"><span>${t.icon}</span><small>${t.name}</small><i class="nav-badge"></i></button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    app.tab = app.tab === b.dataset.tab ? null : b.dataset.tab;
    renderDrawer(app);
  });

  const speed = document.getElementById('speed');
  speed.innerHTML = SPEEDS.map((s, i) => `<button data-speed="${i}" title="${s.title}">${s.icon}</button>`).join('');
  speed.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-speed]');
    if (b) setSpeed(Number(b.dataset.speed));
  });

  document.getElementById('btn-save').addEventListener('click', () => save());
  document.getElementById('btn-new').addEventListener('click', () => {
    if (confirm('Начать новую игру? Текущий прогресс будет потерян.')) showWelcome();
  });
  document.getElementById('hud-company').addEventListener('click', () => {
    const name = prompt('Название компании', app.state.company.name);
    if (name) app.dispatch({ type: 'renameCompany', name });
  });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setSpeed(app.speed === 0 ? 1 : 0);
    } else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      setSpeed(Number(e.code.slice(-1)));
    } else if (e.key === 'Escape') {
      app.select(null);
    }
  });
}

// ---------- старт ----------
function showWelcome() {
  setSpeed(0);
  const modal = document.getElementById('welcome');
  modal.classList.add('open');
  const input = document.getElementById('welcome-name');
  input.value = 'Bean & Co';
  input.focus();
  input.select();
}

function startNewGame(name) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  app.state = createGame({ seed, companyName: name || 'Моя компания' });
  app.selection = null;
  app.tab = 'help';
  app.started = true;
  lastNewsCount = 0;
  save(true);
  refreshMap(app, true);
  render();
  setSpeed(1);
}

function boot() {
  app.state = load();
  bindUi();
  document.getElementById('welcome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('welcome').classList.remove('open');
    startNewGame(document.getElementById('welcome-name').value.trim());
  });
  if (!app.state) {
    app.state = createGame({ seed: 1, companyName: 'Моя компания' });
    initMap(app);
    render();
    showWelcome();
  } else {
    app.started = true;
    initMap(app);
    lastNewsCount = app.state.news.length;
    render();
    toast(`С возвращением, ${app.state.company.name}! Игра на паузе.`);
  }
  requestAnimationFrame(loop);
  window.addEventListener('beforeunload', () => save(true));
}

boot();
