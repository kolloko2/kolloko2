import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepDays, applyCommand, forecast, buildableTypes, isOver } from '../src/sim/index.js';

function firstLot(state, placeId, type, skip = 0) {
  return Object.values(state.world.lots).filter((l) => l.placeId === placeId && !l.unitId && buildableTypes(state, l).includes(type))[skip];
}

function open(state, placeId, type, companyId = 'c1') {
  const lot = firstLot(state, placeId, type);
  const r = applyCommand(state, { type: 'openBusiness', lotId: lot.id, businessType: type }, companyId);
  assert.ok(r.ok, r.error);
  return state.units[r.unitId];
}

test('мир генерируется детерминированно', () => {
  const a = createGame({ seed: 5 });
  const b = createGame({ seed: 5 });
  assert.equal(JSON.stringify(a.world), JSON.stringify(b.world));
  assert.ok(Object.keys(a.world.lots).length > 500);
});

test('одинаковые команды дают одинаковый результат', () => {
  const run = () => {
    const s = createGame({ seed: 9 });
    open(s, 'ber', 'coffee_shop');
    stepDays(s, 200);
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
});

test('кофейня обслуживает клиентов и зарабатывает', () => {
  const s = createGame({ seed: 1 });
  s.companies.c1.cash = 200000;
  const unit = open(s, 'ber', 'coffee_shop');
  stepDays(s, 70);
  assert.ok(unit.last.customers > 1000, `клиентов ${unit.last.customers}`);
  assert.ok(unit.last.revenue > 0);
});

test('деньги сходятся у каждой компании: касса = старт + приходы − расходы', () => {
  const s = createGame({ seed: 3, mode: 'pvp', companyNames: ['А', 'Б'] });
  const start = { c1: 1500000, c2: 6000000 };
  s.companies.c1.cash = start.c1;
  s.companies.c2.cash = start.c2;
  open(s, 'nyc', 'coffee_shop', 'c1');
  open(s, 'chi', 'mill', 'c1');
  open(s, 'nyc', 'coffee_shop', 'c2');
  applyCommand(s, { type: 'takeLoan', amount: 20000 }, 'c2');
  // c2 покупает помещение, где арендует c1 — аренда пойдёт от c1 к c2
  const lot = Object.values(s.world.lots).find((l) => l.unitId && s.units[l.unitId].companyId === 'c1');
  assert.ok(applyCommand(s, { type: 'buyLot', lotId: lot.id }, 'c2').ok);
  stepDays(s, 120);
  for (const co of Object.values(s.companies).filter((c) => !c.ai)) {
    assert.ok(Math.abs(co.cash - (start[co.id] + co.totals.in - co.totals.out)) < 1e-6, co.id);
  }
  assert.ok(s.companies.c2.history.at(-1).rentIncome > 0);
});

test('обжарка снабжает кофейни своей компании без рынка', () => {
  const s = createGame({ seed: 4 });
  s.companies.c1.cash = 1000000;
  const shop = open(s, 'ber', 'coffee_shop');
  const roastery = open(s, 'ber', 'coffee_roastery');
  stepDays(s, 40);
  assert.equal(shop.supplied.coffee_roasted, 'internal');
  assert.ok(roastery.last.revInternal > 0);
});

test('PvP: обжарка чужой компании не снабжает мою кофейню', () => {
  const s = createGame({ seed: 4, mode: 'pvp', companyNames: ['А', 'Б'] });
  s.companies.c1.cash = 1000000;
  s.companies.c2.cash = 1000000;
  const shop = open(s, 'ber', 'coffee_shop', 'c1');
  open(s, 'ber', 'coffee_roastery', 'c2');
  stepDays(s, 40);
  assert.equal(shop.supplied.coffee_roasted, 'market');
});

test('PvP: нельзя управлять чужим бизнесом', () => {
  const s = createGame({ seed: 4, mode: 'pvp', companyNames: ['А', 'Б'] });
  const shop = open(s, 'ber', 'fastfood', 'c1');
  const r = applyCommand(s, { type: 'setPrice', unitId: shop.id, productId: 'hotdog', price: 0.5 }, 'c2');
  assert.equal(r.ok, false);
  assert.equal(applyCommand(s, { type: 'closeBusiness', unitId: shop.id }, 'c2').ok, false);
});

test('PvP: конкуренты в одном районе делят покупателей', () => {
  const s = createGame({ seed: 11, mode: 'pvp', companyNames: ['А', 'Б'] });
  s.companies.c1.cash = 300000;
  s.companies.c2.cash = 300000;
  const a = open(s, 'ber', 'coffee_shop', 'c1');
  stepDays(s, 20);
  const alone = a.today.potential;
  const lot = s.world.lots[a.lotId];
  const other = s.world.districts[lot.districtId].lotIds.map((id) => s.world.lots[id]).find((l) => !l.unitId);
  assert.ok(applyCommand(s, { type: 'openBusiness', lotId: other.id, businessType: 'coffee_shop' }, 'c2').ok);
  applyCommand(s, { type: 'setPrice', unitId: Object.keys(s.units).at(-1), productId: 'coffee', price: 1 }, 'c2');
  stepDays(s, 5);
  assert.ok(a.today.potential < alone * 0.9, `${a.today.potential} vs ${alone}`);
});

test('нельзя открыть плантацию кофе в Канзасе', () => {
  const s = createGame({ seed: 2 });
  const lot = Object.values(s.world.lots).find((l) => l.placeId === 'r_kansas');
  const r = applyCommand(s, { type: 'openBusiness', lotId: lot.id, businessType: 'coffee_plantation' }, 'c1');
  assert.equal(r.ok, false);
});

test('прогноз даёт осмысленные числа', () => {
  const s = createGame({ seed: 6 });
  const lot = firstLot(s, 'par', 'coffee_shop');
  const f = forecast(s, lot.id, 'coffee_shop', 'c1');
  assert.ok(f.capex > 0 && f.revenue > 0 && Number.isFinite(f.profit));
});

test('без денег — банкротство; в PvP игра продолжается для остальных', () => {
  const s = createGame({ seed: 8, mode: 'pvp', companyNames: ['А', 'Б'] });
  s.companies.c1.cash = 200000;
  open(s, 'lon', 'coffee_shop', 'c1');
  s.companies.c1.cash = -1e6;
  stepDays(s, 60);
  assert.equal(s.companies.c1.bankrupt, true);
  assert.equal(Object.values(s.units).filter((u) => u.companyId === 'c1').length, 0);
  assert.equal(isOver(s), false);
  const day = s.day;
  stepDays(s, 5);
  assert.equal(s.day, day + 5);
});

test('достижения засчитываются один раз и попадают в новости', async () => {
  const { GOALS } = await import('../src/sim/index.js');
  const s = createGame({ seed: 12 });
  s.companies.c1.cash = 300000;
  open(s, 'ber', 'fastfood');
  stepDays(s, 3);
  assert.ok(s.companies.c1.goals.first_business !== undefined);
  const count = s.news.filter((n) => n.ref?.goal === 'first_business').length;
  stepDays(s, 40);
  assert.equal(s.news.filter((n) => n.ref?.goal === 'first_business').length, count);
  assert.ok(GOALS.length >= 10);
});

test('PvP: победа по капиталу останавливает игру', () => {
  const s = createGame({ seed: 13, mode: 'pvp', companyNames: ['А', 'Б'], victory: { type: 'worth', target: 150000 } });
  s.companies.c2.cash = 200000;
  stepDays(s, 35);
  assert.equal(s.winner?.companyId, 'c2');
  assert.equal(isOver(s), true);
  const day = s.day;
  stepDays(s, 3);
  assert.equal(s.day, day);
});

test('регионы: кофе-зерно в Латинской Америке дешевле, чем в Европе', async () => {
  const { buyPrice } = await import('../src/sim/index.js');
  const s = createGame({ seed: 14 });
  const sao = s.world.places.sao;
  const ber = s.world.places.ber;
  assert.ok(buyPrice(s, 'coffee_green', sao) < buyPrice(s, 'coffee_green', ber) * 0.85);
});

test('логистика: зерно из Бразилии едет в Берлин больше недели', () => {
  const s = createGame({ seed: 15 });
  s.companies.c1.cash = 2000000;
  const farm = open(s, 'r_minas', 'coffee_plantation');
  const roastery = open(s, 'ber', 'coffee_roastery');
  stepDays(s, 3);
  const sh = s.shipments.find((x) => x.to === roastery.id && x.from === farm.id);
  assert.ok(sh, 'есть груз в пути');
  assert.ok(sh.arrive - sh.sent >= 10, `в пути ${sh.arrive - sh.sent} дней`);
  stepDays(s, 30);
  assert.equal(roastery.supplied.coffee_green, 'internal');
  assert.ok(roastery.inv.coffee_green.q > 0);
});

test('склад: держит запас и снабжает точки рядом', () => {
  const s = createGame({ seed: 16 });
  s.companies.c1.cash = 2000000;
  const shop = open(s, 'ber', 'coffee_shop');
  const wh = open(s, 'ber', 'warehouse');
  stepDays(s, 20);
  assert.ok(wh.usage.coffee_roasted > 0, 'склад знает потребность точки');
  assert.ok(wh.inv.coffee_roasted?.q > wh.usage.coffee_roasted * 5, 'склад держит запас');
  assert.equal(shop.supplied.coffee_roasted, 'warehouse');
});

test('контракт: фиксированная цена, поставки каждый день, штраф за разрыв', () => {
  const s = createGame({ seed: 17 });
  s.companies.c1.cash = 500000;
  const shop = open(s, 'ber', 'coffee_shop');
  stepDays(s, 5);
  const r = applyCommand(s, { type: 'signContract', unitId: shop.id, good: 'milk', side: 'buy', months: 3 }, 'c1');
  assert.ok(r.ok, r.error);
  const c = s.contracts[0];
  stepDays(s, 10);
  assert.equal(shop.supplied.milk, 'contract');
  const cashBefore = s.companies.c1.cash;
  assert.ok(applyCommand(s, { type: 'cancelContract', contractId: c.id }, 'c1').ok);
  assert.ok(s.companies.c1.cash < cashBefore, 'штраф списан');
  assert.equal(s.contracts.length, 0);
});

test('PvP: нельзя расторгнуть чужой контракт', () => {
  const s = createGame({ seed: 18, mode: 'pvp', companyNames: ['А', 'Б'] });
  s.companies.c1.cash = 500000;
  const shop = open(s, 'ber', 'coffee_shop', 'c1');
  stepDays(s, 3);
  applyCommand(s, { type: 'signContract', unitId: shop.id, good: 'cups', side: 'buy', months: 6 }, 'c1');
  assert.equal(applyCommand(s, { type: 'cancelContract', contractId: s.contracts[0].id }, 'c2').ok, false);
});

test('новые бизнесы: супермаркет только на большой площади, услуги зарабатывают и дают бонус', async () => {
  const { canBuildHere, retailCapacity } = await import('../src/sim/index.js');
  const s = createGame({ seed: 19 });
  const small = Object.values(s.world.lots).find((l) => l.zoning === 'commercial' && l.area < 120);
  assert.equal(canBuildHere(s, small, 'supermarket'), false);
  s.companies.c1.cash = 2000000;
  const shop = open(s, 'ber', 'coffee_shop');
  stepDays(s, 2);
  const capBefore = retailCapacity(s, shop);
  const it = open(s, 'ber', 'it_studio');
  stepDays(s, 3);
  assert.ok(it.today.revenue > 0, 'IT-студия зарабатывает');
  assert.ok(retailCapacity(s, shop) > capBefore * 1.05, 'кассовое ПО ускоряет точку');
});

test('цепочка мяса: скотоводческая ферма → мясокомбинат → фастфуд', () => {
  const s = createGame({ seed: 20 });
  s.companies.c1.cash = 3000000;
  open(s, 'r_pampas', 'livestock_farm');
  const plant = open(s, 'bue', 'meat_plant');
  const kiosk = open(s, 'bue', 'fastfood');
  stepDays(s, 45);
  assert.equal(plant.supplied.cattle, 'internal');
  assert.equal(kiosk.supplied.meat, 'internal');
});

test('персонал: низкая зарплата роняет мораль и производительность, увольнения', async () => {
  const { efficiency } = await import('../src/sim/index.js');
  const s = createGame({ seed: 21 });
  s.companies.c1.cash = 500000;
  const shop = open(s, 'ber', 'coffee_shop');
  applyCommand(s, { type: 'setStaff', unitId: shop.id, staff: 6 }, 'c1');
  const e0 = efficiency(s, shop);
  assert.ok(applyCommand(s, { type: 'setWage', unitId: shop.id, level: 0.8 }, 'c1').ok);
  stepDays(s, 120);
  assert.ok(shop.morale < 50, `мораль ${shop.morale}`);
  assert.ok(efficiency(s, shop) < e0);
  assert.equal(applyCommand(s, { type: 'setWage', unitId: shop.id, level: 0.5 }, 'c1').ok, false);
});

test('внимание: больше 5 точек без управляющих — штраф, управляющий его снимает', async () => {
  const { attention, efficiency } = await import('../src/sim/index.js');
  const s = createGame({ seed: 22 });
  s.companies.c1.cash = 5000000;
  const units = [];
  for (const city of ['ber', 'par', 'lon', 'mad', 'rom', 'ams', 'nyc', 'chi']) units.push(open(s, city, 'fastfood'));
  stepDays(s, 1);
  assert.equal(attention(s, 'c1').excess, 3);
  const before = efficiency(s, units[0]);
  assert.ok(applyCommand(s, { type: 'hireManager', unitId: units[0].id }, 'c1').ok);
  stepDays(s, 1);
  assert.equal(attention(s, 'c1').excess, 2);
  assert.ok(efficiency(s, units[0]) > before);
});

test('управляющий подбирает штат под спрос', () => {
  const s = createGame({ seed: 23 });
  s.companies.c1.cash = 500000;
  const shop = open(s, 'ber', 'coffee_shop');
  applyCommand(s, { type: 'setStaff', unitId: shop.id, staff: 12 }, 'c1');
  applyCommand(s, { type: 'hireManager', unitId: shop.id }, 'c1');
  stepDays(s, 15);
  assert.ok(shop.staff < 12, `штат ${shop.staff}`);
});

function berlinLots(s, type, n) {
  return Object.values(s.world.lots).filter((l) => l.placeId === 'ber' && !l.unitId && buildableTypes(s, l).includes(type)).slice(0, n);
}

test('сеть: точки одной сети в городе получают больше клиентов, чем такие же независимые', () => {
  const run = (withBrand) => {
    const s = createGame({ seed: 31 });
    s.companies.c1.cash = 2000000;
    const ids = berlinLots(s, 'coffee_shop', 5).map((l) => applyCommand(s, { type: 'openBusiness', lotId: l.id, businessType: 'coffee_shop', brandId: null }, 'c1').unitId);
    if (withBrand) assert.ok(applyCommand(s, { type: 'createBrand', name: 'Бин', businessType: 'coffee_shop', tier: 'std', unitIds: ids }, 'c1').ok);
    stepDays(s, 150);
    return ids.reduce((sum, id) => sum + s.units[id].last.customers, 0);
  };
  const solo = run(false);
  const chain = run(true);
  assert.ok(chain > solo * 1.08, `сеть ${chain} vs отдельные ${solo}`);
});

test('сеть: цена меняется во всех точках и подстраивается под город', () => {
  const s = createGame({ seed: 32 });
  s.companies.c1.cash = 3000000;
  const a = open(s, 'ber', 'coffee_shop');
  const b = open(s, 'msk', 'coffee_shop');
  const r = applyCommand(s, { type: 'createBrand', name: 'Премиум', businessType: 'coffee_shop', tier: 'std', unitIds: [a.id, b.id] }, 'c1');
  assert.ok(r.ok, r.error);
  assert.ok(applyCommand(s, { type: 'updateBrand', brandId: r.brandId, priceRatio: { coffee: 1.3 } }, 'c1').ok);
  assert.ok(a.prices.coffee > b.prices.coffee, 'в Берлине норма выше, чем в Москве');
  assert.ok(Math.abs(a.prices.coffee / b.prices.coffee - s.units[a.id].prices.coffee / s.units[b.id].prices.coffee) < 1e-9);
  assert.equal(applyCommand(s, { type: 'setPrice', unitId: a.id, productId: 'coffee', price: 2 }, 'c1').ok, false, 'цены точки сети — только через сеть');
});

test('расширение: сбор за выход в новую страну и надбавка без местной команды', async () => {
  const { foreignFactor, purchasingDiscount } = await import('../src/sim/index.js');
  const s = createGame({ seed: 33 });
  s.companies.c1.cash = 3000000;
  const home = open(s, 'msk', 'fastfood');
  assert.equal(s.companies.c1.homeCountry, 'RU');
  const before = s.companies.c1.cash;
  const lot = firstLot(s, 'ber', 'fastfood');
  const capex = (await import('../src/sim/index.js')).capexFor(s, lot, 'fastfood');
  const r = applyCommand(s, { type: 'openBusiness', lotId: lot.id, businessType: 'fastfood' }, 'c1');
  assert.ok(before - s.companies.c1.cash > capex, 'заплачен сбор за выход на рынок');
  const abroad = s.units[r.unitId];
  stepDays(s, 1);
  assert.equal(foreignFactor(s, home), 1);
  assert.ok(foreignFactor(s, abroad) > 1, 'без местной команды дороже');
  open(s, 'ber', 'fastfood');
  open(s, 'ber', 'fastfood');
  stepDays(s, 1);
  assert.equal(foreignFactor(s, abroad), 1, 'с 3 точками в стране — своя команда');
  assert.ok(purchasingDiscount(s, 'c1', s.world.places.ber) > 0, 'оптовая скидка в регионе');
});

// ---------- страны, франшиза, биржа ----------

test('пошлина: свой товар из другой страны облагается, внутри ЕС — нет', () => {
  const s = createGame({ seed: 4 });
  s.companies.c1.cash = 3e6;
  open(s, 'ber', 'coffee_shop');
  open(s, 'sao', 'coffee_roastery');
  stepDays(s, 70);
  const shop = Object.values(s.units).find((u) => u.type === 'coffee_shop');
  assert.equal(shop.supplied.coffee_roasted, 'internal');
  assert.ok(shop.last.duty > 0, 'из Бразилии в Германию — пошлина');

  const t = createGame({ seed: 4 });
  t.companies.c1.cash = 3e6;
  open(t, 'ber', 'coffee_shop');
  open(t, 'ams', 'coffee_roastery');
  stepDays(t, 70);
  const shop2 = Object.values(t.units).find((u) => u.type === 'coffee_shop');
  assert.equal(shop2.supplied.coffee_roasted, 'internal');
  assert.equal(shop2.last.duty, 0, 'Нидерланды → Германия: общий рынок ЕС');
});

test('лицензия покупается один раз на страну', () => {
  const s = createGame({ seed: 2 });
  s.companies.c1.cash = 2e6;
  const lot = firstLot(s, 'chi', 'restaurant');
  const f = forecast(s, lot.id, 'restaurant', 'c1');
  assert.ok(f.license && f.license.cost > 0);
  const before = s.companies.c1.cash;
  open(s, 'chi', 'restaurant');
  assert.equal(Math.round(before - s.companies.c1.cash), f.capex + f.license.cost);
  const lot2 = firstLot(s, 'nyc', 'restaurant');
  assert.equal(forecast(s, lot2.id, 'restaurant', 'c1').license, null, 'в той же стране лицензия уже есть');
});

test('кризис в стране снижает спрос, законы меняются в разумных пределах', async () => {
  const { districtPotential } = await import('../src/sim/index.js');
  const s = createGame({ seed: 6 });
  const d = Object.values(s.world.districts).find((x) => x.placeId === 'ber' && x.type === 'cbd');
  const base = districtPotential(s, d, 'coffee');
  s.countries.DE.demand = 0.85;
  assert.ok(Math.abs(districtPotential(s, d, 'coffee') - base * 0.85) < 1e-6);
  const t = createGame({ seed: 6 });
  stepDays(t, 3650);
  const changed = Object.entries(t.countries).filter(([, c]) => c.event || c.tax !== undefined);
  assert.ok(changed.length);
  for (const c of Object.values(t.countries)) {
    assert.ok(c.tax >= 0 && c.tax <= 0.45 && c.tariff >= 0 && c.tariff <= 0.35);
  }
  assert.ok(t.news.some((n) => n.text.startsWith('🌍')), 'за 10 лет были события в странах');
});

test('франшиза: франчайзи открываются и платят роялти, деньги сходятся', () => {
  const s = createGame({ seed: 8 });
  const co = s.companies.c1;
  co.cash = 1e6;
  const start = co.cash;
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const lot = firstLot(s, 'ber', 'coffee_shop');
    ids.push(applyCommand(s, { type: 'openBusiness', lotId: lot.id, businessType: 'coffee_shop' }, 'c1').unitId);
  }
  const b = applyCommand(s, { type: 'createBrand', name: 'Бин', businessType: 'coffee_shop', tier: 'std', unitIds: ids }, 'c1');
  assert.ok(b.ok);
  assert.ok(applyCommand(s, { type: 'openFranchise', brandId: b.brandId, country: 'FR' }, 'c1').ok);
  assert.ok(applyCommand(s, { type: 'openFranchise', brandId: b.brandId, country: 'ES' }, 'c1').ok);
  stepDays(s, 720);
  const brand = s.brands[b.brandId];
  const n = Object.values(brand.franchisees).reduce((a, x) => a + x, 0);
  assert.ok(n >= 2, `франчайзи: ${n}`);
  assert.ok(co.history.some((m) => m.royalty > 0));
  assert.ok(Object.keys(brand.awareness).some((pid) => s.world.places[pid].country === 'FR'), 'бренд узнают во Франции');
  assert.ok(Math.abs(co.cash - (start + co.totals.in - co.totals.out)) < 1e-6);
});

