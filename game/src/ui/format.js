const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n, { cents = false } = {}) {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  return `${sign}$${cents ? nf2.format(a) : nf0.format(a)}`;
}

export function moneyShort(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2).replace('.', ',')} млрд`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2).replace('.', ',')} млн`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1).replace('.', ',')} тыс`;
  return `${sign}$${nf0.format(a)}`;
}

export function num(n, digits = 0) {
  if (!Number.isFinite(n)) return '—';
  return digits ? n.toFixed(digits).replace('.', ',') : nf0.format(n);
}

export function pct(x, digits = 0) {
  return `${(x * 100).toFixed(digits).replace('.', ',')}%`;
}

export function stars(q) {
  const n = Math.max(1, Math.min(5, Math.round(q)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function months(m) {
  if (!Number.isFinite(m)) return 'не окупится';
  if (m < 1) return '< 1 мес';
  if (m >= 24) return `${(m / 12).toFixed(1).replace('.', ',')} лет`;
  return `${Math.round(m)} мес`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function signClass(n) {
  return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
}

export function sparkline(values, w = 90, h = 24) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * (h - 2) - 1).toFixed(1)}`);
  const up = values.at(-1) >= values[0];
  return `<svg class="spark ${up ? 'up' : 'down'}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts.join(' ')}" /></svg>`;
}

export function bars(values, w = 160, h = 36) {
  if (!values || !values.length) return '';
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const bw = w / values.length;
  const mid = h / 2;
  const rects = values
    .map((v, i) => {
      const bh = (Math.abs(v) / max) * (mid - 1);
      const y = v >= 0 ? mid - bh : mid;
      return `<rect x="${(i * bw + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(0.5, bh).toFixed(1)}" class="${v >= 0 ? 'pos' : 'neg'}" />`;
    })
    .join('');
  return `<svg class="bars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${mid}" y2="${mid}" />${rects}</svg>`;
}
