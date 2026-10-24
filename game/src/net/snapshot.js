// Снимки состояния для сети. Мир (города, районы, участки) генерируется детерминированно по сиду,
// поэтому по сети передаём только то, что меняется во время игры.
import { createGame } from '../sim/index.js';

// Изменяемые поля верхнего уровня
const DYNAMIC = ['day', 'rng', 'mode', 'companies', 'nextCompanyId', 'units', 'nextUnitId', 'market', 'mapVersion', 'newsSeq'];

// opts.lots — включить владельцев/аренду участков и ИИ-конкурентов в районах (меняются редко)
// opts.newsAfter — номер последней новости, которую клиент уже видел; opts.companyId — чьи новости слать
export function makeSnapshot(state, { lots = false, newsAfter = 0, companyId = null } = {}) {
  const snap = {};
  for (const k of DYNAMIC) snap[k] = state[k];
  snap.news = state.news.filter((n) => n.seq > newsAfter && (n.companyId === null || n.companyId === companyId));
  if (lots) {
    snap.lots = Object.values(state.world.lots).map((l) => [l.id, l.ownerId, l.unitId, l.rent]);
    snap.ai = Object.fromEntries(Object.values(state.world.districts).map((d) => [d.id, d.ai]));
  }
  return snap;
}

export function applySnapshot(state, snap) {
  for (const k of DYNAMIC) if (k in snap) state[k] = snap[k];
  if (snap.news?.length) {
    const known = new Set(state.news.map((n) => n.seq));
    const fresh = snap.news.filter((n) => !known.has(n.seq));
    state.news = [...fresh, ...state.news].sort((a, b) => b.seq - a.seq).slice(0, 300);
  }
  if (snap.lots) {
    for (const [id, ownerId, unitId, rent] of snap.lots) {
      const lot = state.world.lots[id];
      lot.ownerId = ownerId;
      lot.unitId = unitId;
      lot.rent = rent;
    }
  }
  if (snap.ai) for (const [id, ai] of Object.entries(snap.ai)) state.world.districts[id].ai = ai;
}

// Состояние на клиенте: мир по сиду + полный снимок с сервера
export function stateFromSnapshot(seed, snap) {
  const state = createGame({ seed, mode: snap.mode, companyNames: [] });
  state.news = [];
  applySnapshot(state, snap);
  return state;
}
