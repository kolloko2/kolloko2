/* global L */
// Город на карте (как городская карта в Capitalism Lab, но на настоящей географии):
// кварталы, участки — здания настоящего размера, свои и чужие точки, здания фоновых конкурентов.
// «🏗 Построить» → тип → подсвечиваются подходящие участки → клик → окно с затратами.
import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { COUNTRIES } from '../data/cities.js';
import { GOODS } from '../data/goods.js';
import {
  shopsIn, districtRotation, offsetLatLng, canBuildHere, missingTech, capexFor, allowedRecipes, countryState,
  districtShares, districtEventOf,
} from '../sim/index.js';
import { bizIcon } from './icons.js';
import { moneyShort, num, pct, esc } from './format.js';

export const ZOOM_CITY = 12; // ближе — видно город с участками
const ZOOM_ICONS = 15; // ближе — значки на зданиях

// Группы в меню «Построить»
/** @type {[string, string, (d: any) => boolean][]} */
export const BUILD_GROUPS = [
  ['🛍️', 'Магазины и общепит', (d) => Boolean(d.retail)],
  ['🏢', 'Услуги и недвижимость', (d) => !d.retail && Boolean(d.service || d.storage)],
  ['🏭', 'Заводы и фабрики', (d) => !d.retail && !d.service && !d.storage && d.zoning !== 'farmland'],
  ['⛏️', 'Земля и недра', (d) => d.zoning === 'farmland'],
];

// Слои города: цвет района по показателю (без прогнозов прибыли — только факты)
export const CITY_LAYERS = {
  none: { name: 'Без слоя' },
  crowd: { name: 'Людность', value: (state, d) => d.footfall ?? 0, fmt: (v) => `${num(v)} чел./день` },
  rent: { name: 'Аренда за м²', value: (state, d) => avgRent(state, d), fmt: (v) => `$${v.toFixed(0)}/м²` },
};
export const CATEGORY_NAMES = {
  coffee: '☕ Кофе', fastfood: '🌭 Фастфуд', grocery: '🛒 Продукты', bakery: '🥐 Выпечка', restaurant: '🍽️ Рестораны', fuel: '⛽ Топливо',
  electronics: '📱 Техника', hotel: '🏨 Отели', fitness: '🏋️ Фитнес', beauty: '💇 Красота', pharmacy: '💊 Аптеки', cars: '🚗 Машины',
  autoservice: '🔧 Автосервис', clothing: '👕 Одежда', home: '🛋️ Мебель', diy: '🔨 Ремонт', kids: '🧸 Детское', sports: '⚽ Спорт',
  luxury: '💎 Ювелирка', bar: '🍻 Бары',
};

function avgRent(state, d) {
  const lots = d.lotIds.map((id) => state.world.lots[id]).filter((l) => l.zoning !== 'farmland');
  return lots.length ? lots.reduce((a, l) => a + l.rent / l.area, 0) / lots.length : 0;
}

let map;
let app;
let zones; // районы (цветные пятна и слой)
let buildings; // участки и здания
let marks; // значки и подписи
let renderer;
let hud;
let shownKey = '';

export function initCityMap(leaflet, theApp) {
  map = leaflet;
  app = theApp;
  map.createPane('cityShapes');
  map.getPane('cityShapes').style.zIndex = 430;
  renderer = L.canvas({ pane: 'cityShapes', padding: 0.4 });
  zones = L.layerGroup().addTo(map);
  buildings = L.layerGroup().addTo(map);
  marks = L.layerGroup().addTo(map);
  hud = L.DomUtil.create('div', 'city-hud', map.getContainer());
  hud.hidden = true;
  L.DomEvent.disableClickPropagation(hud);
  L.DomEvent.disableScrollPropagation(hud);
  app.cityLayer ||= 'none';
}

// Какой город сейчас смотрят: ближайший к центру карты, если приблизились достаточно
export function currentPlace() {
  if (!map || map.getZoom() < ZOOM_CITY - (app?.cityPlaceKind === 'region' ? 2 : 0)) return null;
  const c = map.getCenter();
  let best = null;
  let bd = Infinity;
  for (const p of Object.values(app.state.world.places)) {
    const d = map.distance(c, [p.lat, p.lng]);
    const lim = p.kind === 'city' ? 25000 : 40000;
    if (d < lim && d < bd) {
      bd = d;
      best = p;
    }
  }
  if (best?.kind === 'region' && map.getZoom() < 10) return null;
  return best;
}

export function flyToCity(place) {
  map.flyTo([place.lat, place.lng], place.kind === 'city' ? 15 : 11, { duration: 1.0 });
}

export function flyToLatLng(lat, lng, zoom = 16) {
  map.flyTo([lat, lng], Math.max(map.getZoom(), zoom), { duration: 0.8 });
}

