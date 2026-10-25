// Звуки без файлов: короткие синтезированные сигналы через WebAudio. Включаются кнопкой 🔊 в шапке.
const KEY = 'magnat-sound';
let ctx = null;
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();

export const soundOn = () => enabled;

export function toggleSound() {
  enabled = !enabled;
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // не страшно
  }
  if (enabled) play('click');
  return enabled;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', gain = 0.12, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  click: () => tone(1400, 0, 0.04, { type: 'triangle', gain: 0.04 }),
  coin: () => {
    tone(988, 0, 0.08, { type: 'square', gain: 0.05 });
    tone(1319, 0.07, 0.18, { type: 'square', gain: 0.05 });
  },
  good: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.22, { type: 'triangle', gain: 0.08 })),
  bad: () => {
    tone(330, 0, 0.25, { type: 'sawtooth', gain: 0.05, slide: 0.7 });
    tone(220, 0.18, 0.3, { type: 'sawtooth', gain: 0.04, slide: 0.7 });
  },
  month: () => {
    tone(1568, 0, 0.06, { type: 'square', gain: 0.04 });
    tone(2093, 0.06, 0.3, { type: 'sine', gain: 0.08 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'triangle', gain: 0.1 })),
};

let last = 0;
export function play(kind) {
  if (!enabled || !SOUNDS[kind]) return;
  const now = performance.now();
  if (kind !== 'click' && now - last < 250) return; // не устраиваем какофонию
  last = now;
  try {
    SOUNDS[kind]();
  } catch {
    // звук не обязателен
  }
}
