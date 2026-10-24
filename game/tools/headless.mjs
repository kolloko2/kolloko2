// Прогон симуляции без интерфейса: простой бот открывает самые выгодные по прогнозу бизнесы.
// Нужен для балансировки: смотрим, не «взрывается» ли экономика и с какой скоростью растёт игрок.
//   node tools/headless.mjs [лет] [сид]
import { createGame, stepDays, applyCommand, forecast, buildableTypes, netWorth, formatDate } from '../src/sim/index.js';
import { BUSINESSES } from '../src/data/businesses.js';

const years = Number(process.argv[2] || 5);
const seed = Number(process.argv[3] || 42);
const state = createGame({ seed, companyNames: ['Бот'] });
const ME = 'c1';
const co = state.companies[ME];

function bestOpportunity() {
  let best = null;
  for (const lot of Object.values(state.world.lots)) {
    if (lot.unitId) continue;
    for (const type of buildableTypes(state, lot)) {
      const f = forecast(state, lot.id, type, ME);
      if (f.profit <= 0 || f.capex > co.cash - 10000) continue;
      const score = f.profit / f.capex;
      if (!best || score > best.score) best = { lot, type, f, score };
    }
  }
  return best;
}

const t0 = Date.now();
for (let month = 0; month < years * 12; month++) {
  for (let k = 0; k < 2; k++) {
    const op = bestOpportunity();
    if (op) applyCommand(state, { type: 'openBusiness', lotId: op.lot.id, businessType: op.type }, ME);
  }
  stepDays(state, 30);
  if (co.bankrupt) break;
  if (month % 12 === 11) {
    const units = Object.values(state.units);
    const byType = {};
    for (const u of units) byType[BUSINESSES[u.type].icon] = (byType[BUSINESSES[u.type].icon] || 0) + 1;
    const h = co.history.at(-1);
    console.log(
      `${formatDate(state.day)}: касса $${Math.round(co.cash).toLocaleString('ru-RU')}, ` +
      `капитал $${Math.round(netWorth(state, ME)).toLocaleString('ru-RU')}, прибыль/мес $${h.profit.toLocaleString('ru-RU')}, ` +
      `бизнесов ${units.length} ${JSON.stringify(byType)}`,
    );
  }
}
const prices = Object.entries(state.market.goods).map(([g, m]) => `${g}=${m.price.toFixed(2)}`).join(' ');
console.log('Цены:', prices);
console.log(`Время прогона: ${Date.now() - t0} мс`);