// Прямоугольник здания с поворотом квартала
function footprint(lat, lng, w, h, rot) {
  const c = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return c.map(([x, y]) => {
    // экранные оси квартала → метры (y на север)
    const sx = x * Math.cos(rot) - y * Math.sin(rot);
    const sy = x * Math.sin(rot) + y * Math.cos(rot);
    const p = offsetLatLng(lat, lng, sx, -sy);
    return [p.lat, p.lng];
  });
}

function lotSize(lot) {
  if (lot.w) return [lot.w * 0.86, lot.h * 0.86];
  const side = Math.sqrt(lot.area * 10000); // поле: гектары → метры
  return [side, side];
}

// Можно ли строить выбранный тип на участке (для подсветки в режиме стройки)
function buildableHere(lot, type) {
  const { state } = app;
  if (lot.unitId || (lot.ownerId && lot.ownerId !== app.companyId)) return false;
  return canBuildHere(state, lot, type);
}

export function refreshCityMap(force = false) {
  if (!map || !app?.started || app.pressing) return; // не перерисовываем под нажатой кнопкой мыши
  const place = currentPlace();
  const { state } = app;
  const key = place ? `${place.id}|${state.mapVersion}|${map.getZoom() >= ZOOM_ICONS}|${app.build?.type ?? ''}|${app.cityLayer}|${Math.floor(state.day / 7)}|${app.selection?.id ?? ''}` : '';
  renderHud(place);
  if (!force && key === shownKey) return;
  shownKey = key;
  zones.clearLayers();
  buildings.clearLayers();
  marks.clearLayers();
  if (!place) return;
  const icons = map.getZoom() >= ZOOM_ICONS;
  const build = app.build?.type;
  const layer = layerFor(app.cityLayer);
  const values = layer?.value ? place.districtIds.map((id) => layer.value(state, state.world.districts[id])) : [];
  const vmax = Math.max(...values, 1e-9);
  const vmin = Math.min(...values, 0);
  place.districtIds.forEach((id, i) => {
    const d = state.world.districts[id];
    const def = DISTRICTS[d.type];
    if (d.type !== 'rural') {
      let color = def.color;
      let opacity = 0.08;
      if (layer?.value) {
        const t = vmax > vmin ? (values[i] - vmin) / (vmax - vmin) : 0;
        color = `hsl(${Math.round(220 - 220 * t)}, 70%, 50%)`;
        opacity = 0.3;
      }
      zones.addLayer(L.circle([d.lat, d.lng], { radius: d.radius * 1.08, color, weight: 2, opacity: 0.7, fillColor: color, fillOpacity: opacity, dashArray: '6 6', interactive: false }));
    }
    // подпись района (не значок «города»): цветной текст, по клику — сведения о районе
    const ev = districtEventOf(state, d.id);
    const val = layer?.value ? ` · ${layer.fmt(values[i])}` : '';
    const label = L.marker(offsetLatLng(d.lat, d.lng, 0, d.type === 'rural' ? 0 : d.radius * 1.05), {
      icon: L.divIcon({ className: 'dlabel-wrap', html: `<span class="dlabel" style="--c:${def.color}">${def.icon} ${def.name}${ev ? ' ❗' : ''}${val}</span>`, iconSize: null }),
      zIndexOffset: 1000,
    });
    label.on('click', () => app.select({ kind: 'district', id: d.id }));
    marks.addLayer(label);
    const rot = d.type === 'rural' ? 0 : districtRotation(d);
    // участки (свободные, свои, чужие)
    for (const lotId of d.lotIds) {
      const lot = state.world.lots[lotId];
      const u = lot.unitId ? state.units[lot.unitId] : null;
      const co = u ? state.companies[u.companyId] : null;
      const mine = u?.companyId === app.companyId;
      const ok = build ? buildableHere(lot, build) : false;
      const sel = app.selection && ((app.selection.kind === 'lot' && app.selection.id === lot.id) || (app.selection.kind === 'unit' && app.selection.id === lot.unitId));
      const [w, h] = lotSize(lot);
      const style = u
        ? { color: sel ? '#f1c40f' : co.color, weight: sel ? 4 : mine ? 3 : 2, fillColor: co.color, fillOpacity: mine ? 0.85 : 0.55 }
        : build
          ? { color: ok ? '#27ae60' : '#9aa1ad', weight: ok ? 3 : 1, fillColor: ok ? '#2ecc71' : '#ffffff', fillOpacity: ok ? 0.55 : 0.25, dashArray: ok ? null : '3 4' }
          : { color: sel ? '#f1c40f' : lot.ownerId === app.companyId ? '#2d6cdf' : '#7b8494', weight: sel ? 4 : 1.5, fillColor: '#ffffff', fillOpacity: 0.8, dashArray: '4 4' };
      const poly = L.polygon(footprint(lot.lat, lot.lng, w, h, rot), { renderer, ...style });
      poly.on('click', () => onLotClick(lot));
      poly.bindTooltip(lotTip(lot), { sticky: true, direction: 'top', className: 'lot-tip' });
      buildings.addLayer(poly);
      if (icons && u) marks.addLayer(iconMarker(lot.lat, lot.lng, BUSINESSES[u.type].icon, mine ? 'mine' : 'rival'));
      else if (icons && lot.ownerId === app.companyId) marks.addLayer(iconMarker(lot.lat, lot.lng, '🔑', 'own'));
    }
    // здания фоновых конкурентов
    if (d.type === 'rural') return;
    for (const sh of shopsIn(state, d)) {
      const sel = app.selection?.kind === 'shop' && app.selection.id === sh.id;
      const poly = L.polygon(footprint(sh.lat, sh.lng, sh.w * 0.86, sh.h * 0.86, rot), {
        renderer, color: sel ? '#f1c40f' : '#8a909c', weight: sel ? 3 : 1, fillColor: '#b6bcc7', fillOpacity: build ? 0.25 : 0.7,
      });
      poly.on('click', () => app.select({ kind: 'shop', id: sh.id, districtId: d.id }));
      poly.bindTooltip(`${esc(sh.name)} · ${CATEGORY_NAMES[sh.cat] ?? sh.cat}`, { sticky: true, direction: 'top', className: 'lot-tip' });
      buildings.addLayer(poly);
      if (icons) marks.addLayer(iconMarker(sh.lat, sh.lng, (CATEGORY_NAMES[sh.cat] ?? '🏪').split(' ')[0], 'shop'));
    }
  });
}

