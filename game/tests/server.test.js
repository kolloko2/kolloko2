import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer } from '../server/index.mjs';
import { buildableTypes } from '../src/sim/index.js';
import { stateFromSnapshot, applySnapshot } from '../src/net/snapshot.js';

let server;
let url;

before(async () => {
  server = await startServer(0);
  url = `ws://localhost:${server.address().port}/ws`;
});

after(async () => {
  await stopServer(server);
});

// Простой клиент: ждёт сообщения нужного типа, хранит состояние мира как настоящий клиент
function connect() {
  const ws = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  const client = { ws, state: null, me: null };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.t === 'welcome') {
      client.me = msg;
      client.state = stateFromSnapshot(msg.seed, msg.snapshot);
    } else if (msg.t === 'snap') {
      applySnapshot(client.state, msg.snapshot);
    }
    inbox.push(msg);
    for (const w of [...waiters]) if (w.pred(msg)) {
      waiters.splice(waiters.indexOf(w), 1);
      w.ok(msg);
    }
  };
  client.opened = new Promise((ok) => (ws.onopen = ok));
  client.send = (m) => ws.send(JSON.stringify(m));
  client.wait = (pred, ms = 5000) => new Promise((ok, fail) => {
    const found = inbox.find(pred);
    if (found) {
      inbox.splice(inbox.indexOf(found), 1);
      return ok(found);
    }
    const w = { pred, ok };
    waiters.push(w);
    setTimeout(() => fail(new Error('timeout')), ms);
  });
  let n = 0;
  client.cmd = async (cmd) => {
    const id = ++n;
    client.send({ t: 'cmd', id, cmd });
    return (await client.wait((m) => m.t === 'result' && m.id === id)).result;
  };
  return client;
}

function freeLot(state, placeId, type) {
  return Object.values(state.world.lots).find((l) => l.placeId === placeId && !l.unitId && buildableTypes(state, l).includes(type));
}

test('кооп: два игрока управляют одной компанией и видят изменения друг друга', async () => {
  const a = connect();
  const b = connect();
  await Promise.all([a.opened, b.opened]);
  a.send({ t: 'create', mode: 'coop', name: 'Аня', companyName: 'Кофе Вместе' });
  const wa = await a.wait((m) => m.t === 'welcome');
  b.send({ t: 'join', code: wa.code, name: 'Боря' });
  const wb = await b.wait((m) => m.t === 'welcome');
  assert.equal(wb.companyId, wa.companyId);
  assert.equal(b.state.companies[wb.companyId].name, 'Кофе Вместе');

  const lot = freeLot(a.state, 'ber', 'fastfood');
  const r = await a.cmd({ type: 'openBusiness', lotId: lot.id, businessType: 'fastfood' });
  assert.ok(r.ok, r.error);
  await b.wait((m) => m.t === 'snap' && b.state.units[r.unitId]);
  assert.equal(b.state.world.lots[lot.id].unitId, r.unitId);
  // второй игрок тоже может управлять общим бизнесом
  const r2 = await b.cmd({ type: 'setStaff', unitId: r.unitId, staff: 3 });
  assert.ok(r2.ok, r2.error);
  a.ws.close();
  b.ws.close();
});

test('PvP: у каждого своя компания, чужим бизнесом управлять нельзя, время идёт', async () => {
  const a = connect();
  const b = connect();
  await Promise.all([a.opened, b.opened]);
  a.send({ t: 'create', mode: 'pvp', name: 'Аня', companyName: 'А-Кофе' });
  const wa = await a.wait((m) => m.t === 'welcome');
  b.send({ t: 'join', code: wa.code, name: 'Боря', companyName: 'Б-Кофе' });
  const wb = await b.wait((m) => m.t === 'welcome');
  assert.notEqual(wb.companyId, wa.companyId);

  const lot = freeLot(a.state, 'ber', 'fastfood');
  const r = await a.cmd({ type: 'openBusiness', lotId: lot.id, businessType: 'fastfood' });
  assert.ok(r.ok);
  const bad = await b.cmd({ type: 'closeBusiness', unitId: r.unitId });
  assert.equal(bad.ok, false);

  a.send({ t: 'speed', speed: 3 });
  b.send({ t: 'speed', speed: 3 });
  const day0 = a.state.day;
  await a.wait((m) => m.t === 'snap' && a.state.day >= day0 + 3);
  assert.ok(a.state.units[r.unitId]);
  a.ws.close();
  b.ws.close();
});

test('переподключение по playerId возвращает в ту же компанию', async () => {
  const a = connect();
  await a.opened;
  a.send({ t: 'create', mode: 'pvp', name: 'Аня', companyName: 'А' });
  const wa = await a.wait((m) => m.t === 'welcome');
  a.ws.close();
  const a2 = connect();
  await a2.opened;
  a2.send({ t: 'join', code: wa.code, playerId: wa.playerId });
  const w2 = await a2.wait((m) => m.t === 'welcome');
  assert.equal(w2.companyId, wa.companyId);
  a2.ws.close();
});

test('неверный код комнаты — понятная ошибка', async () => {
  const c = connect();
  await c.opened;
  c.send({ t: 'join', code: 'ZZZZZ', name: 'X' });
  const e = await c.wait((m) => m.t === 'error');
  assert.match(e.message, /не найдена/);
  c.ws.close();
});
