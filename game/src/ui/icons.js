import { BUSINESSES } from '../data/businesses.js';
import { DISTRICTS } from '../data/districts.js';
import { GOODS } from '../data/goods.js';

// Сгенерированные иконки (assets/icons/*.png). Список готовых — в manifest.json;
// если иконки нет, показываем эмодзи из данных.
let available = new Set();

export async function loadIcons() {
  try {
    const res = await fetch('assets/icons/manifest.json');
    if (res.ok) available = new Set(await res.json());
  } catch {
    // без иконок игра работает на эмодзи
  }
}

export function icon(name, fallback, cls = '') {
  return available.has(name)
    ? `<img class="ico ${cls}" src="assets/icons/${name}.png" alt="" draggable="false">`
    : `<span class="ico-emoji ${cls}">${fallback}</span>`;
}

export const goodIcon = (g, cls) => icon(`goods/${g}`, GOODS[g].icon, cls);
export const bizIcon = (t, cls) => icon(`business/${t}`, BUSINESSES[t].icon, cls);
export const districtIcon = (t, cls) => icon(`district/${t}`, DISTRICTS[t].icon, cls);
export const uiIcon = (n, fallback, cls) => icon(`ui/${n}`, fallback, cls);
