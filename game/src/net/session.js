// Сессия — единственное, через что интерфейс общается с игрой.
// LocalSession: соло, симуляция в браузере. RemoteSession: мультиплеер, симуляция на сервере.
// У обеих одинаковый интерфейс: state, companyId, dispatch(cmd) → Promise<result>, setSpeed(i), on(event, fn).
import { applyCommand, stepDay, isOver } from '../sim/index.js';
import { stateFromSnapshot, applySnapshot } from './snapshot.js';

export const SPEEDS = [
  { ms: Infinity, icon: '⏸', title: 'Пауза (пробел)' },
  { ms: 1500, icon: '▶', title: 'Обычная скорость (1)' },
  { ms: 500, icon: '⏩', title: 'Быстро (2)' },
  { ms: 120, icon: '⏭', title: 'Очень быстро (3)' },
];

// Множитель длины игрового дня в соло (настройки: 0.5 — быстрее, 2 — медленнее)
let dayScale = 1;
export function setDayScale(k) {
  dayScale = k;
}

class Emitter {
  constructor() {
    this.handlers = {};
  }

  on(type, fn) {
    (this.handlers[type] ||= []).push(fn);
  }

  emit(type, data) {
    for (const fn of this.handlers[type] || []) fn(data);
  }
}

export class LocalSession extends Emitter {
  constructor(state) {
    super();
    this.state = state;
    this.companyId = Object.values(state.companies).find((c) => !c.ai).id;
    this.mode = 'solo';
    this.multiplayer = false;
    this.speed = 0;
    this.acc = 0;
  }

  dispatch(cmd) {
    const result = applyCommand(this.state, cmd, this.companyId);
    this.emit('change');
    return Promise.resolve(result);
  }

  setSpeed(i) {
    this.speed = i;
    this.acc = 0;
    this.emit('speed');
  }

  // Вызывается каждый кадр: прокручивает игровые дни по выбранной скорости
  update(dt) {
    const ms = SPEEDS[this.speed].ms * dayScale;
    if (!Number.isFinite(ms) || isOver(this.state)) return;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= ms && steps < 5) {
      stepDay(this.state);
      this.acc -= ms;
      steps++;
    }
    if (steps) this.emit('tick');
  }
}

export class RemoteSession extends Emitter {
  // hello: { t: 'create', mode, name, companyName } или { t: 'join', code, name, companyName, playerId }
  static connect(hello, url = defaultUrl()) {
    return new Promise((resolve, reject) => {
      const s = new RemoteSession(url);
      s.ws.onopen = () => s.ws.send(JSON.stringify(hello));
      s.on('welcome', () => resolve(s));
      s.on('error', (message) => {
        if (!s.state) reject(new Error(message));
      });
      s.ws.onerror = () => reject(new Error('Не удалось подключиться к серверу игры'));
    });
  }

  constructor(url) {
    super();
    this.multiplayer = true;
    this.state = null;
    this.players = [];
    this.playerId = null;
    this.code = null;
    this.mode = null;
    this.companyId = null;
    this.speed = 0;
    this.pending = new Map();
    this.nextId = 1;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = () => {
      for (const { resolve } of this.pending.values()) resolve({ ok: false, error: 'Нет связи с сервером' });
      this.pending.clear();
      if (this.state) this.emit('close');
    };
  }

  onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        Object.assign(this, { code: msg.code, mode: msg.mode, playerId: msg.playerId, companyId: msg.companyId });
        this.state = stateFromSnapshot(msg.seed, msg.snapshot);
        this.emit('welcome');
        break;
      case 'snap':
        applySnapshot(this.state, msg.snapshot);
        this.emit('tick');
        break;
      case 'result': {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p?.resolve(msg.result);
        break;
      }
      case 'room':
        this.players = msg.players;
        this.speed = msg.speed;
        this.emit('room');
        this.emit('speed');
        break;
      case 'chat':
        this.emit('chat', msg);
        break;
      case 'error':
        this.emit('error', msg.message);
        break;
      default:
    }
  }

  send(msg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  dispatch(cmd) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, { resolve });
      this.send({ t: 'cmd', id, cmd });
    });
  }

  // В PvP это голос: идёт минимальная скорость среди игроков
  setSpeed(i) {
    this.send({ t: 'speed', speed: i });
  }

  mySpeed() {
    return this.players.find((p) => p.id === this.playerId)?.speed ?? this.speed;
  }

  chat(text) {
    this.send({ t: 'chat', text });
  }

  update() {}

  close() {
    this.ws.close();
  }
}

function defaultUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
