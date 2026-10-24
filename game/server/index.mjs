// Сервер игры: раздаёт файлы клиента и ведёт комнаты мультиплеера (WebSocket /ws).
//   node server/index.mjs [порт]
// Сохранения комнат — в server-data/rooms/ (можно продолжить игру по коду комнаты после перезапуска).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachWebSocket } from './ws.mjs';
import { Room } from './rooms.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataDir = join(root, 'server-data', 'rooms');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
// Наружу отдаём только клиентские файлы
const PUBLIC = /^\/(index\.html|styles\.css|src\/|assets\/|vendor\/|$)/;

const rooms = new Map();

async function getRoom(code) {
  code = String(code || '').toUpperCase();
  if (rooms.has(code)) return rooms.get(code);
  const room = await Room.load(code, dataDir);
  if (room) rooms.set(code, room);
  return room;
}

function handleSocket(socket) {
  let room = null;
  let player = null;
  let rate = 0;
  const rateTimer = setInterval(() => (rate = 0), 1000);
  const send = (msg) => socket.send(JSON.stringify(msg));

  socket.on('message', async (text) => {
    if (++rate > 40) return; // защита от спама
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    try {
      if (msg.t === 'create' && !room) {
        const mode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        room = Room.create({ mode, seed: Math.floor(Math.random() * 2 ** 31), dataDir });
        rooms.set(room.code, room);
        player = room.join(socket, msg);
      } else if (msg.t === 'join' && !room) {
        const r = await getRoom(msg.code);
        if (!r) return send({ t: 'error', message: 'Комната не найдена. Проверьте код.' });
        room = r;
        player = room.join(socket, msg);
      } else if (!room || !player) {
        send({ t: 'error', message: 'Сначала создайте комнату или войдите в неё' });
      } else if (msg.t === 'cmd') {
        room.command(player, msg.id, msg.cmd);
      } else if (msg.t === 'speed') {
        room.setSpeed(player, msg.speed);
      } else if (msg.t === 'chat') {
        room.chat(player, msg.text);
      }
    } catch (e) {
      room = room && player ? room : null;
      send({ t: 'error', message: e.message });
    }
  });

  socket.on('close', () => {
    clearInterval(rateTimer);
    if (room && player && player.socket === socket) room.leave(player);
  });
}

export function startServer(port = 8080) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (!PUBLIC.test(pathname)) {
      res.writeHead(404).end('Not found');
      return;
    }
    let path = normalize(join(root, pathname));
    if (!path.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  attachWebSocket(server, '/ws', handleSocket);
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

export async function stopServer(server) {
  for (const room of rooms.values()) {
    await room.save();
    room.dispose();
  }
  rooms.clear();
  server.closeAllConnections?.();
  await new Promise((ok) => server.close(ok));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.PORT || 8080);
  const server = await startServer(port);
  console.log(`МАГНАТ: http://localhost:${port}  (мультиплеер: поделитесь адресом и кодом комнаты)`);
  const shutdown = async () => {
    await stopServer(server);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