test('биржа: акции корпораций приносят дивиденды', () => {
  const s = createGame({ seed: 10 });
  const co = s.companies.c1;
  co.cash = 1e6;
  const l = s.stocks.listings.s1;
  const r = applyCommand(s, { type: 'tradeShares', listingId: 's1', qty: 5000 }, 'c1');
  assert.ok(r.ok, r.error);
  assert.equal(l.holders.c1, 5000);
  stepDays(s, 95);
  assert.ok(co.history.some((m) => m.dividendsIn > 0));
  assert.ok(applyCommand(s, { type: 'tradeShares', listingId: 's1', qty: -5000 }, 'c1').ok);
  assert.equal(l.holders.c1, undefined);
  assert.ok(!applyCommand(s, { type: 'tradeShares', listingId: 's1', qty: -1 }, 'c1').ok, 'нельзя продать чужое');
});

test('IPO и поглощение соперника в PvP', () => {
  const s = createGame({ seed: 12, mode: 'pvp', companyNames: ['А', 'Б'] });
  const [a, b] = [s.companies.c1, s.companies.c2];
  a.cash = 800000;
  b.cash = 2e7;
  const start = { c1: a.cash, c2: b.cash };
  open(s, 'ber', 'coffee_shop', 'c1');
  assert.ok(!applyCommand(s, { type: 'ipo', share: 0.3 }, 'c1').ok, 'без истории IPO нельзя');
  stepDays(s, 370);
  const ipo = applyCommand(s, { type: 'ipo', share: 0.49 }, 'c1');
  assert.ok(ipo.ok, ipo.error);
  const l = s.stocks.listings.c1;
  // компания А продаёт ещё часть своих акций — и теряет контроль
  assert.ok(applyCommand(s, { type: 'tradeShares', listingId: 'c1', qty: -400000 }, 'c1').ok);
  assert.ok(applyCommand(s, { type: 'tradeShares', listingId: 'c1', qty: l.float }, 'c2').ok);
  assert.ok(l.holders.c2 / l.shares >= 0.75);
  assert.ok(!applyCommand(s, { type: 'setPayout', listingId: 'c1', payout: 0 }, 'c1').ok, 'дивиденды решает контролирующий');
  assert.ok(applyCommand(s, { type: 'setPayout', listingId: 'c1', payout: 1 }, 'c2').ok);
  const unitsA = Object.values(s.units).filter((u) => u.companyId === 'c1').length;
  const r = applyCommand(s, { type: 'absorbCompany', targetId: 'c1' }, 'c2');
  assert.ok(r.ok, r.error);
  assert.ok(a.bankrupt && a.absorbedBy === 'c2');
  assert.equal(Object.values(s.units).filter((u) => u.companyId === 'c2').length, unitsA);
  assert.ok(!s.stocks.listings.c1);
  assert.ok(!applyCommand(s, { type: 'renameCompany', name: 'x' }, 'c1').ok);
  stepDays(s, 40);
  assert.equal(s.winner?.companyId, undefined, 'без условия победы игра продолжается');
  for (const co of Object.values(s.companies).filter((c) => !c.ai)) {
    assert.ok(Math.abs(co.cash - (start[co.id] + co.totals.in - co.totals.out)) < 1e-3, co.id);
  }
});

