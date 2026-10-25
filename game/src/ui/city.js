// Экран города (как городская карта в Capitalism Lab): план клетками, районы, свои и чужие здания.
// «Построить» → категория → тип → клик по клетке. Прогнозов прибыли нет — только факты о месте: думать игроку.
import { BUSINESSES, RISK, RISK_NAMES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { COUNTRIES } from '../data/cities.js';
import { GOODS } from '../data/goods.js';
import {
  gridOf, cellInfo, lotAtCell, cellBuildable, makeCellLot, capexFor, canBuildHere, missingTech, entryFee, licenseNeeded, allowedRecipes,
  countryState,
} from '../sim/index.js';
import { bizIcon, districtIcon } from './icons.js';
import { money, moneyShort, num, pct, esc } from './format.js';

// Группы в меню «Построить»
/** @type {[string, string, (d: any) => boolean][]} */
export const BUILD_GROUPS = [
  ['🛍️', 'Магазины и общепит', (d) => Boolean(d.retail)],
  ['🏢', 'Услуги и недвижимость', (d) => !d.retail && Boolean(d.service || d.storage)],
  ['🏭', 'Заводы и фабрики', (d) => !d.retail && !d.service && !d.storage && !['farm', 'mining', 'oil'].includes(d.category) && d.zoning !== 'farmland'],
  ['⛏️', 'Земля и недра', (d) => d.zoning === 'farmland' || (['mining'].includes(d.category) && !d.retail)],
];

const WATER = '#a9d3ec';

// Состояние экрана города живёт в app.city: { placeId, build: тип|null, recipe, menu, hover }
export function openCity(app, placeId) {
  app.city = { placeId, build: null, recipe: null, menu: false, hover: null };
  document.getElementById('city').hidden = false;
  renderCity(app, true);
}

export function closeCity(app) {
  app.city = null;
  document.getElementById('city').hidden = true;
}

export function startBuild(app, type) {
  const place = app.state.world.places[app.city.placeId];
  const variants = allowedRecipes(place, type);
  app.city.build = type;
  app.city.recipe = BUSINESSES[type].production?.recipes ? variants[0] ?? null : null;
  app.city.menu = false;
  renderCity(app, true);
}

export function cancelBuild(app) {
  if (!app.city) return false;
  if (app.city.menu || app.city.build) {
    app.city.menu = false;
    app.city.build = null;
    renderCity(app, true);
    return true;
  }
  return false;
}

let lastKey = '';
export function renderCity(app, force = false) {
  if (!app.city) return;
  const { state } = app;
  const place = state.world.places[app.city.placeId];
  const key = `${place.id}|${state.mapVersion}|${state.day}|${app.city.build}|${app.city.menu}|${app.city.recipe}|${app.selection?.id ?? ''}|${app.selection?.x ?? ''}|${app.selection?.y ?? ''}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  const root = document.getElementById('city');
  root.innerHTML = `${header(app, place)}<div class="city-body">${legend(app, place)}<div class="city-view" id="city-view">${grid(app, place)}</div></div>
    ${app.city.menu ? buildMenu(app, place) : ''}${app.city.build ? buildBar(app, place) : ''}<div id="city-tip" hidden></div>`;
}

function header(app, place) {
  const { state } = app;
  const country = COUNTRIES[place.country];
  const cs = countryState(state, place.country);
  const facts = place.kind === 'city'
    ? [['Население', `${num(place.pop, 1)} млн`], ['Доходы', pct(place.income)], ['Аренда', pct(place.rent)], ['Зарплаты', pct(place.wage)], ['Туризм', pct(place.tourism ?? 0.3)], ['Порт', place.port ? 'есть' : 'нет']]
    : [['Земля', `${money(place.landRent)}/га`], ['Зарплаты', pct(place.wage)], ['Продуктивность', pct(place.productivity)], ['Ресурсы', (place.resources || []).map((g) => GOODS[g].icon).join(' ') || '—']];
  return `<div class="city-head">
    <button class="btn ghost" data-city="close" title="Карта мира (Esc)">← Мир</button>
    <div class="city-title"><b>${place.kind === 'city' ? '🏙️' : '🌾'} ${esc(place.name)}</b><small>${esc(country.name)} · налог ${pct(cs.tax)} · пошлина ${pct(cs.tariff)}${cs.demand !== 1 ? ` · экономика ${cs.demand > 1 ? '+' : ''}${pct(cs.demand - 1)}` : ''}</small></div>
    <div class="city-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="spacer"></div>
    <button class="btn" data-city="menu">🏗 Построить</button>
  </div>`;
}

function legend(app, place) {
  const { state } = app;
  let html = '<div class="city-legend"><h4>Районы</h4>';
  for (const id of place.districtIds) {
    const d = state.world.districts[id];
    const def = DISTRICTS[d.type];
    const ai = Object.values(d.ai).reduce((a, b) => a + b, 0);
    html += `<button class="leg-item" data-action="selectDistrict" data-id="${d.id}"><span class="leg-sw" style="background:${def.color}"></span>
      <span>${def.name}<small>${place.kind === 'city' ? `поток ${num((def.traffic[0] + def.traffic[1]) / 2)}/день · аренда ~${money(def.rent * place.rent)}/м² · конкурентов ${ai}` : 'поля и недра'}</small></span></button>`;
  }
  const mine = Object.values(state.units).filter((u) => u.placeId === place.id);
  const own = mine.filter((u) => u.companyId === app.companyId).length;
  html += `<h4>Здания</h4><div class="small">Ваших: <b>${own}</b> · других компаний: <b>${mine.length - own}</b></div>
    <div class="small muted">Клетка — участок. Чем ближе к центру района, тем больше людей и дороже аренда. Строить можно почти что угодно где угодно — окупится ли, решать вам.</div></div>`;
  return html;
}

// Цвет клетки: цвет района, насыщеннее там, где людно
function cellColor(def, crowd) {
  return `${def.color}${Math.round(40 + 150 * Math.min(1, crowd)).toString(16).padStart(2, '0')}`;
}

function grid(app, place) {
  const { state } = app;
  const { n } = gridOf(place);
  const build = app.city.build;
  let cells = '';
  let deco = '';
  let marks = '';
  const owners = new Map();
  for (const u of Object.values(state.units)) if (u.placeId === place.id) owners.set(u.lotId, u);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const c = cellInfo(state, place, x, y);
      if (!c.land) {
        cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${WATER}"/>`;
        continue;
      }
      const d = state.world.districts[c.districtId];
      const def = DISTRICTS[d.type];
      let cls = '';
      if (build) cls = cellBuildable(state, place, x, y, build) ? 'no' : 'ok';
      cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${place.kind === 'city' ? cellColor(def, c.crowd) : fieldColor(c.seed)}" data-x="${x}" data-y="${y}" class="${cls}"/>`;
      // фоновая застройка: где людно — дома других владельцев
      if (place.kind === 'city' && c.seed < c.crowd * 0.75) {
        const s = 0.35 + 0.3 * ((c.seed * 13.7) % 1);
        deco += `<rect x="${x + (1 - s) / 2}" y="${y + (1 - s) / 2}" width="${s}" height="${s}" rx="0.06" class="house"/>`;
      }
      const lot = lotAtCell(state, place, x, y);
      const u = lot?.unitId ? state.units[lot.unitId] : null;
      if (u) {
        const co = state.companies[u.companyId];
        const mine = u.companyId === app.companyId;
        const sel = app.selection?.kind === 'unit' && app.selection.id === u.id;
        marks += `<g class="bld ${mine ? 'mine' : ''} ${sel ? 'sel' : ''}" data-unit="${u.id}"><rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" rx="0.15" fill="#fff" stroke="${co.color}" stroke-width="${mine ? 0.14 : 0.09}"/>
          <text x="${x + 0.5}" y="${y + 0.72}" font-size="0.6" text-anchor="middle">${BUSINESSES[u.type].icon}</text></g>`;
      } else if (lot?.ownerId === app.companyId) {
        marks += `<text x="${x + 0.5}" y="${y + 0.7}" font-size="0.5" text-anchor="middle">🔑</text>`;
      }
    }
  }
  // границы районов и улицы
  let lines = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = cellInfo(state, place, x, y);
      if (!a.land) continue;
      if (x + 1 < n) {
        const b = cellInfo(state, place, x + 1, y);
        if (b.land && b.districtId !== a.districtId) lines += `M${x + 1} ${y}v1`;
      }
      if (y + 1 < n) {
        const b = cellInfo(state, place, x, y + 1);
        if (b.land && b.districtId !== a.districtId) lines += `M${x} ${y + 1}h1`;
      }
    }
  }
  let streets = '';
  if (place.kind === 'city') for (let i = 4; i < n; i += 4) streets += `M${i} 0V${n}M0 ${i}H${n}`;
  const sel = app.selection?.kind === 'cell' && app.selection.placeId === place.id ? `<rect x="${app.selection.x}" y="${app.selection.y}" width="1" height="1" class="cell-sel"/>` : '';
  const labels = place.districtIds.map((id) => {
    const d = state.world.districts[id];
    const [x, y] = nearestCell(state, place, d);
    return `<text x="${x + 0.5}" y="${y - 0.25}" class="dlabel" text-anchor="middle">${DISTRICTS[d.type].icon} ${DISTRICTS[d.type].name}</text>`;
  }).join('');
  return `<svg id="city-svg" viewBox="-0.5 -0.5 ${n + 1} ${n + 1}" preserveAspectRatio="xMidYMid meet" class="${build ? 'building' : ''}">
    <g>${cells}</g><path d="${streets}" class="street"/><g>${deco}</g><path d="${lines}" class="dborder"/>${sel}<g>${marks}</g><g>${labels}</g></svg>`;
}

