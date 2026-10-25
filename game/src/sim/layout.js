// Геометрия кварталов района — общая для симуляции (где стоят участки и здания конкурентов)
// и для карты (где рисуются кварталы). Только чистые функции от id района: одинаково везде.

export function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

// Размеры квартала: в промзоне крупнее, в престижном районе — просторнее
export function blockSize(type) {
  const big = type === 'industrial' ? 1.7 : type === 'premium' ? 1.3 : 1;
  return { block: 95 * big, street: 20 };
}

export const districtRotation = (d) => (hash(strHash(d.id), 1) - 0.5) * 0.5;

/**
 * Кварталы района: смещение центра квартала от центра района в метрах (x — на восток, y — на север).
 * park — сквер (не застраивается), split — квартал из двух зданий.
 * @param {{ id: string, type: string, radius: number }} d
 * @returns {{ i: number, j: number, x: number, y: number, park: boolean, split: boolean }[]}
 */
export function districtBlocks(d) {
  const seed = strHash(d.id);
  const { block, street } = blockSize(d.type);
  const step = block + street;
  const R = d.radius;
  const rot = districtRotation(d);
  const n = Math.ceil(R / step) + 1;
  const out = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const edge = R - Math.hypot(i * step, j * step);
      if (edge < 0) continue;
      if (edge < step * 1.5 && hash(seed + i, j, 5) > edge / (step * 1.5)) continue;
      const v = hash(seed + i, j, 3);
      // экранные оси (y вниз) → метры (y на север), с поворотом района
      const sx = i * step;
      const sy = j * step;
      const rx = sx * Math.cos(rot) - sy * Math.sin(rot);
      const ry = sx * Math.sin(rot) + sy * Math.cos(rot);
      out.push({ i, j, x: rx, y: -ry, park: v < 0.11, split: v > 0.6 });
    }
  }
  return out;
}

/**
 * Места под здания: квартал целиком или его половина. Отсортированы от центра района к краю.
 * @returns {{ x: number, y: number, w: number, h: number, key: string }[]}
 */
export function districtSlots(d) {
  const { block } = blockSize(d.type);
  const rot = districtRotation(d);
  const slots = [];
  for (const b of districtBlocks(d)) {
    if (b.park) continue;
    if (!b.split) {
      slots.push({ x: b.x, y: b.y, w: block, h: block, key: `${b.i}_${b.j}` });
      continue;
    }
    // две половины: сдвиг на четверть квартала вдоль экранной оси y (с поворотом)
    for (const [k, s] of /** @type {[string, number][]} */ ([['a', -0.265], ['b', 0.265]])) {
      const sy = s * block;
      slots.push({ x: b.x - sy * Math.sin(rot), y: b.y - sy * Math.cos(rot), w: block, h: block * 0.47, key: `${b.i}_${b.j}${k}` });
    }
  }
  return slots.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
}