test('нефтяная цепочка: скважина → НПЗ → АЗС', () => {
  const s = createGame({ seed: 14 });
  s.companies.c1.cash = 1e7;
  const well = open(s, 'r_permian', 'oil_well');
  const ref = open(s, 'chi', 'refinery');
  const gas = open(s, 'chi', 'gas_station');
  stepDays(s, 70);
  assert.ok(well.last.produced > 0);
  assert.equal(ref.supplied.oil, 'internal');
  assert.ok(ref.last.produced > 0);
  assert.equal(gas.supplied.fuel, 'internal');
  assert.ok(gas.last.customers > 0 && gas.last.revenue > 0);
});

// ---------- баланс: без управления деньги не копятся ----------

test('износ: точка стареет, обновление возвращает её в строй', () => {
  const s = createGame({ seed: 16 });
  s.companies.c1.cash = 1e6;
  const u = open(s, 'ber', 'coffee_shop');
  stepDays(s, 730);
  assert.ok(u.condition < 80, `износ ${u.condition}`);
  const q = u.quality;
  assert.ok(applyCommand(s, { type: 'renovate', unitId: u.id }, 'c1').ok);
  assert.equal(u.condition, 100);
  stepDays(s, 90);
  assert.ok(u.quality > q, 'после обновления рейтинг растёт');
});