function fieldColor(seed) {
  return ['#d9cf8f', '#c9d98a', '#b5cf7a', '#e1d29a', '#cbd68e'][Math.floor(seed * 5)];
}

const labelCache = new Map();
function nearestCell(state, place, d) {
  const key = `${state.seed}|${d.id}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const { n } = gridOf(place);
  let best = [Math.floor(n / 2), Math.floor(n / 2)];
  let bd = Infinity;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const c = cellInfo(state, place, x, y);
      if (c.districtId === d.id && c.distM < bd) {
        bd = c.distM;
        best = [x, y];
      }
    }
  }
  labelCache.set(key, best);
  return best;
}

// Меню «Построить»: категории и типы — цена входа, штат, характер. Без прогноза прибыли.
function buildMenu(app, place) {
  const { state } = app;
  const idx = { lat: place.lat, lng: place.lng, placeId: place.id, zoning: place.kind === 'city' ? 'commercial' : 'farmland', area: 100 };
  let html = '<div class="build-menu"><div class="bm-head"><b>🏗 Что построить</b><button class="close-x" data-city="menu">×</button></div><div class="bm-cols">';
  for (const [icon, name, test] of BUILD_GROUPS) {
    const types = Object.entries(BUSINESSES).filter(([t, d]) => test(d) && (place.kind === 'city' ? d.zoning !== 'farmland' : place.kinds.includes(t)));
    if (!types.length) continue;
    html += `<div class="bm-col"><h4>${icon} ${name}</h4>`;
    for (const [t, d] of types) {
      const locked = missingTech(state, app.companyId, t);
      const capex = capexFor(state, { ...idx, zoning: d.zoning, area: d.zoning === 'industrial' ? 800 : Math.max(d.minArea ?? 0, 100) }, t);
      html += `<button class="bm-item ${locked ? 'locked' : ''}" data-city="build" data-type="${t}" title="${esc(d.description)}${RISK[t] ? `\n${RISK_NAMES[RISK[t][0]]}: ${RISK[t][1]}` : ''}">
        <span class="li-icon">${bizIcon(t)}</span><span class="bm-main">${d.name}<small>${locked ? `🔒 ${esc(locked)}` : `от ${moneyShort(capex)} · ${d.staff.def} чел. · тир ${d.tier}`}</small></span></button>`;
    }
    html += '</div>';
  }
  return `${html}</div></div>`;
}

function buildBar(app, place) {
  const t = app.city.build;
  const d = BUSINESSES[t];
  const variants = allowedRecipes(place, t);
  const pick = d.production?.recipes && variants.length > 1
    ? `<select data-city-recipe>${variants.map((g) => `<option value="${g}" ${g === app.city.recipe ? 'selected' : ''}>${GOODS[g].icon} ${GOODS[g].name}</option>`).join('')}</select>` : '';
  return `<div class="build-bar">${bizIcon(t)} <b>${d.name}</b> ${pick}<span class="muted small">— выберите клетку на плане. Esc — отмена.</span>
    <button class="btn ghost" data-city="cancel">Отмена</button></div>`;
}

// Факты о клетке (подсказка и панель): район, людность, аренда, что стоит; в режиме стройки — вложения
export function cellFacts(app, place, x, y, type = null) {
  const { state } = app;
  const c = cellInfo(state, place, x, y);
  if (!c.land) return { title: 'Вода', rows: [] };
  const d = state.world.districts[c.districtId];
  const def = DISTRICTS[d.type];
  const lot = lotAtCell(state, place, x, y);
  const rows = [['Район', `${def.icon} ${def.name}`]];
  if (place.kind === 'city') {
    const trafficMult = 0.7 + Math.min(place.pop, 25) / 40;
    rows.push(['Людность', `${Math.round(c.crowd * 100)}%`], ['Прохожих', `~${num(((def.traffic[0] + def.traffic[1]) / 2) * trafficMult * c.crowd)}/день`],
      ['Аренда', `~${money(def.rent * place.rent * (0.35 + 0.65 * c.crowd))}/м²`]);
  }
  let title = `Клетка ${x + 1}·${y + 1}`;
  if (lot?.unitId) {
    const u = state.units[lot.unitId];
    title = `${BUSINESSES[u.type].icon} ${u.name}`;
    rows.push(['Владелец', esc(state.companies[u.companyId].name)]);
  } else if (lot) {
    rows.push(['Здание', `${num(lot.area)} ${lot.zoning === 'farmland' ? 'га' : 'м²'}${lot.ownerId ? ` · владелец ${esc(state.companies[lot.ownerId].name)}` : ''}`]);
  }
  if (type) {
    const why = cellBuildable(state, place, x, y, type);
    if (why) rows.push(['Нельзя', why]);
    else {
      const l = lot && !lot.unitId ? lot : makeCellLot(state, place, x, y, type);
      if (lot && !canBuildHere(state, lot, type)) rows.push(['Нельзя', 'Здание не подходит']);
      const fee = entryFee(state, app.companyId, place, type);
      const lic = licenseNeeded(state, app.companyId, place, type);
      rows.push(['Площадь', `${num(l.area)} ${l.zoning === 'farmland' ? 'га' : 'м²'}`], ['Вложения', money(capexFor(state, l, type))], ['Аренда', `${money(l.rent)}/мес`]);
      if (fee) rows.push(['Выход на рынок', money(fee)]);
      if (lic) rows.push(['Лицензия', money(lic.cost)]);
    }
  }
  return { title, rows, lot, district: d };
}
