// Комната мультиплеера: авторитетная симуляция одного мира и игроки в нём.
//   coop — все игроки управляют одной общей компанией;
//   pvp  — у каждого игрока своя компания.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGame, addCompany, stepDay, applyCommand, isOver, addNews, dateOf, VICTORY_OPTIONS, SAVE_VERSION } from '../src/sim/index.js';
import { makeSnapshot } from '../src/net/snapshot.js';

export const SPEED_MS = [Infinity, 1500, 500, 120];
const BROADCAST_MS = 250;
const MAX_PLAYERS = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  return Array.from(randomBytes(5), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

// Аренда и ИИ-конкуренты меняются в конце месяца — тогда шлём участки заново
function monthKey(day) {
  const d = dateOf(day);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function cleanName(s, fallback) {
  const n = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return n || fallback;
}

export class Room {
  constructor({ code, mode, state, players = [], dataDir }) {
    this.code = code;
    this.mode = mode;
    this.state = state;
    this.dataDir = dataDir;
    this.players = new Map(players.map((p) => [p.id, { ...p, socket: null, speed: 1 }]));
    this.speed = 1; // общая скорость в коопе
    this.acc = 0;
    this.lastTick = Date.now();
    this.dirty = false;
    this.lastLotsVersion = -1;
    this.lastMonth = -1;
    this.timer = setInterval(() => this.loop(), 50);
  }

  static create({ mode, seed, victoryId, dataDir }) {
    const victory = mode === 'pvp' ? VICTORY_OPTIONS.find((v) => v.id === victoryId)?.victory ?? null : null;
    const state = createGame({ seed, mode, companyNames: [], victory });
    return new Room({ code: newCode(), mode, state, dataDir });
  }

  // ---------- игроки ----------
  join(socket, { name, companyName, playerId }) {
    let player = playerId && this.players.get(playerId);
    if (!player) {
      if (this.players.size >= MAX_PLAYERS) throw new Error('Комната заполнена');
      const id = randomBytes(9).toString('base64url');
      name = cleanName(name, `Игрок ${this.players.size + 1}`);
      let companyId;
      const human = Object.values(this.state.companies).find((c) => !c.ai);
      if (this.mode === 'coop' && human) {
        companyId = human.id;
      } else {
        companyId = addCompany(this.state, cleanName(companyName, `Компания ${name}`));
      }
      player = { id, name, companyId, socket: null, speed: 1 };
      this.players.set(id, player);
      addNews(this.state, 'info', `${name} присоединился к игре.`, null, this.mode === 'coop' ? companyId : null);
    }
    if (player.socket && player.socket !== socket) player.socket.close();
    player.socket = socket;
    player.newsSeq = 0;
    socket.send(JSON.stringify({
      t: 'welcome',
      code: this.code,
      mode: this.mode,
      playerId: player.id,
      companyId: player.companyId,
      seed: this.state.seed,
      snapshot: this.snapshotFor(player, true),
    }));
    this.sendRoomInfo();
    return player;
  }

  leave(player) {
    player.socket = null;
    this.sendRoomInfo();
    if (!this.online().length) this.save();
  }

  online() {
    return [...this.players.values()].filter((p) => p.socket);
  }

  // ---------- действия ----------
  command(player, id, cmd) {
    const result = applyCommand(this.state, cmd, player.companyId);
    player.socket?.send(JSON.stringify({ t: 'result', id, result }));
    if (result.ok) this.broadcastSoon();
  }

  setSpeed(player, speed) {
    if (!Number.isInteger(speed) || speed < 0 || speed >= SPEED_MS.length) return;
    if (this.mode === 'coop') this.speed = speed;
    player.speed = speed;
    this.sendRoomInfo();
  }

  chat(player, text) {
    const t = String(text ?? '').trim().slice(0, 300);
    if (!t) return;
    const color = this.state.companies[player.companyId]?.color;
    this.broadcast({ t: 'chat', from: player.name, color, text: t, day: this.state.day });
  }

  // В PvP скорость — минимальная из голосов игроков онлайн (пауза одного останавливает всех)
  effectiveSpeed() {
    const online = this.online();
    if (!online.length) return 0;
    if (this.mode === 'coop') return this.speed;
    return Math.min(...online.map((p) => p.speed));
  }

  // ---------- цикл ----------
  loop() {
    const now = Date.now();
    const dt = Math.min(now - this.lastTick, 1000);
    this.lastTick = now;
    const ms = SPEED_MS[this.effectiveSpeed()];
    if (Number.isFinite(ms) && !isOver(this.state)) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= ms && steps < 5) {
        const month = monthKey(this.state.day);
        stepDay(this.state);
        this.acc -= ms;
        steps++;
        this.dirty = true;
        if (month !== monthKey(this.state.day)) this.save();
      }
    } else {
      this.acc = 0;
    }
    if (this.dirty && now - (this.lastBroadcast || 0) >= BROADCAST_MS) this.flush();
  }

  broadcastSoon() {
    this.dirty = true;
    this.lastBroadcast = 0;
  }

  snapshotFor(player, full = false) {
    const s = this.state;
    const lots = full || s.mapVersion !== this.lastLotsVersion || monthKey(s.day) !== this.lastMonth;
    const snap = makeSnapshot(s, { lots, newsAfter: player.newsSeq || 0, companyId: player.companyId });
    player.newsSeq = s.newsSeq;
    return snap;
  }

  flush() {
    this.dirty = false;
    this.lastBroadcast = Date.now();
    for (const p of this.online()) p.socket.send(JSON.stringify({ t: 'snap', snapshot: this.snapshotFor(p) }));
    this.lastLotsVersion = this.state.mapVersion;
    this.lastMonth = monthKey(this.state.day);
  }

  roomInfo() {
    return {
      t: 'room',
      code: this.code,
      mode: this.mode,
      speed: this.effectiveSpeed(),
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, companyId: p.companyId, online: !!p.socket, speed: p.speed,
      })),
    };
  }

  sendRoomInfo() {
    this.broadcast(this.roomInfo());
  }

  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const p of this.online()) p.socket.send(text);
  }

  // ---------- сохранение ----------
  async save() {
    if (!this.dataDir) return;
    const data = {
      code: this.code,
      mode: this.mode,
      players: [...this.players.values()].map(({ id, name, companyId }) => ({ id, name, companyId })),
      state: this.state,
    };
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(join(this.dataDir, `${this.code}.json`), JSON.stringify(data));
  }

  static async load(code, dataDir) {
    if (!/^[A-Z0-9]{5}$/.test(code)) return null;
    try {
      const data = JSON.parse(await readFile(join(dataDir, `${code}.json`), 'utf8'));
      if (data.state?.version !== SAVE_VERSION) return null; // старый формат мира
      return new Room({ ...data, dataDir });
    } catch {
      return null;
    }
  }

  dispose() {
    clearInterval(this.timer);
  }
}
