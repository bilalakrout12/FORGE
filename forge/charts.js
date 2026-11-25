// Graphiques SVG faits maison (aucune dépendance, fonctionne hors-ligne).
import { toDate, fmt, esc } from './store.js';

const W = 340, H = 170, PL = 34, PR = 8, PT = 10, PB = 22;

function niceTicks(min, max, count = 3) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// series: [{ pts:[{x:'YYYY-MM-DD', y}], color, line, dots, width, lastDot }]
export function lineChart(series, opts = {}) {
  const all = series.flatMap((s) => s.pts).filter((p) => p.y !== null && !isNaN(p.y));
  if (!all.length) return `<div class="chart-empty">${esc(opts.empty || 'Pas encore de données')}</div>`;
  const xs = all.map((p) => toDate(p.x).getTime() / 86400000);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  if (opts.band) { y0 = Math.min(y0, opts.band[0]); y1 = Math.max(y1, opts.band[1]); }
  const pad = Math.max((y1 - y0) * 0.15, opts.minPad ?? 0.5);
  y0 -= pad; y1 += pad;
  const X = (d) => PL + ((toDate(d).getTime() / 86400000 - x0) / (x1 - x0)) * (W - PL - PR);
  const Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);

  let g = '';
  if (opts.band) g += `<rect x="${PL}" width="${W - PL - PR}" y="${Y(opts.band[1])}" height="${Math.max(0, Y(opts.band[0]) - Y(opts.band[1]))}" class="band"/>`;
  for (const t of niceTicks(y0, y1)) {
    g += `<line x1="${PL}" x2="${W - PR}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/>`;
    g += `<text x="${PL - 8}" y="${Y(t) + 4}" text-anchor="end" class="axis">${fmt(t, opts.dec ?? 1)}</text>`;
  }
  const lab = (n) => new Date(n * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  g += `<text x="${PL}" y="${H - 4}" class="axis">${lab(x0)}</text><text x="${W - PR}" y="${H - 4}" text-anchor="end" class="axis">${lab(x1)}</text>`;

  for (const s of series) {
    const pts = s.pts.filter((p) => p.y !== null && !isNaN(p.y)).sort((a, b) => (a.x < b.x ? -1 : 1));
    if (!pts.length) continue;
    const c = s.color || 'var(--blue)';
    if (s.line !== false && pts.length > 1) {
      g += `<polyline fill="none" stroke="${c}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`;
    }
    if (s.dots) for (const p of pts) g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${s.r || 2.2}" fill="${c}"/>`;
    if (s.lastDot !== false && s.line !== false) {
      const l = pts[pts.length - 1];
      g += `<circle cx="${X(l.x).toFixed(1)}" cy="${Y(l.y).toFixed(1)}" r="4" fill="var(--bg)" stroke="${c}" stroke-width="2"/>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.label || 'graphique')}">${g}</svg>`;
}

// Barres horizontales avec une zone cible matérialisée par deux repères
export function bars(items, { max, zone } = {}) {
  const m = max || Math.max(1, ...items.map((i) => i.value), zone ? zone[1] : 0);
  return `<div class="bars">${items.map((i) => {
    const w = Math.min(100, (i.value / m) * 100);
    const z = zone ? `<span class="bar-zone" style="left:${(zone[0] / m) * 100}%;width:${((zone[1] - zone[0]) / m) * 100}%"></span>` : '';
    const low = zone && i.value < zone[0];
    return `<div class="bar-row"><span class="lbl">${esc(i.label)}</span><span class="bar-track">${z}<span class="bar-fill ${low ? 'low' : ''}" style="width:${w}%"></span></span><span class="val">${fmt(i.value, 1)}</span></div>`;
  }).join('')}</div>`;
}

// Manchon de barre chargé, disques aux couleurs de compétition (vue d'un côté)
const PLATE = {
  25: ['#C5372C', 1.0, 22], 20: ['#1D4EC4', 1.0, 20], 15: ['#E0A614', 0.88, 17], 10: ['#1C7F52', 0.76, 14],
  5: ['#F4F4F1', 0.58, 12], 2.5: ['#C5372C', 0.46, 9], 1.25: ['#B9BEC1', 0.38, 7], 0.5: ['#B9BEC1', 0.3, 5],
};
export function barbell(plates) {
  const H2 = 120, cy = H2 / 2, maxH = 104;
  let x = 30, g = '';
  g += `<rect x="0" y="${cy - 5}" width="24" height="10" rx="2" fill="var(--ink-3)"/>`;           // barre
  g += `<rect x="24" y="${cy - 16}" width="6" height="32" rx="1.5" fill="var(--ink-2)"/>`;         // butée
  for (const p of plates) {
    const [col, hk, w] = PLATE[p] || ['#999', 0.4, 8];
    const h = maxH * hk;
    g += `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2.5" fill="${col}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`;
    x += w + 2;
  }
  g += `<rect x="${x}" y="${cy - 7}" width="${Math.max(40, 300 - x)}" height="14" rx="2" fill="var(--ink-3)" opacity=".7"/>`; // manchon
  return `<svg viewBox="0 0 340 ${H2}" class="barbell" role="img" aria-label="Disques : ${plates.join(', ')} kg">${g}</svg>`;
}
