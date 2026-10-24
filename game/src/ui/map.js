/* global L */
import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { GOODS } from '../data/goods.js';
import { esc } from './format.js';
import { bizIcon, districtIcon, uiIcon } from './icons.js';
import { initBasemap } from './basemap.js';

// Уровни карты: мир (города и регионы) → районы → участки
const ZOOM_DISTRICTS = 9;
const ZOOM_LOTS_CITY = 14;
const ZOOM_LOTS_RURAL = 10;

let map;
let placesLayer;
let detailLayer;
let routesLayer;
let routesKey = '';
let showRoutes = true;
let builtVersion = -1;
let basemap = null;

const ZONING_ICON = { commercial: '🏬', industrial: '🏭', farmland: '🟫' };

export function initMap(app) {
  map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 17, zoomControl: false, attributionControl: false }).setView([35, 15], 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution('Карта: <a href="https://www.naturalearthdata.com/">Natural Earth</a>').addTo(map);
  // Своя стилизованная подложка вместо тайлов: берега, страны, реки, кварталы
  basemap = initBasemap(map, () => app.state);
  placesLayer = L.layerGroup().addTo(map);
  detailLayer = L.layerGroup().addTo(map);
  routesLayer = L.layerGroup().addTo(map);
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
  const markZoom = () => {
    map.getContainer().classList.toggle('zoom-low', map.getZoom() < 5);
    map.getContainer().classList.toggle('zoom-mid', map.getZoom() < 12);
  };
  map.on('zoomend', markZoom);
  map.on('zoomend moveend', () => refreshMap(app, true));
  markZoom();
  refreshMap(app, true);
}

export function flyToPlace(place) {
  map.flyTo([place.lat, place.lng], place.kind === 'city' ? 11 : ZOOM_LOTS_RURAL + 1, { duration: 1.2 });
}

export function flyToDistrict(district) {
  map.flyTo([district.lat, district.lng], district.type === 'rural' ? ZOOM_LOTS_RURAL + 1 : 15, { duration: 1.0 });
}

export function flyToLot(lot) {
  const rural = lot.zoning === 'farmland';
  map.flyTo([lot.lat, lot.lng], Math.max(map.getZoom(), rural ? 12 : 16), { duration: 1.0 });
}

// Счётчики показывают только бизнесы своей компании
function unitsByPlace(state, companyId) {
  const counts = {};
  for (const u of Object.values(state.units)) if (u.companyId === companyId) counts[u.placeId] = (counts[u.placeId] || 0) + 1;
  return counts;
}

