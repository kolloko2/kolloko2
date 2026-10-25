/* global L */
import { BUSINESSES } from '../data/businesses.js';
import { GOODS } from '../data/goods.js';
import { esc } from './format.js';
import { bizIcon, uiIcon } from './icons.js';
import { initBasemap } from './basemap.js';
import { initCityMap, refreshCityMap, bindHud, flyToCity, ZOOM_CITY } from './citymap.js';

// Уровни карты: мир (города и регионы) → город с кварталами и участками (citymap.js)

let map;
let placesLayer;
let detailLayer;
let routesLayer;
let routesKey = '';
let showRoutes = true;
let builtVersion = -1;
let basemap = null;
let overlayLayer;
let layerMode = 'none';
let layerKey = '';

// Слои карты: цветной ореол вокруг городов по выбранному показателю
const LAYERS = {
  none: { name: 'Без слоя' },
  income: { name: 'Доходы жителей', value: (p) => p.income, fmt: (v) => `${Math.round(v * 100)}%` },
  rent: { name: 'Аренда', value: (p) => p.rent, fmt: (v) => `${Math.round(v * 100)}%` },
  tourism: { name: 'Туризм', value: (p) => p.tourism ?? 0, fmt: (v) => `${Math.round(v * 100)}%` },
  growth: { name: 'Рост города (застройщики)', value: (p, s) => (s.growth?.[p.id] ?? 1) - 1, fmt: (v) => `+${Math.round(v * 100)}%` },
  mine: { name: 'Мои бизнесы', value: (p, s, app) => unitsByPlace(s, app.companyId)[p.id] || 0, fmt: (v) => String(v) },
  rivals: { name: 'Соперники', value: (p, s, app) => rivalsIn(s, app.companyId, p.id).total, fmt: (v) => String(v) },
};

// Цвета линий цепочек по видам товаров
const GOOD_COLORS = {
  coffee_green: '#6d4c2f', coffee_roasted: '#6d4c2f', wheat: '#d4a017', flour: '#d4a017', pastry: '#d4a017', sugar: '#c9b27c',
  milk: '#4aa3df', cheese: '#4aa3df', meat: '#c0392b', cattle: '#c0392b', groceries: '#27ae60', cups: '#8e44ad', plastic: '#8e44ad',
  oil: '#2c3e50', fuel: '#e67e22', chips: '#16a085', electronics: '#16a085', medicine: '#e84393', cosmetics: '#e84393',
  parts: '#7f8c8d', cars: '#7f8c8d',
};

// Кто ещё работает в городе: компании (кроме вашей) и число их бизнесов
function rivalsIn(state, companyId, placeId) {
  const by = {};
  let total = 0;
  for (const u of Object.values(state.units)) {
    if (u.placeId !== placeId || u.companyId === companyId) continue;
    by[u.companyId] = (by[u.companyId] || 0) + 1;
    total++;
  }
  return { by, total };
}

const ZONING_ICON = { commercial: '🏬', industrial: '🏭', farmland: '🟫' };

export function initMap(app) {
  map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 17, zoomControl: false, attributionControl: false }).setView([35, 15], 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution('Карта: <a href="https://www.naturalearthdata.com/">Natural Earth</a>').addTo(map);
  // Своя стилизованная подложка вместо тайлов: берега, страны, реки, кварталы
  basemap = initBasemap(map, () => app.state);
  overlayLayer = L.layerGroup().addTo(map);
  placesLayer = L.layerGroup().addTo(map);
  detailLayer = L.layerGroup().addTo(map);
  routesLayer = L.layerGroup().addTo(map);
  initCityMap(map, app);
  bindHud();
  // Кнопка «Цепочки»: линии от поставщиков к получателям своей компании
  const RoutesControl = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create('button', 'map-toggle active');
      b.innerHTML = '🔗 Цепочки';
      b.title = 'Показать/скрыть цепочки поставок';
      L.DomEvent.disableClickPropagation(b);
      b.onclick = () => {
        showRoutes = !showRoutes;
        b.classList.toggle('active', showRoutes);
        routesKey = '';
        refreshRoutes(app);
      };
      return b;
    },
  });
  new RoutesControl({ position: 'topright' }).addTo(map);
  // Выбор слоя карты
  const LayerControl = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create('div', 'map-layers');
      box.innerHTML = `<select title="Слой карты">${Object.entries(LAYERS).map(([id, l]) => `<option value="${id}">🗺 ${l.name}</option>`).join('')}</select><div class="map-legend" hidden></div>`;
      L.DomEvent.disableClickPropagation(box);
      box.querySelector('select').onchange = (e) => {
        layerMode = /** @type {HTMLSelectElement} */ (e.target).value;
        layerKey = '';
        refreshOverlay(app);
      };
      return box;
    },
  });
  new LayerControl({ position: 'topright' }).addTo(map);
  const markZoom = () => {
    map.getContainer().classList.toggle('zoom-low', map.getZoom() < 5);
    map.getContainer().classList.toggle('zoom-mid', map.getZoom() < 12);
    map.getContainer().classList.toggle('zoom-city', map.getZoom() >= ZOOM_CITY);
  };
  map.on('zoomend', markZoom);
  map.on('zoomend moveend', () => refreshMap(app, true));
  markZoom();
  refreshMap(app, true);
}


// Счётчики показывают только бизнесы своей компании
function unitsByPlace(state, companyId) {
  const counts = {};
  for (const u of Object.values(state.units)) if (u.companyId === companyId) counts[u.placeId] = (counts[u.placeId] || 0) + 1;
  return counts;
}