test('инфляция: цены и зарплаты растут, а цены точки — нет, пока их не поднять', async () => {
  const { refPrice, monthlyWage } = await import('../src/sim/index.js');
  const { BUSINESSES } = await import('../src/data/businesses.js');
  const s = createGame({ seed: 17 });
  s.companies.c1.cash = 1e6;
  const u = open(s, 'ist', 'coffee_shop');
  const p = BUSINESSES.coffee_shop.retail.products[0];
  const ref0 = refPrice(s.world.places.ist, p);
  const wage0 = monthlyWage(s, u);
  const price0 = u.prices.coffee;
  stepDays(s, 366 * 3);
  assert.ok(refPrice(s.world.places.ist, p) > ref0 * 1.08, 'норма цены выросла');
  assert.ok(monthlyWage(s, u) > wage0 * 1.08, 'зарплаты выросли');
  assert.equal(u.prices.coffee, price0, 'своя цена не меняется сама');
});

test('сеть сама пересчитывает цены по инфляции', () => {
  const s = createGame({ seed: 18 });
  s.companies.c1.cash = 1e6;
  const u = open(s, 'ist', 'coffee_shop');
  applyCommand(s, { type: 'createBrand', name: 'Сеть', businessType: 'coffee_shop', tier: 'std', unitIds: [u.id] }, 'c1');
  const p0 = u.prices.coffee;
  stepDays(s, 366 * 2);
  assert.ok(u.prices.coffee > p0 * 1.05);
});

