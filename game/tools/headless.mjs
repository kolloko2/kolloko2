// Прогон симуляции без интерфейса — для балансировки темпа игры.
//   node tools/headless.mjs [лет] [сид] [naive|smart]
// naive — «кликер»: открывает лучшее по прогнозу и больше ничего не делает. Должен застрять или разориться.
// smart — управленец: сети, обновление точек, управляющие, закрытие убыточных, осторожный кредит.
// Цель баланса: smart выходит на империю (сотни бизнесов, $100 млн+) за 40–50 игровых лет.
import {
  createGame, stepDays, applyCommand, forecast, buildableTypes, netWorth, formatDate, companyUnits, monthProfit,
  condition, renovateCost, attention, loanLimit, managerCost,
} from '../src/sim/index.js';
import { BUSINESSES } from '../src/data/businesses.js';

const years = Number(process.argv[2] || 5);
const seed = Number(process.argv[3] || 42);
const bot = process.argv[4] || 'smart';
const state = createGame({ seed, companyNames: ['Бот'], rivals: process.argv[5] === 'norivals' ? 0 : 4 });
const ME = 'c1';
const co = state.companies[ME];
const smart = bot === 'smart';

// Лучшая возможность: прибыль к вложениям
function bestOpportunity(reserve) {
  let best = null;
  for (const lot of Object.values(state.world.lots)) {
    if (lot.unitId || (lot.ownerId && lot.ownerId !== ME)) continue;
    for (const type of buildableTypes(state, lot)) {
      if (BUSINESSES[type].storage) continue;
      const f = forecast(state, lot.id, type, ME);
      const cost = f.capex + f.extra;
      if (f.locked || f.profit <= 0 || cost > co.cash - reserve) continue;
      if (smart && f.payback > 48) continue;
      // прогноз розницы не знает о будущих конкурентах — умный игрок делает поправку
      const score = (f.profit * (BUSINESSES[type].retail ? 0.7 : 1)) / cost;
      if (!best || score > best.score) best = { lot, type, f, score };
    }
  }
  return best;
}

function monthlyCosts() {
  const h = co.history.at(-1);
  return h ? Math.max(20000, h.revenue - h.profit) / 2 : 20000;
}

function manage() {
  const units = companyUnits(state, ME);
  // сети: все точки продаж одного типа — в одну сеть с автообновлением
  for (const type of new Set(units.filter((u) => BUSINESSES[u.type].retail).map((u) => u.type))) {
    const same = units.filter((u) => u.type === type);
    let brand = Object.values(state.brands).find((b) => b.companyId === ME && b.type === type);
    if (!brand && same.length >= 2) {
      const r = applyCommand(state, { type: 'createBrand', name: `Сеть ${type}`, businessType: type, tier: 'std', unitIds: same.map((u) => u.id) }, ME);
      brand = state.brands[r.brandId];
      applyCommand(state, { type: 'setAutoRenew', brandId: brand.id, on: true }, ME);
    }
    if (brand) for (const u of same) if (u.brandId !== brand.id) applyCommand(state, { type: 'joinBrand', unitId: u.id, brandId: brand.id }, ME);
  }
  for (const u of units) {
    const def = BUSINESSES[u.type];
    // производства и услуги обновляем сами
    if (!u.brandId && condition(u) < 60 && co.cash > renovateCost(state, u) * 3) applyCommand(state, { type: 'renovate', unitId: u.id }, ME);
    // штат под спрос: без управляющего — раз в месяц вручную
    if (!u.manager && def.retail && u.last?.days) {
      const want = Math.max(def.staff.min, Math.min(def.staff.max, Math.ceil(((u.last.customers + u.last.lost) / u.last.days / def.retail.perStaff) * 1.05)));
      if (want !== u.staff) applyCommand(state, { type: 'setStaff', unitId: u.id, staff: want }, ME);
    }
    // убыточные полгода — закрыть
    if (u.history.length >= 6 && u.history.slice(-6).every((p) => p < 0)) applyCommand(state, { type: 'closeBusiness', unitId: u.id }, ME);
  }
  // управляющие в самые прибыльные точки, когда внимания не хватает
  const att = attention(state, ME);
  if (att.excess > 0) {
    const cand = companyUnits(state, ME).filter((u) => !u.manager && u.last).sort((a, b) => monthProfit(b.last) - monthProfit(a.last));
    for (const u of cand.slice(0, att.excess * 2)) {
      const need = BUSINESSES[u.type].retail ? 1.2 : 0; // производствам управляющий нужен всегда
      if (monthProfit(u.last) > managerCost(state.world.places[u.placeId], u.type) * need) applyCommand(state, { type: 'hireManager', unitId: u.id }, ME);
    }
  }
  // региональные директора там, где 6+ бизнесов
  const byCountry = {};
  for (const u of companyUnits(state, ME)) byCountry[state.world.places[u.placeId].country] = (byCountry[state.world.places[u.placeId].country] || 0) + 1;
  if (!process.env.NODIR) for (const [c, n] of Object.entries(byCountry)) if (n >= 6 && !co.directors?.[c]) applyCommand(state, { type: 'hireDirector', country: c }, ME);
  // кредит: держим подушку на 2 месяца расходов, берём не больше половины лимита
  const reserve = monthlyCosts() * 2;
  if (co.cash < reserve && co.loan < loanLimit(state, ME) * 0.5) applyCommand(state, { type: 'takeLoan', amount: Math.round(reserve - co.cash) }, ME);
  if (co.cash > reserve * 2 && co.loan > 0) applyCommand(state, { type: 'repayLoan', amount: Math.min(co.loan, co.cash - reserve * 1.5) }, ME);
}

