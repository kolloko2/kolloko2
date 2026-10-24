import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepDays, applyCommand, forecast, buildableTypes } from '../src/sim/index.js';

function firstLot(state, placeId, type) {
  return Object.values(state.world.lots).find((l) => l.placeId === placeId && !l.unitId && buildableTypes(state, l).includes(type));
}

function open(state, placeId, type) {
  const lot = firstLot(state, placeId, type);
  const r = applyCommand(state, { type: 'openBusiness', lotId: lot.id, businessType: type });
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
  s.company.cash = 200000;
  const unit = open(s, 'ber', 'coffee_shop');
  stepDays(s, 70);
  assert.ok(unit.last.customers > 1000, `клиентов ${unit.last.customers}`);
  assert.ok(unit.last.revenue > 0);
});

test('деньги сходятся: касса = старт + приходы − расходы', () => {
  const s = createGame({ seed: 3 });
  s.company.cash = 500000;
  const start = s.company.cash;
  open(s, 'nyc', 'coffee_shop');
  open(s, 'chi', 'mill');
  applyCommand(s, { type: 'takeLoan', amount: 20000 });
  stepDays(s, 120);
  const { in: inflow, out } = s.company.totals;
  assert.ok(Math.abs(s.company.cash - (start + inflow - out)) < 1e-6);
});

test('обжарка снабжает кофейни компании без рынка', () => {
  const s = createGame({ seed: 4 });
  s.company.cash = 1000000;
  const shop = open(s, 'ber', 'coffee_shop');
  const roastery = open(s, 'ber', 'coffee_roastery');
  stepDays(s, 40);
  assert.equal(shop.supplied.coffee_roasted, 'internal');
  assert.ok(roastery.last.revInternal > 0);
});

test('нельзя открыть плантацию кофе в Канзасе', () => {
  const s = createGame({ seed: 2 });
  const lot = Object.values(s.world.lots).find((l) => l.placeId === 'r_kansas');
  const r = applyCommand(s, { type: 'openBusiness', lotId: lot.id, businessType: 'coffee_plantation' });
  assert.equal(r.ok, false);
});

test('прогноз даёт осмысленные числа', () => {
  const s = createGame({ seed: 6 });
  const lot = firstLot(s, 'par', 'coffee_shop');
  const f = forecast(s, lot.id, 'coffee_shop');
  assert.ok(f.capex > 0 && f.revenue > 0 && Number.isFinite(f.profit));
});

test('без денег — банкротство', () => {
  const s = createGame({ seed: 8 });
  s.company.cash = 200000;
  open(s, 'lon', 'coffee_shop');
  s.company.cash = -1e6;
  stepDays(s, 60);
  assert.equal(s.company.bankrupt, true);
});
