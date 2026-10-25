// Снимки состояния для сети. Мир (города, районы, участки) генерируется детерминированно по сиду,
// поэтому по сети передаём только то, что меняется во время игры.
import { createGame } from '../sim/index.js';
import { syncCpi } from '../sim/countries.js';
import { SAVE_VERSION } from '../sim/state.js';

// Изменяемые поля верхнего уровня
const DYNAMIC = ['day', 'rng', 'mode', 'victory', 'winner', 'companies', 'nextCompanyId', 'nextRivalId', 'units', 'nextUnitId', 'market', 'mapVersion', 'newsSeq',
  'shipments', 'nextShipmentId', 'contracts', 'nextContractId', 'brands', 'nextBrandId', 'countries', 'stocks', 'trends', 'districtEvents', 'offers', 'nextOfferId', 'growth'];

// Участок отличается от сгенерированного (занят, куплен, подорожал) — только такие шлём по сети
const lotChanged = (l) => l.ownerId || l.unitId || l.rent !== l.rent0 || l.price !== Math.round(l.rent0 * 110);

// opts.lots — включить изменённые участки и ИИ-конкурентов в районах (меняются редко)
// opts.newsAfter — номер последней новости, которую клиент уже видел; opts.companyId — чьи новости слать (allNews — все)
export function makeSnapshot(state, { lots = false, newsAfter = 0, companyId = null, allNews = false } = {}) {
  const snap = {};
  for (const k of DYNAMIC) snap[k] = state[k];
  snap.news = state.news.filter((n) => n.seq > newsAfter && (allNews || n.companyId === null || n.companyId === companyId));
  if (lots) {
    snap.lots = Object.values(state.world.lots).filter(lotChanged).map((l) => [l.id, l.ownerId, l.unitId, l.rent, l.price]);
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
    // всё, чего нет в списке, — как при генерации мира
    for (const l of Object.values(state.world.lots)) {
      if (!lotChanged(l)) continue;
      l.ownerId = null;
      l.unitId = null;
      l.rent = l.rent0;
      l.price = Math.round(l.rent0 * 110);
    }
    for (const [id, ownerId, unitId, rent, price] of snap.lots) {
      const lot = state.world.lots[id];
      if (!lot) continue;
      lot.ownerId = ownerId;
      lot.unitId = unitId;
      lot.rent = rent;
      lot.price = price;
    }
  }
  if (snap.ai) for (const [id, ai] of Object.entries(snap.ai)) state.world.districts[id].ai = ai;
  if (snap.countries) syncCpi(state);
}

// Состояние на клиенте: мир по сиду + полный снимок с сервера
export function stateFromSnapshot(seed, snap) {
  const state = createGame({ seed, mode: snap.mode, companyNames: [] });
  state.news = [];
  applySnapshot(state, snap);
  return state;
}

// Сохранение партии: сид + всё изменяемое. Мир при загрузке строится заново по сиду — файл маленький.
export function packSave(state) {
  return { format: 'snap', version: SAVE_VERSION, seed: state.seed, mode: state.mode, snap: makeSnapshot(state, { lots: true, allNews: true }) };
}

// Загрузка сохранения; null — файл от другой версии игры
export function unpackSave(data) {
  if (!data || data.format !== 'snap' || data.version !== SAVE_VERSION) return null;
  const state = stateFromSnapshot(data.seed, data.snap);
  state.mode = data.mode;
  return state;
}
