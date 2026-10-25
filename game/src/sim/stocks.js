import { randNormal, rand } from './rng.js';
import { addNews, coreWorth, activeCompanies } from './state.js';
import { pay, receive, spendCompany, earnCompany } from './units.js';
/** @typedef {import('./types.js').State} State @typedef {import('./types.js').Unit} Unit @typedef {import('./types.js').Company} Company */

// Биржа. Бумаги («листинги»): ИИ-корпорации и компании игроков, вышедшие на IPO.
// listing.holders — сколько акций у каждой компании игроков; float — акции у публики (их можно купить).
// Для компании игрока holders[её id] — акции, которые остались у неё самой (владельца).
export const COMPANY_SHARES = 1_000_000;
export const IPO_MIN_WORTH = 500000;
export const IPO_MIN_MONTHS = 12;
export const TRADE_FEE = 0.005;
export const UNDERWRITING_FEE = 0.05;
export const CONTROL_SHARE = 0.5; // больше — контроль: решает, сколько платить дивидендов
export const ABSORB_SHARE = 0.75; // от стольких — можно поглотить компанию целиком
const IMPACT = 1.5; // сделка на 1% акций двигает цену на 1.5%

// Вымышленные корпорации. link — как цена связана с ценами товаров (нефтяникам хорошо от дорогой нефти)
const CORPS = [
  { id: 's1', name: 'Атлант Ойл', sector: 'Нефть и газ', eps: 0.9, pe: 11, growth: 0.002, vol: 0.016, link: { oil: 0.8 } },
  { id: 's2', name: 'Нова Фудс', sector: 'Продукты питания', eps: 0.35, pe: 18, growth: 0.003, vol: 0.010, link: { wheat: -0.3, milk: -0.3 } },
  { id: 's3', name: 'Меридиан Логистик', sector: 'Логистика', eps: 0.25, pe: 15, growth: 0.003, vol: 0.013, link: { fuel: -0.5 } },
  { id: 's4', name: 'Пиксель Софт', sector: 'Технологии', eps: 0.4, pe: 30, growth: 0.008, vol: 0.024, link: {} },
  { id: 's5', name: 'Аврора Ритейл', sector: 'Розничная торговля', eps: 0.3, pe: 16, growth: 0.003, vol: 0.011, link: { groceries: -0.3 } },
  { id: 's6', name: 'Гелиос Энерджи', sector: 'Энергетика', eps: 0.5, pe: 13, growth: 0.002, vol: 0.012, link: { fuel: 0.4 } },
  { id: 's7', name: 'Вектор Банк', sector: 'Финансы', eps: 0.6, pe: 10, growth: 0.003, vol: 0.014, link: {}, macro: true },
  { id: 's8', name: 'Агро Сфера', sector: 'Агропром', eps: 0.3, pe: 14, growth: 0.002, vol: 0.015, link: { wheat: 0.5, coffee_green: 0.3 } },
];

export function initStocks(rng) {
  const listings = {};
  for (const c of CORPS) {
    const eps = c.eps * (0.85 + 0.3 * rand(rng));
    const price = Math.round(eps * 12 * c.pe * 100) / 100;
    listings[c.id] = {
      id: c.id, kind: 'corp', name: c.name, sector: c.sector, shares: 10_000_000, float: 6_000_000,
      holders: {}, price, eps, sentiment: 1, hist: [price], div: 0,
    };
  }
  return { listings };
}

const corpDef = (id) => CORPS.find((c) => c.id === id);

export function listingOf(state, companyId) {
  return state.stocks?.listings[companyId] || null;
}

// Стоимость чужих акций в портфеле компании
export function portfolioValue(state, companyId) {
  let v = 0;
  for (const l of Object.values(state.stocks?.listings || {})) {
    if (l.id !== companyId) v += (l.holders[companyId] || 0) * l.price;
  }
  return v;
}

// Кто контролирует компанию (больше 50% акций у другой компании) — или null
export function controllerOf(state, listing) {
  if (listing.kind !== 'company') return null;
  for (const [id, n] of Object.entries(listing.holders)) {
    if (id !== listing.id && n > listing.shares * CONTROL_SHARE) return id;
  }
  return null;
}

export function stakeOf(listing, companyId) {
  return (listing.holders[companyId] || 0) / listing.shares;
}

// Справедливая цена компании игрока: капитал + 18 месячных прибылей (среднее за 3 мес.)
export function fairCompanyPrice(state, companyId) {
  const co = state.companies[companyId];
  const h = co.history.slice(-3);
  const avg = h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
  const core = coreWorth(state, companyId);
  const value = Math.max(0.2 * Math.max(core, 0), 0.8 * core + 18 * avg, 10000);
  return value / COMPANY_SHARES;
}