function layerFor(id) {
  if (CITY_LAYERS[id]) return CITY_LAYERS[id];
  if (!id.startsWith('demand:')) return null;
  const cat = id.slice(7);
  // спрос на категорию: покупателей в день на одного продавца (включая будущего вас)
  return {
    value: (state, d) => {
      const sh = districtShares(state, d, cat);
      return sh.potential / (sh.ai + Object.keys(sh.byUnit).length + 1);
    },
    fmt: (v) => `${num(v)} пок./продавца`,
  };
}

function iconMarker(lat, lng, emoji, cls) {
  return L.marker([lat, lng], { icon: L.divIcon({ className: 'bld-ico-wrap', html: `<span class="bld-ico ${cls}">${emoji}</span>`, iconSize: null }), interactive: false });
}

function lotTip(lot) {
  const { state } = app;
  if (lot.unitId) {
    const u = state.units[lot.unitId];
    return `${BUSINESSES[u.type].icon} ${esc(u.name)} · ${esc(state.companies[u.companyId].name)}`;
  }
  const area = lot.zoning === 'farmland' ? `${num(lot.area)} га` : `${num(lot.area)} м²`;
  return `Участок · ${area}${lot.zoning === 'farmland' ? '' : ` · ${num(lot.traffic)} чел./день`} · аренда ${moneyShort(lot.rent)}/мес`;
}

function onLotClick(lot) {
  if (app.build && !lot.unitId) {
    if (!buildableHere(lot, app.build.type)) {
      app.toast(lot.ownerId && lot.ownerId !== app.companyId ? 'Участок принадлежит другой компании' : 'Сюда этот бизнес не встанет (площадь или зонирование)', 'bad');
      return;
    }
    app.confirmBuild({ lotId: lot.id }, app.build.type, app.build.recipe || undefined).then((ok) => {
      if (ok) app.cancelBuild();
    });
    return;
  }
  app.select(lot.unitId ? { kind: 'unit', id: lot.unitId } : { kind: 'lot', id: lot.id });
}

