/* global L */
import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { esc } from './format.js';
import { bizIcon, districtIcon, uiIcon } from './icons.js';

// Уровни карты: мир (города и регионы) → районы → участки
const ZOOM_DISTRICTS = 9;
const ZOOM_LOTS_CITY = 14;
const ZOOM_LOTS_RURAL = 10;

let map;
let placesLayer;
let detailLayer;
let builtVersion = -1;

const ZONING_ICON = { commercial: '🏬', industrial: '🏭', farmland: '🟫' };

export function initMap(app) {
  map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 18, zoomControl: false }).setView([35, 15], 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // Стандартные тайлы OpenStreetMap: без ключа, нужна только атрибуция.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  placesLayer = L.layerGroup().addTo(map);
  detailLayer = L.layerGroup().addTo(map);
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
        radius: d.radius, color: def.color, weight: 1.5, fillOpacity: showLots ? 0.05 : 0.15, interactive: false,
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
}

// Раз в игровой день: предупреждения на значках своих бизнесов
export function refreshWarnings(app) {
  refreshMap(app);
}