function placeIcon(app, place, count) {
  const icon = place.kind === 'city' ? uiIcon('city', '🏙️') : bizIcon(place.kinds[0]);
  const badge = count ? `<span class="badge">${count}</span>` : '';
  // точки соперников: цвет компании, до 5 штук
  const riv = rivalsIn(app.state, app.companyId, place.id);
  const dots = Object.keys(riv.by).slice(0, 5).map((cid) => `<i style="background:${app.state.companies[cid]?.color}"></i>`).join('');
  const port = place.port ? '<span class="pm-port" title="Морской порт">⚓</span>' : '';
  const title = `${place.name}${riv.total ? ` · соперников: ${riv.total}` : ''}`;
  return L.divIcon({
    className: 'place-marker-wrap',
    html: `<div class="place-marker ${place.kind}" title="${esc(title)}"><span class="pm-icon">${icon}</span><span class="pm-name">${esc(place.name)}</span>${port}${badge}${dots ? `<span class="rival-dots">${dots}</span>` : ''}</div>`,
    iconSize: null,
    iconAnchor: [14, 14],
  });
}

function buildPlaces(app) {
  placesLayer.clearLayers();
  const { state } = app;
  const counts = unitsByPlace(state, app.companyId);
  for (const place of Object.values(state.world.places)) {
    // крупные города поверх мелких и поверх сельских регионов
    const z = place.kind === 'city' ? Math.round(place.pop * 10) : -500;
    const m = L.marker([place.lat, place.lng], { icon: placeIcon(app, place, counts[place.id]), riseOnHover: true, zIndexOffset: z });
    // клик по городу — приближаемся к нему: видны кварталы, участки и конкуренты
    m.on('click', () => flyToCity(place));
    placesLayer.addLayer(m);
  }
}

// Районы и участки живут на плане города (экран города), на карте мира — только города и регионы
// Вблизи города метки городов убираем — там свои кварталы и подписи районов
function buildDetail() {
  detailLayer.clearLayers();
  const near = map.getZoom() >= ZOOM_CITY;
  if (near && map.hasLayer(placesLayer)) map.removeLayer(placesLayer);
  if (!near && !map.hasLayer(placesLayer)) placesLayer.addTo(map);
}

// Ореолы слоя вокруг городов (перерисовываем, только когда меняются значения)
function refreshOverlay(app) {
  const l = LAYERS[layerMode];
  const legend = map.getContainer().querySelector('.map-legend');
  const { state } = app;
  const cities = Object.values(state.world.places).filter((p) => p.kind === 'city');
  const values = l.value ? cities.map((p) => l.value(p, state, app)) : [];
  const key = `${layerMode}:${values.join(',')}`;
  if (key === layerKey) return;
  layerKey = key;
  overlayLayer.clearLayers();
  if (!l.value) {
    if (legend) legend.hidden = true;
    return;
  }
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  cities.forEach((p, i) => {
    const t = max > min ? (values[i] - min) / (max - min) : 0;
    if (values[i] <= 0 && (layerMode === 'mine' || layerMode === 'rivals' || layerMode === 'growth')) return;
    // от холодного синего к тёплому красному
    const color = `hsl(${Math.round(220 - 220 * t)}, 70%, 50%)`;
    overlayLayer.addLayer(L.circleMarker([p.lat, p.lng], {
      radius: 10 + 26 * t, color, weight: 1, fillColor: color, fillOpacity: 0.35, interactive: false,
    }).bindTooltip(`${esc(p.name)}: ${l.fmt(values[i])}`));
  });
  if (legend) {
    legend.hidden = false;
    legend.innerHTML = `<span style="color:hsl(220,70%,50%)">●</span> мало · <span style="color:hsl(0,70%,50%)">●</span> много`;
  }
}

// Новая игра или переход в комнату: перестроить карту целиком
export function resetMap(app) {
  builtVersion = -1;
  routesKey = '';
  basemap?.then((b) => b.redrawCity());
  refreshMap(app, true);
}


// Линии цепочек поставок: от своего производства/склада к получателю; пунктир — груз в пути дольше дня
function refreshRoutes(app) {
  const { state } = app;
  const links = [];
  if (showRoutes) {
    for (const u of Object.values(state.units)) {
      if (u.companyId !== app.companyId || !u.sources) continue;
      for (const [good, srcId] of Object.entries(u.sources)) {
        const src = state.units[srcId];
        if (src) links.push([src, u, good]);
      }
    }
  }
  const key = links.map(([a, b, g]) => `${a.id}>${b.id}:${g}`).join('|');
  if (key === routesKey) return;
  routesKey = key;
  routesLayer.clearLayers();
  for (const [src, dst, good] of links) {
    const color = GOOD_COLORS[good] || app.company?.color || '#2f6fed';
    const a = state.world.lots[src.lotId];
    const b = state.world.lots[dst.lotId];
    const far = Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng) > 8;
    routesLayer.addLayer(L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color, weight: 2.5, opacity: 0.7, dashArray: far ? '6 6' : null, interactive: true,
    }).bindTooltip(`${esc(src.name)} → ${esc(dst.name)}: ${GOODS[good].name}`, { sticky: true }));
  }
}

// force — перестроить слой районов/участков (после перемещения карты).
// Без force: перестраиваем, только если изменились владельцы участков, иначе лишь обновляем значки.
export function refreshMap(app, force = false) {
  if (!map) return;
  const version = app.state.mapVersion;
  if (version !== builtVersion) {
    builtVersion = version;
    buildPlaces(app);
    force = true;
  }
  if (force) buildDetail();
  refreshRoutes(app);
  refreshOverlay(app);
  refreshCityMap(force);
}

export { flyToCity };
export { flyToLatLng } from './citymap.js';

// Раз в игровой день: предупреждения на значках своих бизнесов
export function refreshWarnings(app) {
  refreshMap(app);
}
