// Petits graphiques SVG faits maison (aucune dépendance, fonctionne hors-ligne).
import { toDate, fmt, esc } from './store.js';

const W = 340, H = 190, PL = 38, PR = 10, PT = 12, PB = 24;

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// series: [{pts:[{x:'YYYY-MM-DD', y}], color, dots, line, width, dash}]
export function lineChart(series, opts = {}) {
  const all = series.flatMap((s) => s.pts).filter((p) => p.y !== null && !isNaN(p.y));
  if (all.length < 1) return `<div class="empty-chart">Pas encore assez de données</div>`;
  const xs = all.map((p) => toDate(p.x).getTime() / 86400000);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  if (opts.band) { y0 = Math.min(y0, opts.band[0]); y1 = Math.max(y1, opts.band[1]); }
  const pad = Math.max((y1 - y0) * 0.12, opts.minPad ?? 0.5);
  y0 -= pad; y1 += pad;
  if (opts.zero) y0 = Math.min(0, y0);
  const X = (d) => PL + ((toDate(d).getTime() / 86400000 - x0) / (x1 - x0)) * (W - PL - PR);
  const Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);

  let g = '';
  for (const t of niceTicks(y0, y1)) {
    g += `<line x1="${PL}" x2="${W - PR}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/>`;
    g += `<text x="${PL - 6}" y="${Y(t) + 3.5}" text-anchor="end" class="axis">${fmt(t, opts.dec ?? 1)}</text>`;
  }
  if (opts.band) {
    g += `<rect x="${PL}" width="${W - PL - PR}" y="${Y(opts.band[1])}" height="${Math.max(0, Y(opts.band[0]) - Y(opts.band[1]))}" class="band"/>`;
  }
  const d0 = new Date(x0 * 86400000), d1 = new Date(x1 * 86400000);
  const lab = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  g += `<text x="${PL}" y="${H - 6}" class="axis">${lab(d0)}</text>`;
  g += `<text x="${W - PR}" y="${H - 6}" text-anchor="end" class="axis">${lab(d1)}</text>`;

  for (const s of series) {
    const pts = s.pts.filter((p) => p.y !== null && !isNaN(p.y)).sort((a, b) => (a.x < b.x ? -1 : 1));
    if (!pts.length) continue;
    const c = s.color || 'var(--accent)';
    if (s.line !== false && pts.length > 1) {
      g += `<polyline fill="none" stroke="${c}" stroke-width="${s.width || 2.2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 4"' : ''} points="${pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`;
    }
    if (s.dots !== false) {
      for (const p of pts) g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${s.r || 3}" fill="${c}" ${s.faint ? 'opacity=".45"' : ''}/>`;
    }
  }
  const last = series[0].pts.filter((p) => !isNaN(p.y)).slice(-1)[0];
  const cap = opts.title ? `<div class="chart-title">${esc(opts.title)}</div>` : '';
  return `${cap}<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.title || 'graphique')}">${g}</svg>`;
}

// Barres horizontales : items [{label, value, sub?}], opts {max, ref:[lo, hi]}
export function hBars(items, opts = {}) {
  const max = opts.max || Math.max(1, ...items.map((i) => i.value), opts.ref ? opts.ref[1] : 0);
  return `<div class="hbars">${items
    .map((i) => {
      const w = Math.min(100, (i.value / max) * 100);
      let cls = '';
      if (opts.ref) cls = i.value < opts.ref[0] ? 'low' : i.value > opts.ref[1] ? 'high' : 'ok';
      const ref = opts.ref
        ? `<span class="hb-ref" style="left:${(opts.ref[0] / max) * 100}%;width:${((opts.ref[1] - opts.ref[0]) / max) * 100}%"></span>`
        : '';
      return `<div class="hb-row"><div class="hb-label">${esc(i.label)}</div><div class="hb-track">${ref}<span class="hb-fill ${cls}" style="width:${w}%"></span></div><div class="hb-val">${fmt(i.value, 1)}${i.sub ? ' ' + esc(i.sub) : ''}</div></div>`;
    })
    .join('')}</div>`;
}

// Anneau de progression (calories)
export function ring(value, target, label, sub) {
  const r = 52, c = 2 * Math.PI * r;
  const ratio = target ? value / target : 0;
  const shown = Math.min(ratio, 1);
  const over = ratio > 1.05;
  return `<svg viewBox="0 0 130 130" class="ring">
    <circle cx="65" cy="65" r="${r}" class="ring-bg"/>
    ${shown > 0.005 ? `<circle cx="65" cy="65" r="${r}" class="ring-fg ${over ? 'over' : ''}" stroke-dasharray="${(shown * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 65 65)"/>` : ''}
    <text x="65" y="62" text-anchor="middle" class="ring-main">${esc(label)}</text>
    <text x="65" y="82" text-anchor="middle" class="ring-sub">${esc(sub)}</text>
  </svg>`;
}

export function macroBar(label, value, target, color) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return `<div class="macro">
    <div class="macro-top"><span>${esc(label)}</span><span><b>${fmt(value, 0)}</b> / ${fmt(target, 0)} g</span></div>
    <div class="macro-track"><span style="width:${pct}%;background:${color}"></span></div>
  </div>`;
}