test('пассивная игра: открыл и забыл — прибыль тает', () => {
  const s = createGame({ seed: 19 });
  const u = open(s, 'ber', 'coffee_shop');
  stepDays(s, 365);
  const early = u.history.slice(-6).reduce((a, b) => a + b, 0);
  stepDays(s, 365 * 5);
  const late = u.history.slice(-6).reduce((a, b) => a + b, 0);
  assert.ok(late < early * 0.5, `было ${Math.round(early)}, стало ${Math.round(late)}`);
});

test('расходы штаба растут быстрее числа бизнесов', async () => {
  const { overhead } = await import('../src/sim/index.js');
  const s = createGame({ seed: 20 });
  s.companies.c1.cash = 1e8;
  const lots = Object.values(s.world.lots).filter((l) => buildableTypes(s, l).includes('fastfood'));
  for (let i = 0; i < 10; i++) applyCommand(s, { type: 'openBusiness', lotId: lots[i].id, businessType: 'fastfood' }, 'c1');
  const o10 = overhead(s, 'c1');
  for (let i = 10; i < 40; i++) applyCommand(s, { type: 'openBusiness', lotId: lots[i].id, businessType: 'fastfood' }, 'c1');
  const o40 = overhead(s, 'c1');
  assert.ok(o10 > 0 && o40 / o10 > 6, `${o10} → ${o40}`);
});

