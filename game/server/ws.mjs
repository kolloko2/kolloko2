// Минимальный WebSocket-сервер (RFC 6455) без зависимостей: текстовые сообщения, ping/pong, закрытие.
// Использование: attachWebSocket(httpServer, '/ws', (socket) => { socket.on('message', ...) })
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 256 * 1024;

class WsSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.open = true;
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  finish() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const frame = this.readFrame();
      if (!frame) return;
      this.onFrame(frame);
    }
  }

  readFrame() {
    const b = this.buffer;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (b.length < 4) return null;
      len = b.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (b.length < 10) return null;
      len = Number(b.readBigUInt64BE(2));
      offset = 10;
    }
    if (len > MAX_MESSAGE) {
      this.close(1009);
      return null;
    }
    const maskLen = masked ? 4 : 0;
    if (b.length < offset + maskLen + len) return null;
    let payload = b.subarray(offset + maskLen, offset + maskLen + len);
    if (masked) {
      const mask = b.subarray(offset, offset + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    this.buffer = b.subarray(offset + maskLen + len);
    return { fin, opcode, payload };
  }

  onFrame({ fin, opcode, payload }) {
    if (opcode === 0x8) {
      this.close();
      return;
    }
    if (opcode === 0x9) {
      this.sendFrame(0xa, payload);
      return;
    }
    if (opcode === 0xa) return;
    if (opcode === 0x1 || opcode === 0x0) {
      this.fragments.push(payload);
      if (!fin) return;
      const text = Buffer.concat(this.fragments).toString('utf8');
      this.fragments = [];
      this.emit('message', text);
    }
  }

  sendFrame(opcode, payload) {
    if (!this.open) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) {
    this.sendFrame(0x1, Buffer.from(text, 'utf8'));
  }

  close(code = 1000) {
    if (!this.open) return;
    const p = Buffer.alloc(2);
    p.writeUInt16BE(code);
    this.sendFrame(0x8, p);
    this.socket.end();
    this.finish();
  }
}

export function attachWebSocket(server, path, onConnection) {
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://localhost');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    onConnection(new WsSocket(socket));
  });
}