export function ipoCheck(state, companyId) {
  const co = state.companies[companyId];
  if (listingOf(state, companyId)) return 'Компания уже на бирже';
  if (co.history.length < IPO_MIN_MONTHS) return `Нужна история отчётности не меньше ${IPO_MIN_MONTHS} месяцев (сейчас ${co.history.length})`;
  if (coreWorth(state, companyId) < IPO_MIN_WORTH) return `Нужен капитал от $${IPO_MIN_WORTH.toLocaleString('ru-RU')}`;
  return null;
}

// IPO: продать публике часть акций. Деньги получает компания (минус 5% андеррайтерам).
export function doIpo(state, companyId, share) {
  const co = state.companies[companyId];
  const price = Math.round(fairCompanyPrice(state, companyId) * 0.9 * 100) / 100; // скидка для первых инвесторов
  const sold = Math.round(COMPANY_SHARES * share);
  state.stocks.listings[companyId] = {
    id: companyId, kind: 'company', name: co.name, sector: 'Компания игрока', shares: COMPANY_SHARES, float: sold,
    holders: { [companyId]: COMPANY_SHARES - sold }, price, sentiment: 1, hist: [price], ipoDay: state.day, div: 0,
  };
  const cash = sold * price * (1 - UNDERWRITING_FEE);
  receive(state, companyId, cash);
  return { price, cash };
}

// Сделка: qty > 0 — купить у публики, qty < 0 — продать публике. Для своей компании — выкуп / допэмиссия из своего пакета.
// Возвращает { ok, error?, qty, avg, total }
export function trade(state, companyId, listingId, qty) {
  const l = state.stocks.listings[listingId];
  if (!l) return { ok: false, error: 'Нет такой бумаги' };
  qty = Math.trunc(qty);
  if (!qty) return { ok: false, error: 'Укажите количество' };
  const own = l.holders[companyId] || 0;
  if (qty > 0 && qty > l.float) return { ok: false, error: `У публики только ${l.float.toLocaleString('ru-RU')} акций` };
  if (qty < 0 && -qty > own) return { ok: false, error: `У вас только ${own.toLocaleString('ru-RU')} акций` };
  const impact = (IMPACT * qty) / l.shares;
  const avg = l.price * (1 + impact / 2);
  const gross = Math.abs(qty) * avg;
  const self = listingId === companyId;
  const fee = self ? (qty < 0 ? gross * UNDERWRITING_FEE : gross * TRADE_FEE) : gross * TRADE_FEE;
  if (qty > 0) {
    if (state.companies[companyId].cash < gross + fee) return { ok: false, error: 'Не хватает денег' };
    pay(state, companyId, gross + fee);
  } else {
    receive(state, companyId, gross - fee);
  }
  l.holders[companyId] = own + qty;
  if (!l.holders[companyId]) delete l.holders[companyId];
  l.float -= qty;
  l.price = Math.max(0.01, Math.round(l.price * (1 + impact) * 100) / 100);
  return { ok: true, qty, avg, total: qty > 0 ? gross + fee : gross - fee };
}

function sectorFactor(state, def) {
  let f = 1;
  for (const [g, k] of Object.entries(def.link)) {
    const m = state.market.goods[g];
    if (m) f *= (m.price / m.mean) ** k;
  }
  if (def.macro) {
    const all = Object.values(state.countries);
    f *= all.reduce((s, c) => s + c.demand, 0) / all.length;
  }
  return f;
}

// Каждый день: цены колеблются вокруг справедливой
export function updateStocks(state) {
  const rng = state.rng;
  for (const l of Object.values(state.stocks.listings)) {
    let fair;
    let vol;
    if (l.kind === 'corp') {
      const def = corpDef(l.id);
      fair = l.eps * 12 * def.pe * sectorFactor(state, def) * l.sentiment;
      vol = def.vol;
    } else {
      if (!state.companies[l.id] || state.companies[l.id].bankrupt) continue;
      fair = fairCompanyPrice(state, l.id) * l.sentiment;
      vol = 0.012;
    }
    l.price += 0.04 * (fair - l.price) + l.price * vol * randNormal(rng);
    l.price = Math.max(0.01, Math.round(l.price * 100) / 100);
    l.sentiment += 0.03 * (1 - l.sentiment) + 0.01 * randNormal(rng);
    l.sentiment = Math.min(1.5, Math.max(0.6, l.sentiment));
    if (state.day % 7 === 0) {
      l.hist.push(l.price);
      if (l.hist.length > 104) l.hist.shift();
    }
  }
}