// Шапка города: факты, «Построить», «Рынок», слои
let hudKey = '';
function renderHud(place) {
  if (!hud) return;
  if (!place) {
    hud.hidden = true;
    hudKey = '';
    return;
  }
  const { state } = app;
  const key = `${place.id}|${app.build?.type ?? ''}|${app.build?.recipe ?? ''}|${app.buildMenu ? 1 : 0}|${app.cityLayer}|${state.mapVersion}|${Math.floor(state.day / 30)}`;
  hud.hidden = false;
  if (key === hudKey) return;
  hudKey = key;
  const cs = countryState(state, place.country);
  const facts = place.kind === 'city'
    ? [['Население', `${num(place.pop, 1)} млн`], ['Доходы', pct(place.income)], ['Аренда', pct(place.rent)], ['Зарплаты', pct(place.wage)], ['Туризм', pct(place.tourism ?? 0.3)]]
    : [['Земля', `${moneyShort(place.landRent)}/га`], ['Зарплаты', pct(place.wage)], ['Ресурсы', (place.resources || []).map((g) => GOODS[g].icon).join(' ') || '—']];
  const cats = [...new Set(place.districtIds.flatMap((id) => Object.keys(DISTRICTS[state.world.districts[id].type].demand)))];
  let html = `<div class="ch-row"><div class="ch-title"><b>${place.kind === 'city' ? '🏙️' : '🌾'} ${esc(place.name)}</b>
    <small>${esc(COUNTRIES[place.country].name)} · налог ${pct(cs.tax)}${place.port ? ' · ⚓ порт' : ''}</small></div>
    <div class="ch-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="ch-btns"><button class="btn" data-hud="build">🏗 Построить</button>
    ${place.kind === 'city' ? `<button class="btn ghost" data-hud="market">📊 Рынок</button>` : ''}
    <select data-hud="layer" title="Слой">${Object.entries(CITY_LAYERS).map(([id, l]) => `<option value="${id}" ${app.cityLayer === id ? 'selected' : ''}>${l.name}</option>`).join('')}
      <optgroup label="Спрос минус конкуренция">${cats.map((c) => `<option value="demand:${c}" ${app.cityLayer === `demand:${c}` ? 'selected' : ''}>${CATEGORY_NAMES[c] ?? c}</option>`).join('')}</optgroup></select></div></div>`;
  if (app.build) {
    const d = BUSINESSES[app.build.type];
    const variants = allowedRecipes(place, app.build.type);
    html += `<div class="ch-build">${bizIcon(app.build.type)} <b>${d.name}</b>
      ${d.production?.recipes && variants.length > 1 ? `<select data-hud="recipe">${variants.map((g) => `<option value="${g}" ${g === app.build.recipe ? 'selected' : ''}>${GOODS[g].icon} ${GOODS[g].name}</option>`).join('')}</select>` : ''}
      <span class="muted small">Зелёные участки подходят — нажмите на один. Esc — отмена.</span><button class="btn ghost" data-hud="cancel">Отмена</button></div>`;
  }
  if (app.buildMenu) html += buildMenu(place);
  hud.innerHTML = html;
}

function buildMenu(place) {
  const { state } = app;
  let html = '<div class="build-menu"><div class="bm-cols">';
  for (const [icon, name, test] of BUILD_GROUPS) {
    const types = Object.entries(BUSINESSES).filter(([t, d]) => test(d) && (place.kind === 'city' ? d.zoning !== 'farmland' : place.kinds.includes(t)));
    if (!types.length) continue;
    html += `<div class="bm-col"><h4>${icon} ${name}</h4>`;
    for (const [t, d] of types) {
      const locked = missingTech(state, app.companyId, t);
      const capex = capexFor(state, { placeId: place.id, zoning: d.zoning, area: d.zoning === 'industrial' ? 800 : Math.max(d.minArea ?? 0, 100) }, t);
      html += `<button class="bm-item ${locked ? 'locked' : ''}" data-hud="pick" data-type="${t}" title="${esc(d.description)}">
        <span class="li-icon">${bizIcon(t)}</span><span class="bm-main">${d.name}<small>${locked ? `🔒 ${esc(locked)}` : `от ${moneyShort(capex)} · ${d.staff.def} чел.${d.minArea ? ` · от ${d.minArea} м²` : ''}`}</small></span></button>`;
    }
    html += '</div>';
  }
  return `${html}</div></div>`;
}

export function bindHud() {
  hud.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-hud]'));
    if (!b) return;
    const what = b.dataset.hud;
    const place = currentPlace();
    if (what === 'build') {
      app.buildMenu = !app.buildMenu;
      if (app.buildMenu) app.closeTab(); // вкладка слева закрыла бы меню
    }
    else if (what === 'pick') {
      if (b.classList.contains('locked')) return;
      const variants = place ? allowedRecipes(place, b.dataset.type) : [];
      app.build = { type: b.dataset.type, recipe: BUSINESSES[b.dataset.type].production?.recipes ? variants[0] ?? null : null };
      app.buildMenu = false;
    } else if (what === 'cancel') app.cancelBuild();
    else if (what === 'market' && place) app.select({ kind: 'market', placeId: place.id });
    else return;
    refreshCityMap(true);
  });
  hud.addEventListener('change', (e) => {
    const el = /** @type {HTMLSelectElement} */ (e.target);
    if (el.dataset.hud === 'layer') app.cityLayer = el.value;
    else if (el.dataset.hud === 'recipe' && app.build) app.build.recipe = el.value;
    el.blur();
    refreshCityMap(true);
  });
}
