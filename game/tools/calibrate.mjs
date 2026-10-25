// Калибровка экономики: для каждого типа бизнеса — маржа и окупаемость на лучших участках (прогноз при стандартных настройках).
//   node tools/calibrate.mjs [сид]
import { createGame, forecast, buildableTypes } from '../src/sim/index.js';
import { BUSINESSES } from '../src/data/businesses.js';

const s = createGame({ seed: Number(process.argv[2] || 42), companyNames: ['К'] });
const byType = {};
for (const lot of Object.values(s.world.lots)) {
  for (const t of buildableTypes(s, lot)) {
    if (BUSINESSES[t].storage) continue;
    (byType[t] ||= []).push(forecast(s, lot.id, t, null));
  }
}
const med = (a) => a[Math.floor(a.length / 2)];
console.log('тип'.padEnd(18), 'n'.padStart(4), 'выручка', 'маржа(топ25%)', 'маржа(медиана)', 'окуп.мес(топ25%)', 'капекс', ' сырьё/зп/аренда/содерж/рекл, % выручки');
for (const [t, fs] of Object.entries(byType)) {
  fs.sort((a, b) => b.profit / b.capex - a.profit / a.capex);
  const top = fs.slice(0, Math.max(1, Math.floor(fs.length / 4)));
  const m = (f) => f.profit / Math.max(1, f.revenue);
  console.log(t.padEnd(18), String(fs.length).padStart(4), String(Math.round(med(top).revenue)).padStart(7),
    (m(med(top)) * 100).toFixed(0).padStart(8) + '%', (m(med(fs)) * 100).toFixed(0).padStart(12) + '%',
    med(top).payback.toFixed(1).padStart(14), String(med(top).capex).padStart(10),
    '  ' + ['inputs', 'wages', 'rent', 'upkeep', 'marketing'].map((k) => Math.round((med(top).costs[k] / Math.max(1, med(top).revenue)) * 100)).join('/'));
}