// Конец месяца (после закрытия отчётов): рост прибыли корпораций, дивиденды, отчёты-сюрпризы
export function monthlyStocks(state) {
  const rng = state.rng;
  for (const l of Object.values(state.stocks.listings)) {
    if (l.kind === 'corp') {
      const def = corpDef(l.id);
      l.eps *= 1 + def.growth + 0.02 * randNormal(rng);
      if (rand(rng) < 0.03) {
        const good = rand(rng) < 0.55;
        l.eps *= good ? 1.12 : 0.88;
        l.sentiment *= good ? 1.08 : 0.9;
        addNews(state, good ? 'good' : 'bad', `📈 ${l.name}: ${good ? 'отчёт лучше ожиданий, акции растут' : 'слабый отчёт, акции падают'}.`);
      }
      // корпорации платят 40% прибыли
      const dps = Math.max(0, l.eps * 0.4);
      l.div = dps;
      for (const [cid, n] of Object.entries(l.holders)) {
        if (state.companies[cid] && !state.companies[cid].bankrupt) earnCompany(state, cid, 'dividendsIn', n * dps);
      }
      continue;
    }
    const co = state.companies[l.id];
    if (!co || co.bankrupt) continue;
    l.name = co.name;
    const profit = co.history.at(-1)?.profit ?? 0;
    const total = Math.max(0, profit) * (co.payout ?? 0);
    const dps = total / l.shares;
    l.div = dps;
    if (dps <= 0) continue;
    const external = l.shares - (l.holders[l.id] || 0); // своим акциям дивиденды не платим
    const sum = external * dps;
    if (co.cash < sum) continue; // нет денег — дивиденды пропускаются
    spendCompany(state, l.id, 'dividendsOut', sum);
    for (const [cid, n] of Object.entries(l.holders)) {
      if (cid !== l.id && state.companies[cid] && !state.companies[cid].bankrupt) earnCompany(state, cid, 'dividendsIn', n * dps);
    }
  }
}

// Компания ушла с рынка (банкротство): её бумаги обнуляются, её пакеты в чужих бумагах возвращаются публике
export function delistCompany(state, companyId) {
  delete state.stocks.listings[companyId];
  for (const l of Object.values(state.stocks.listings)) {
    const n = l.holders[companyId];
    if (n) {
      l.float += n;
      delete l.holders[companyId];
    }
  }
}

// Поглощение: всё имущество цели переходит покупателю, миноритариям выплачивается рыночная цена
export function absorbCost(state, buyerId, targetId) {
  const l = state.stocks.listings[targetId];
  const rest = l.shares - (l.holders[buyerId] || 0) - (l.holders[targetId] || 0);
  return rest * l.price;
}

export function absorb(state, buyerId, targetId) {
  const l = state.stocks.listings[targetId];
  const buyer = state.companies[buyerId];
  const target = state.companies[targetId];
  // выкуп остальных акционеров (кроме самой цели)
  for (const [cid, n] of Object.entries(l.holders)) {
    if (cid === buyerId || cid === targetId) continue;
    if (state.companies[cid]) receive(state, cid, n * l.price);
  }
  pay(state, buyerId, absorbCost(state, buyerId, targetId));
  // имущество цели
  for (const u of Object.values(state.units)) {
    if (u.companyId !== targetId) continue;
    u.companyId = buyerId;
    u.brandId = null;
    u.tierQuality = 0;
    u.tierUpkeep = 1;
  }
  for (const lot of Object.values(state.world.lots)) if (lot.ownerId === targetId) lot.ownerId = buyerId;
  for (const c of state.contracts) if (c.companyId === targetId) c.companyId = buyerId;
  for (const s of state.shipments) if (s.companyId === targetId) s.companyId = buyerId;
  for (const b of Object.values(state.brands)) if (b.companyId === targetId) delete state.brands[b.id];
  for (const lic of target.licenses || []) if (!buyer.licenses.includes(lic)) buyer.licenses.push(lic);
  // пакеты цели в других бумагах
  for (const other of Object.values(state.stocks.listings)) {
    const n = other.holders[targetId];
    if (!n || other.id === targetId) continue;
    delete other.holders[targetId];
    if (other.id === buyerId) other.float += n; // свои акции у поглощённой — уходят публике
    else other.holders[buyerId] = (other.holders[buyerId] || 0) + n;
  }
  receive(state, buyerId, target.cash);
  pay(state, targetId, target.cash);
  buyer.loan += target.loan;
  target.loan = 0;
  target.bankrupt = true;
  target.absorbedBy = buyerId;
  delete state.stocks.listings[targetId];
  state.mapVersion++;
  addNews(state, 'warn', `🦈 Компания «${buyer.name}» поглотила «${target.name}»: все её бизнесы теперь принадлежат покупателю.`);
}

export function listedCompanies(state) {
  return activeCompanies(state).filter((c) => listingOf(state, c.id));
}
