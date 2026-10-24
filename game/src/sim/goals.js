import { BUSINESSES } from '../data/businesses.js';
import { addNews, companyUnits, activeCompanies, netWorth, dateOf } from './state.js';

// Цели и достижения. progress(ctx) → [сейчас, нужно]. ctx считается один раз на компанию.
export const GOALS = [
  { id: 'first_business', icon: '🚀', name: 'Первый шаг', desc: 'Откройте первый бизнес', progress: (c) => [c.units.length, 1] },
  { id: 'profit_month', icon: '📈', name: 'В плюсе', desc: 'Закончите месяц с прибылью', progress: (c) => [c.co.history.some((m) => m.profit > 0) ? 1 : 0, 1] },
  { id: 'three_units', icon: '🏪', name: 'Маленькая сеть', desc: 'Владейте 3 бизнесами одновременно', progress: (c) => [c.units.length, 3] },
  { id: 'own_supplier', icon: '🔗', name: 'Своя цепочка', desc: 'Пусть ваш бизнес снабжается с вашего же производства', progress: (c) => [c.units.some((u) => Object.values(u.supplied || {}).includes('internal')) ? 1 : 0, 1] },
  { id: 'farm', icon: '🌾', name: 'Земля', desc: 'Заведите ферму или плантацию', progress: (c) => [c.units.filter((u) => BUSINESSES[u.type].category === 'farm').length, 1] },
  { id: 'coffee_chain', icon: '☕', name: 'От зерна до чашки', desc: 'Кофейная плантация, обжарка и кофейня — всё своё', progress: (c) => [['coffee_plantation', 'coffee_roastery', 'coffee_shop'].filter((t) => c.types.has(t)).length, 3] },
  { id: 'property', icon: '🔑', name: 'Собственник', desc: 'Купите помещение', progress: (c) => [c.ownedLots, 1] },
  { id: 'max_level', icon: '⬆️', name: 'Лучшее оборудование', desc: 'Улучшите бизнес до 3 уровня', progress: (c) => [Math.max(0, ...c.units.map((u) => u.level)), 3] },
  { id: 'two_countries', icon: '✈️', name: 'За границей', desc: 'Бизнесы в 2 странах', progress: (c) => [c.countries.size, 2] },
  { id: 'ten_units', icon: '🏢', name: 'Сеть', desc: 'Владейте 10 бизнесами', progress: (c) => [c.units.length, 10] },
  { id: 'worth_250k', icon: '💰', name: 'Четверть миллиона', desc: 'Капитал $250 000', progress: (c) => [c.worth, 250000] },
  { id: 'five_countries', icon: '🌍', name: 'Международная компания', desc: 'Бизнесы в 5 странах', progress: (c) => [c.countries.size, 5] },
  { id: 'millionaire', icon: '💎', name: 'Миллионер', desc: 'Капитал $1 000 000', progress: (c) => [c.worth, 1e6] },
  { id: 'fifty_units', icon: '🏙️', name: 'Империя', desc: 'Владейте 50 бизнесами', progress: (c) => [c.units.length, 50] },
  { id: 'ten_million', icon: '👑', name: 'Магнат', desc: 'Капитал $10 000 000', progress: (c) => [c.worth, 1e7] },
];

export function goalContext(state, co) {
  const units = companyUnits(state, co.id);
  let ownedLots = 0;
  for (const lot of Object.values(state.world.lots)) if (lot.ownerId === co.id) ownedLots++;
  return {
    co,
    units,
    ownedLots,
    types: new Set(units.map((u) => u.type)),
    countries: new Set(units.map((u) => state.world.places[u.placeId].country)),
    worth: netWorth(state, co.id),
  };
}

export function checkGoals(state) {
  for (const co of activeCompanies(state)) {
    co.goals ||= {};
    const ctx = goalContext(state, co);
    for (const g of GOALS) {
      if (co.goals[g.id] !== undefined) continue;
      const [cur, need] = g.progress(ctx);
      if (cur >= need) {
        co.goals[g.id] = state.day;
        addNews(state, 'good', `${g.icon} Достижение «${g.name}»: ${g.desc.toLowerCase()}.`, { goal: g.id }, co.id);
      }
    }
  }
}

// ---------- победа в PvP ----------
// state.victory: null | { type: 'worth', target } | { type: 'years', years }
export const VICTORY_OPTIONS = [
  { id: 'none', name: 'Без цели — играем, сколько хотим', victory: null },
  { id: 'worth1m', name: 'Первым набрать капитал $1 млн', victory: { type: 'worth', target: 1e6 } },
  { id: 'worth10m', name: 'Первым набрать капитал $10 млн', victory: { type: 'worth', target: 1e7 } },
  { id: 'years5', name: 'Богаче всех через 5 лет', victory: { type: 'years', years: 5 } },
  { id: 'years10', name: 'Богаче всех через 10 лет', victory: { type: 'years', years: 10 } },
];

export function victoryText(victory) {
  if (!victory) return 'без цели';
  if (victory.type === 'worth') return `первым набрать капитал $${victory.target.toLocaleString('ru-RU')}`;
  return `быть богаче всех к ${2000 + victory.years} году`;
}

// Проверяется в конце месяца
export function checkVictory(state) {
  const v = state.victory;
  if (!v || state.winner) return;
  const ranking = activeCompanies(state).map((c) => ({ c, worth: netWorth(state, c.id) })).sort((a, b) => b.worth - a.worth);
  let win = null;
  if (v.type === 'worth') win = ranking.find((r) => r.worth >= v.target);
  else if (dateOf(state.day + 1).getUTCFullYear() >= 2000 + v.years) win = ranking[0];
  if (state.mode === 'pvp' && ranking.length === 1 && Object.keys(state.companies).length > 1) win = ranking[0]; // остальные разорились
  if (!win) return;
  state.winner = { companyId: win.c.id, day: state.day, worth: Math.round(win.worth) };
  addNews(state, 'good', `🏆 Победа! Компания «${win.c.name}» — капитал $${Math.round(win.worth).toLocaleString('ru-RU')}.`);
}