function unitsByDistrict(state, companyId) {
  const counts = {};
  for (const u of Object.values(state.units)) {
    if (u.companyId !== companyId) continue;
    const d = state.world.lots[u.lotId].districtId;
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

function placeIcon(place, count) {
  const icon = place.kind === 'city' ? uiIcon('city', '🏙️') : bizIcon(place.kinds[0]);
  const badge = count ? `<span class="badge">${count}</span>` : '';
  return L.divIcon({
    className: 'place-marker-wrap',
    html: `<div class="place-marker ${place.kind}" title="${esc(place.name)}"><span class="pm-icon">${icon}</span><span class="pm-name">${esc(place.name)}</span>${badge}</div>`,
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
    const m = L.marker([place.lat, place.lng], { icon: placeIcon(place, counts[place.id]), riseOnHover: true, zIndexOffset: z });
    m.on('click', () => {
      app.select({ kind: 'place', id: place.id });
      flyToPlace(place);
    });
    placesLayer.addLayer(m);
  }
}

// Маркеры участков на экране: lotId → { marker, html }. Значок меняем, только если он изменился,
// иначе частые обновления (в мультиплеере — несколько раз в секунду) «съедали» бы клики.
const lotMarkers = new Map();

function lotHtml(app, lot) {
  const { state, selection } = app;
  const unit = lot.unitId ? state.units[lot.unitId] : null;
  const selected = selection && ((selection.kind === 'lot' && selection.id === lot.id) || (unit && selection.kind === 'unit' && selection.id === unit.id));
  let html;
  const sel = selected ? ' selected' : '';
  const key = lot.ownerId === app.companyId ? '<span class="key">🔑</span>' : '';
  if (unit && unit.companyId === app.companyId) {
    const warn = unit.today?.stockout || unit.broken > 0 || unit.today?.inputShort ? '<span class="warn-dot"></span>' : '';
    html = `<div class="lot lot-own${sel}" title="${esc(unit.name)}">${bizIcon(unit.type)}${warn}${key}</div>`;
  } else if (unit) {
    // бизнес другого игрока — рамка цвета его компании
    const co = state.companies[unit.companyId];
    html = `<div class="lot lot-rival${sel}" style="--rc:${co?.color}" title="${esc(unit.name)} · ${esc(co?.name ?? '')}">${bizIcon(unit.type)}${key}</div>`;
  } else {
    html = `<div class="lot lot-free ${lot.zoning}${sel}">${ZONING_ICON[lot.zoning]}${key}</div>`;
  }
  return html;
}

function makeLotIcon(html) {
  return L.divIcon({ className: 'lot-wrap', html, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function buildDetail(app) {
  detailLayer.clearLayers();
  lotMarkers.clear();
  const { state } = app;
  const zoom = map.getZoom();
  // Близко к земле маркеры городов только мешают кликать по районам
  if (zoom >= 11) map.removeLayer(placesLayer);
  else if (!map.hasLayer(placesLayer)) placesLayer.addTo(map);
  if (zoom < ZOOM_DISTRICTS) return;
  const bounds = map.getBounds().pad(0.3);
  const counts = unitsByDistrict(state, app.companyId);
  for (const d of Object.values(state.world.districts)) {
    if (!bounds.contains([d.lat, d.lng]) && d.type !== 'rural') continue;
    const def = DISTRICTS[d.type];
    const rural = d.type === 'rural';
    const showLots = zoom >= (rural ? ZOOM_LOTS_RURAL : ZOOM_LOTS_CITY);
    if (rural && !bounds.pad(1).contains([d.lat, d.lng])) continue;
    if (!rural) {
      detailLayer.addLayer(L.circle([d.lat, d.lng], {
        radius: d.radius * 1.08, color: def.color, weight: showLots ? 1.5 : 2, opacity: showLots ? 0.5 : 0.8,
        dashArray: showLots ? '4 8' : null, fillColor: def.color, fillOpacity: showLots ? 0 : 0.12, interactive: false,
      }));
    }
    if (!showLots) {
      const n = counts[d.id];
      const label = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: 'district-label-wrap',
          html: `<div class="district-label" style="--c:${def.color}" title="${def.name}">${districtIcon(d.type)}<span class="dl-name"> ${def.name}</span>${n ? ` <b>${n}</b>` : ''}</div>`,
          iconSize: null,
        }),
      });
      label.on('click', () => {
        app.select({ kind: 'district', id: d.id });
        flyToDistrict(d);
      });
      detailLayer.addLayer(label);
      continue;
    }
    for (const lotId of d.lotIds) {
      const lot = state.world.lots[lotId];
      const html = lotHtml(app, lot);
      const m = L.marker([lot.lat, lot.lng], { icon: makeLotIcon(html), riseOnHover: true });
      m.on('click', () => app.select(lot.unitId ? { kind: 'unit', id: lot.unitId } : { kind: 'lot', id: lot.id }));
      detailLayer.addLayer(m);
      lotMarkers.set(lot.id, { marker: m, html });
    }
  }
}

// Новая игра или переход в комнату: перестроить карту целиком
export function resetMap(app) {
  builtVersion = -1;
  routesKey = '';
  basemap?.then((b) => b.redrawCity());
  refreshMap(app, true);
}

function updateLotIcons(app) {
  for (const [id, entry] of lotMarkers) {
    const html = lotHtml(app, app.state.world.lots[id]);
    if (html === entry.html) continue;
    entry.html = html;
    entry.marker.setIcon(makeLotIcon(html));
  }
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
  const color = app.company?.color || '#2f6fed';
  for (const [src, dst, good] of links) {
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
  if (force) buildDetail(app);
  else updateLotIcons(app);
  refreshRoutes(app);
}

// Раз в игровой день: предупреждения на значках своих бизнесов
export function refreshWarnings(app) {
  refreshMap(app);
}
