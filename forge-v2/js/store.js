// État de l'application, persistance locale et petits utilitaires.
import { DEFAULT_TEMPLATES } from './data/program.js';

const KEY = 'muscu.v1';
export const APP_VERSION = '2.0.0';

const clone = (o) => JSON.parse(JSON.stringify(o));

function defaultState() {
  return {
    v: 1,
    profile: null,
    settings: {
      programStart: null,
      deloadEvery: 7,
      sound: true,
      wakeLock: true,
      barKg: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    },
    templates: clone(DEFAULT_TEMPLATES),
    workouts: [],
    deload: {},
    plan: {}, // { lundiISO: { idSéance: dateISO | null } } : séances déplacées ou retirées pour une semaine
    seenDragHint: false,
    weights: [],
    measures: [],
    foodLog: {},
    water: {},
    customFoods: [],
    recents: [],
    favorites: [],
    offCache: {},
  };
}

// Mise à niveau des données d'une version précédente
function normalize(s) {
  const d = defaultState();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.settings = { ...d.settings, ...s.settings };
  Object.keys(s.templates).forEach((id, i) => {
    const t = s.templates[id];
    if (!t.code) t.code = DEFAULT_TEMPLATES[id]?.code || String.fromCharCode(65 + i);
    delete t.color;
  });
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (e) {
    console.error('Lecture impossible, état neuf', e);
    return defaultState();
  }
}

export let state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert("Impossible d'enregistrer : stockage plein ? Exporte une sauvegarde depuis Profil.");
  }
}
let saveTimer;
export function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
export function replaceState(next) {
  state = normalize(next);
  save();
}
export function resetAll() {
  state = defaultState();
  save();
}
export function resetProgram() {
  state.templates = clone(DEFAULT_TEMPLATES);
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Dates (toujours en heure locale, format YYYY-MM-DD) ----------
const pad = (n) => String(n).padStart(2, '0');
export function iso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function today() { return iso(new Date()); }
export function addDays(s, n) {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function weekday(s) { // 1 = lundi … 7 = dimanche
  const w = toDate(s).getDay();
  return w === 0 ? 7 : w;
}
export function mondayOf(s) { return addDays(s, 1 - weekday(s)); }
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}
export function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return toDate(s).toLocaleDateString('fr-FR', opts);
}
export function fmtDay(s) { return fmtDate(s, { day: 'numeric', month: 'short' }); }

// ---------- Nombres ----------
export function num(v) {
  if (v === null || v === undefined || v === '') return NaN;
  return parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
}
export function fmt(n, d = 1) {
  if (n === null || n === undefined || isNaN(n)) return '–';
  const f = Math.pow(10, d);
  const r = Math.round(n * f) / f;
  // espace fine (présente dans la police des chiffres) au lieu de l'espace fine insécable
  return r.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/\u202f/g, '\u2009');
}
export function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${pad(m % 60)}`;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
}