// ---------- управление, соперники, исследования ----------

test('региональный директор сам поднимает цены, подгоняет штат и экономит внимание', async () => {
  const { attention, refPrice } = await import('../src/sim/index.js');
  const { BUSINESSES } = await import('../src/data/businesses.js');
  const s = createGame({ seed: 21, rivals: 0 });
  s.companies.c1.cash = 2e6;
  const units = [];
  for (let i = 0; i < 8; i++) units.push(open(s, 'ber', 'fastfood'));
  assert.ok(attention(s, 'c1').excess > 0);
  assert.ok(applyCommand(s, { type: 'hireDirector', country: 'DE' }, 'c1').ok);
  assert.equal(attention(s, 'c1').excess, 0, 'с директором внимания хватает');
  units[0].staff = 9;
  stepDays(s, 400);
  const p = BUSINESSES.fastfood.retail.products[0];
  assert.ok(Math.abs(units[1].prices.hotdog - refPrice(s.world.places.ber, p)) < 0.02, 'цены — по норме после инфляции');
  assert.ok(units[0].staff < 9, 'лишний штат сокращён');
  assert.ok(s.companies.c1.history.at(-1).directors > 0);
});

test('задачи и массовые действия', async () => {
  const { companyAlerts } = await import('../src/sim/index.js');
  const s = createGame({ seed: 22, rivals: 0 });
  s.companies.c1.cash = 3e6;
  const a = open(s, 'ber', 'coffee_shop');
  const b = open(s, 'ber', 'coffee_shop');
  stepDays(s, 365 * 5);
  const alerts = companyAlerts(s, 'c1');
  assert.ok(alerts.some((x) => x.kind === 'worn'), 'износ заметен');
  assert.ok(alerts.some((x) => x.kind === 'cheap'), 'цены отстали от инфляции');
  const r = applyCommand(s, { type: 'bulk', op: 'renovate', unitIds: [a.id, b.id] }, 'c1');
  assert.ok(r.ok && r.done === 2 && a.condition === 100 && b.condition === 100);
  assert.ok(applyCommand(s, { type: 'bulk', op: 'priceNorm', unitIds: [a.id, b.id], ratio: 1.05 }, 'c1').ok);
  assert.ok(!companyAlerts(s, 'c1').some((x) => x.kind === 'cheap'));
});

