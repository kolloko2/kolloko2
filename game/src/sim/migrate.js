import { createGame, SAVE_VERSION } from './state.js';
import { syncCpi } from './countries.js';
import { addRivals } from './rivals.js';
import { LEGACY_LEVELS } from '../data/tech.js';

// Миграция сохранений: старая партия дополняется всем, что появилось в игре позже, и продолжается.
// Сохранение хранит свой мир целиком, поэтому районы и участки остаются прежними — добавляются только
// новые поля, новые места (например, нефтяные регионы) и новые категории спроса.
// Возвращает обновлённое состояние или null, если сохранение совсем не подходит.
export const OLDEST_SUPPORTED = 3;

export function migrate(state) {
  if (!state || typeof state.version !== 'number' || !state.world || !state.companies) return null;
  if (state.version > SAVE_VERSION || state.version < OLDEST_SUPPORTED) return null;
  if (state.version === SAVE_VERSION) return fillDefaults(state, null);
  // «свежий» мир того же сида — источник новых полей
  const fresh = createGame({ seed: state.seed, mode: state.mode, companyNames: [], rivals: 0 });
  fillDefaults(state, fresh);
  if (state.version < 6 && !Object.values(state.companies).some((c) => c.ai)) addRivals(state, 4);
  state.version = SAVE_VERSION;
  return state;
}

function fillObject(target, source) {
  for (const [k, v] of Object.entries(source)) if (!(k in target)) target[k] = structuredClone(v);
}

// Дописать недостающие поля (в том числе в сохранении текущей версии — после мелких обновлений)
function fillDefaults(state, fresh) {
  fresh ||= createGame({ seed: state.seed, mode: state.mode, companyNames: [], rivals: 0 });
  // верхний уровень: новые системы (страны, биржа, мода, предложения…)
  for (const [k, v] of Object.entries(fresh)) {
    if (k === 'world' || k === 'companies' || k === 'units' || k === 'news') continue;
    if (!(k in state)) state[k] = structuredClone(v);
  }
  for (const [c, v] of Object.entries(fresh.countries)) {
    if (!state.countries[c]) state.countries[c] = structuredClone(v);
    else fillObject(state.countries[c], v);
  }
  // новые товары рынка (нефть, лекарства…) и новые регионы у старых товаров
  for (const [g, m] of Object.entries(fresh.market.goods)) {
    if (!state.market.goods[g]) state.market.goods[g] = structuredClone(m);
    else fillObject(state.market.goods[g].regions, m.regions);
  }
  for (const [id, l] of Object.entries(fresh.stocks.listings)) if (!state.stocks.listings[id]) state.stocks.listings[id] = structuredClone(l);
  // мир: новые места целиком, у старых — новые поля (туризм, порт…)
  const w = state.world;
  for (const [id, p] of Object.entries(fresh.world.places)) {
    if (!w.places[id]) {
      w.places[id] = structuredClone(p);
      for (const did of p.districtIds) {
        w.districts[did] = structuredClone(fresh.world.districts[did]);
        for (const lid of fresh.world.districts[did].lotIds) w.lots[lid] = structuredClone(fresh.world.lots[lid]);
      }
    } else {
      fillObject(w.places[id], p);
    }
  }
  for (const [id, d] of Object.entries(w.districts)) {
    const f = fresh.world.districts[id];
    if (f) fillObject(d.ai, f.ai);
  }
  // компании и бизнесы
  for (const co of Object.values(state.companies)) {
    co.licenses ||= [];
    co.payout ??= 0.3;
    co.month ||= { interest: 0, tax: 0 };
    // исследования: уровни (pos: 2) → узлы дерева (pos, pos_2)
    for (const [k, nodes] of Object.entries(LEGACY_LEVELS)) {
      const lvl = co.tech?.[k] ?? 0;
      if (lvl > 1) for (let i = 0; i < Math.min(lvl, nodes.length); i++) co.tech[nodes[i]] = 1;
    }
  }
  for (const u of Object.values(state.units)) {
    u.condition ??= 100;
    u.incoming ||= {};
    u.supplied ||= {};
    u.wageLevel ??= 1;
    u.morale ??= 65;
  }
  for (const b of Object.values(state.brands)) {
    b.franchise ||= {};
    b.franchisees ||= {};
    b.royalty ??= 0.05;
    b.national ||= {};
    b.awareness ||= {};
  }
  syncCpi(state);
  return state;
}
