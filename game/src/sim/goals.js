import { BUSINESSES } from '../data/businesses.js';
import { addNews, companyUnits, activeCompanies, netWorth, dateOf } from './state.js';
import { franchiseCount } from './franchise.js';
import { portfolioValue } from './stocks.js';

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
  { id: 'diversified', icon: '🧩', name: 'Конгломерат', desc: 'Владейте бизнесами 6 разных типов', progress: (c) => [c.types.size, 6] },
  { id: 'services', icon: '🤝', name: 'Своя инфраструктура', desc: 'Откройте грузоперевозки, рекламное агентство и IT-студию', progress: (c) => [['trucking', 'ad_agency', 'it_studio'].filter((t) => c.types.has(t)).length, 3] },
  { id: 'managers', icon: '👔', name: 'Команда', desc: 'Наймите 5 управляющих', progress: (c) => [c.units.filter((u) => u.manager).length, 5] },
  { id: 'ten_units', icon: '🏢', name: 'Сеть', desc: 'Владейте 10 бизнесами', progress: (c) => [c.units.length, 10] },
  { id: 'worth_250k', icon: '💰', name: 'Четверть миллиона', desc: 'Капитал $250 000', progress: (c) => [c.worth, 250000] },
  { id: 'five_countries', icon: '🌍', name: 'Международная компания', desc: 'Бизнесы в 5 странах', progress: (c) => [c.countries.size, 5] },
  { id: 'millionaire', icon: '💎', name: 'Миллионер', desc: 'Капитал $1 000 000', progress: (c) => [c.worth, 1e6] },
  { id: 'oil_baron', icon: '🛢️', name: 'Нефтяной барон', desc: 'Скважина, НПЗ и АЗС — всё своё', progress: (c) => [['oil_well', 'refinery', 'gas_station'].filter((t) => c.types.has(t)).length, 3] },
  { id: 'franchise', icon: '🏷️', name: 'Франшиза', desc: 'Пусть под вашей маркой работают 5 франчайзи', progress: (c) => [c.franchisees, 5] },
  { id: 'ipo', icon: '🔔', name: 'Публичная компания', desc: 'Выйдите на биржу (IPO)', progress: (c) => [c.listed ? 1 : 0, 1] },
  { id: 'investor', icon: '📈', name: 'Инвестор', desc: 'Портфель акций других компаний на $500 000', progress: (c) => [c.portfolio, 500000] },
  { id: 'fifty_units', icon: '🏙️', name: 'Империя', desc: 'Владейте 50 бизнесами', progress: (c) => [c.units.length, 50] },
  { id: 'ten_million', icon: '👑', name: 'Магнат', desc: 'Капитал $10 000 000', progress: (c) => [c.worth, 1e7] },
  { id: 'hundred_million', icon: '🏛️', name: 'Корпорация', desc: 'Капитал $100 000 000', progress: (c) => [c.worth, 1e8] },
  { id: 'billion', icon: '🌐', name: 'Империя', desc: 'Капитал $1 000 000 000 — обычно на это уходят десятилетия', progress: (c) => [c.worth, 1e9] },
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
    franchisees: Object.values(state.brands).filter((b) => b.companyId === co.id).reduce((s, b) => s + franchiseCount(b), 0),
    listed: Boolean(state.stocks?.listings[co.id]),
    portfolio: portfolioValue(state, co.id),
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
  { id: 'worth100m', name: 'Первым набрать капитал $100 млн (долгая партия)', victory: { type: 'worth', target: 1e8 } },
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