test('ИИ-корпорации открывают бизнесы, у них можно купить точку и перемирие', () => {
  const s = createGame({ seed: 23 });
  s.companies.c1.cash = 5e6;
  open(s, 'nyc', 'coffee_shop');
  stepDays(s, 400);
  const rivals = Object.values(s.companies).filter((c) => c.ai);
  assert.equal(rivals.length, 4);
  const theirs = Object.values(s.units).filter((u) => s.companies[u.companyId].ai);
  assert.ok(theirs.length > 10, `у корпораций ${theirs.length} бизнесов`);
  const u = theirs[0];
  const seller = u.companyId;
  assert.ok(applyCommand(s, { type: 'buyRivalUnit', unitId: u.id }, 'c1').ok);
  assert.equal(u.companyId, 'c1');
  const raider = rivals.find((r) => r.ai.archetype === 'raider');
  assert.ok(applyCommand(s, { type: 'buyTruce', rivalId: raider.id }, 'c1').ok);
  assert.ok(s.companies.c1.truces[raider.id] > s.day);
  assert.ok(s.companies[seller].cash > 0);
  assert.equal(s.winner, null);
});

test('исследования: бонусы и открытие тира IV, лоббирование', async () => {
  const { forecast } = await import('../src/sim/index.js');
  const s = createGame({ seed: 24, rivals: 0 });
  s.companies.c1.cash = 1e7;
  const lot = firstLot(s, 'nyc', 'bank');
  assert.ok(forecast(s, lot.id, 'bank', 'c1').locked);
  assert.ok(!applyCommand(s, { type: 'openBusiness', lotId: lot.id, businessType: 'bank' }, 'c1').ok);
  assert.ok(applyCommand(s, { type: 'startResearch', techId: 'banking' }, 'c1').ok);
  assert.ok(!applyCommand(s, { type: 'startResearch', techId: 'pos' }, 'c1').ok, 'одно исследование за раз');
  stepDays(s, 370);
  assert.equal(s.companies.c1.tech.banking, 1);
  const rate = s.companies.c1.loanRate;
  open(s, 'nyc', 'bank');
  const { loanRate } = await import('../src/sim/index.js');
  assert.ok(loanRate(s, 'c1') < rate, 'свой банк снижает ставку');
  const tax = s.countries.US.tax;
  let won = false;
  for (let i = 0; i < 6 && !won; i++) {
    const r = applyCommand(s, { type: 'lobby', country: 'US', goal: 'tax' }, 'c1');
    assert.ok(r.ok, r.error);
    won = r.success;
    s.companies.c1.lobbied.US = -1000;
  }
  if (won) assert.ok(s.countries.US.tax < tax);
});
