// Детерминированный ГСЧ (mulberry32). Состояние хранится в объекте { s }, который лежит внутри
// игрового состояния — поэтому одинаковый сид и одинаковые команды дают одинаковый мир.

export function createRng(seed) {
  return { s: seed >>> 0 };
}

export function rand(r) {
  let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(r, a, b) {
  return a + (b - a) * rand(r);
}

export function randInt(r, a, b) {
  return Math.floor(randRange(r, a, b + 1));
}

export function randPick(r, arr) {
  return arr[Math.floor(rand(r) * arr.length)];
}

export function randNormal(r) {
  const u = Math.max(rand(r), 1e-9);
  const v = rand(r);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function chance(r, p) {
  return rand(r) < p;
}