const opened = []; // для проверки точности прогноза
const t0 = Date.now();
const every = years > 10 ? 5 : 1;
for (let month = 0; month < years * 12; month++) {
  for (let k = 0; k < (smart ? 3 : 2); k++) {
    const op = bestOpportunity(smart ? monthlyCosts() * 1.5 : 10000);
    if (!op) break;
    const r = applyCommand(state, { type: 'openBusiness', lotId: op.lot.id, businessType: op.type }, ME);
    if (r.ok) opened.push({ id: r.unitId, type: op.type, f: op.f.profit + op.f.costs.overhead, month });
  }
  stepDays(state, 30);
  if (smart) manage();
  if (co.bankrupt) {
    console.log(`${formatDate(state.day)}: банкротство`);
    break;
  }
  if (month % 12 === 11 && ((month + 1) / 12) % every === 0) {
    const units = companyUnits(state, ME);
    const byType = {};
    for (const u of units) byType[BUSINESSES[u.type].icon] = (byType[BUSINESSES[u.type].icon] || 0) + 1;
    const h = co.history.at(-1);
    if (process.env.ACC) console.log('   месяц:', JSON.stringify(h));
    console.log(
      `год ${(month + 1) / 12}: капитал $${Math.round(netWorth(state, ME)).toLocaleString('ru-RU')}, касса $${Math.round(co.cash).toLocaleString('ru-RU')}, ` +
      `долг $${Math.round(co.loan).toLocaleString('ru-RU')}, прибыль/мес $${h.profit.toLocaleString('ru-RU')}, бизнесов ${units.length} ${JSON.stringify(byType)}`,
    );
  }
}
if (process.env.ACC) {
  const by = {};
  for (const o of opened) {
    const u = state.units[o.id];
    if (!u || u.history.length < 8) continue;
    const act = u.history.slice(3, 12).reduce((a, b) => a + b, 0) / u.history.slice(3, 12).length;
    (by[o.type] ||= []).push([o.f, act]);
  }
  for (const [t, xs] of Object.entries(by)) {
    const f = xs.reduce((a, x) => a + x[0], 0) / xs.length;
    const a = xs.reduce((s, x) => s + x[1], 0) / xs.length;
    console.log(`точность ${t}: прогноз ${Math.round(f)}, факт ${Math.round(a)} (n=${xs.length})`);
  }
  const closed = opened.filter((o) => !state.units[o.id]).length;
  console.log(`открыто ${opened.length}, закрыто ${closed}`);
}
const prices = Object.entries(state.market.goods).map(([g, m]) => `${g}=${m.price.toFixed(2)}`).join(' ');
console.log('Цены:', prices);
console.log(`Время прогона: ${Date.now() - t0} мс`);
