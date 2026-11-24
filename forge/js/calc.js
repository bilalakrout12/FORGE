// Calculs : nutrition, progression, records, composition corporelle.
import { state, today, addDays, mondayOf, daysBetween, num } from './store.js';
import { EXERCISES } from './data/exercises.js';

// ============ Poids corporel ============
export function sortedWeights() {
  return [...state.weights].sort((a, b) => (a.d < b.d ? -1 : 1));
}
export function latestWeight() {
  const w = sortedWeights();
  if (w.length) return w[w.length - 1].kg;
  return state.profile?.weight || 75;
}
// Moyenne des pesées sur les `days` jours se terminant à `end`
export function avgWeight(end = today(), days = 7) {
  const start = addDays(end, -(days - 1));
  const list = state.weights.filter((w) => w.d >= start && w.d <= end);
  if (!list.length) return null;
  return list.reduce((s, w) => s + w.kg, 0) / list.length;
}
export function currentWeight() {
  return avgWeight(today(), 7) ?? latestWeight();
}
// Série lissée : moyenne glissante sur 7 jours pour chaque pesée
export function weightTrend() {
  return sortedWeights().map((w) => ({ d: w.d, kg: w.kg, avg: avgWeight(w.d, 7) }));
}
function slope(points) { // régression linéaire, points {x, y}
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num_ = 0, den = 0;
  for (const p of points) { num_ += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den ? num_ / den : null;
}
// Rythme d'évolution du poids (kg / semaine) sur les `days` derniers jours
export function weightRate(days = 21) {
  const start = addDays(today(), -days);
  const pts = state.weights.filter((w) => w.d >= start).map((w) => ({ x: daysBetween(start, w.d), y: w.kg }));
  if (pts.length < 4) return null;
  const span = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  if (span < 7) return null;
  const s = slope(pts);
  if (s === null) return null;
  const kg = currentWeight();
  return { kgWeek: s * 7, pctWeek: (s * 7 / kg) * 100 };
}

// ============ Nutrition ============
export const ACTIVITY = [
  { v: 1.2, label: 'Sédentaire', desc: 'Travail assis, peu de marche, pas de sport' },
  { v: 1.375, label: 'Légèrement actif', desc: 'Travail assis + 2-3 séances de sport' },
  { v: 1.55, label: 'Actif', desc: 'Travail debout ou marche fréquente + 3 séances' },
  { v: 1.725, label: 'Très actif', desc: 'Métier physique (port de charges, terrain) + 3 séances' },
  { v: 1.9, label: 'Extrêmement actif', desc: 'Métier très physique + sport quotidien' },
];
export const GOALS = {
  recomp: { label: 'Recomposition', desc: 'Déficit léger (300-500 kcal) : perdre du gras en gagnant du muscle', rate: [-0.5, -0.1] },
  cut: { label: 'Sèche', desc: 'Déficit plus marqué (400-750 kcal), protéines hautes', rate: [-1, -0.5] },
  maintain: { label: 'Maintien', desc: 'Calories à l’équilibre', rate: [-0.15, 0.15] },
  bulk: { label: 'Prise de masse propre', desc: 'Léger surplus (200-350 kcal)', rate: [0.1, 0.35] },
};

export function bmr(p, kg) { // Mifflin-St Jeor
  return 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
}

export function entryValues(e) {
  if (e.quick) return { kcal: e.kcal || 0, p: e.p || 0, c: e.c || 0, f: e.f || 0, fib: 0 };
  const k = (e.g || 0) / 100;
  const x = e.food;
  return { kcal: x.kcal * k, p: x.p * k, c: x.c * k, f: x.f * k, fib: (x.fib || 0) * k };
}
export function dayTotals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const e of state.foodLog[date] || []) {
    const v = entryValues(e);
    for (const k in t) t[k] += v[k];
  }
  return t;
}

// Dépense réelle estimée à partir des apports notés et de l'évolution du poids (28 derniers jours)
export function observedTDEE(formula) {
  const end = addDays(today(), -1);
  const start = addDays(end, -27);
  let sum = 0, n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const k = dayTotals(d).kcal;
    if (k >= 800) { sum += k; n++; }
  }
  const pts = state.weights.filter((w) => w.d >= start && w.d <= end).map((w) => ({ x: daysBetween(start, w.d), y: w.kg }));
  const span = pts.length ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) : 0;
  if (n < 14 || pts.length < 6 || span < 14) {
    return { ok: false, loggedDays: n, weighIns: pts.length, span };
  }
  const s = slope(pts);
  const intake = sum / n;
  let tdee = intake - s * 7700;
  const clamped = Math.min(Math.max(tdee, formula * 0.75), formula * 1.25);
  return { ok: true, tdee: clamped, raw: tdee, intake, kgWeek: s * 7, loggedDays: n, weighIns: pts.length, outlier: clamped !== tdee };
}

export function targets() {
  const p = state.profile;
  if (!p) return null;
  const kg = currentWeight();
  const b = bmr(p, kg);
  const tdeeFormula = b * p.activity;
  const obs = observedTDEE(tdeeFormula);
  const useObs = p.adaptive && obs.ok;
  // on fait confiance progressivement aux données réelles (moitié formule / moitié observé)
  const tdee = useObs ? (tdeeFormula + obs.tdee) / 2 : tdeeFormula;
  let delta = 0;
  const clamp = (x, a, b2) => Math.min(Math.max(x, a), b2);
  if (p.goal === 'recomp') delta = -clamp(Math.round(tdee * 0.15), 300, 500);
  else if (p.goal === 'cut') delta = -clamp(Math.round(tdee * 0.22), 400, 750);
  else if (p.goal === 'bulk') delta = clamp(Math.round(tdee * 0.1), 200, 350);
  const kcal = Math.round((tdee + delta + (num(p.kcalAdjust) || 0)) / 10) * 10;
  const h = p.height / 100;
  const bmi = kg / (h * h);
  const protKg = bmi > 30 ? 27 * h * h : kg; // au-delà d'IMC 30, protéines calculées sur un poids de référence
  const prot = Math.round(protKg * (p.protPerKg || 2));
  const fat = Math.round(Math.max(kg * 0.8, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return {
    kg, bmi, bmr: b, tdeeFormula, obs, useObs, tdee, delta, kcal,
    p: prot, c: carbs, f: fat, fib: Math.round((kcal / 1000) * 14),
    water: Math.round((kg * 35) / 250) * 250,
  };
}

// ============ Entraînement ============
export function e1rm(kg, reps, rir = 0) {
  const r = reps + (isNaN(rir) ? 0 : rir);
  if (!kg || !reps || r <= 0) return 0;
  return kg * (1 + r / 30); // Epley, en tenant compte des répétitions en réserve
}

export function doneWorkouts() {
  return state.workouts.filter((w) => w.done).sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
}

export function workingSets(item) {
  return (item.sets || []).filter((s) => s.ok && !isNaN(num(s.reps)) && num(s.reps) > 0);
}

// Valeur de référence d'une série pour suivre la progression
export function setScore(exId, s, bodyKg) {
  const ex = EXERCISES[exId] || {};
  const kg = num(s.kg) || 0;
  const reps = num(s.reps) || 0;
  const rir = num(s.rir);
  if (ex.unit === 'cm') return kg; // performance de saut
  if (ex.type === 'explo') return kg * reps;
  if (ex.bw) return e1rm(kg + bodyKg, reps, isNaN(rir) ? 0 : rir);
  return e1rm(kg, reps, isNaN(rir) ? 0 : rir);
}
export function scoreLabel(exId) {
  const ex = EXERCISES[exId] || {};
  if (ex.unit === 'cm') return 'Meilleure performance (cm)';
  if (ex.type === 'explo') return 'Meilleure série (kg × reps)';
  if (ex.bw) return '1RM estimé, corps + lest (kg)';
  return '1RM estimé (kg)';
}

// Historique d'un exercice : [{date, w, sets, best, top}]
export function exerciseHistory(exId, beforeWorkout = null) {
  const out = [];
  const bodyKg = latestWeight();
  for (const w of doneWorkouts()) {
    if (beforeWorkout && (w.id === beforeWorkout.id || w.date > beforeWorkout.date || (w.date === beforeWorkout.date && w.start > beforeWorkout.start))) continue;
    for (const it of w.items) {
      if (it.ex !== exId) continue;
      const sets = workingSets(it);
      if (!sets.length) continue;
      const best = Math.max(...sets.map((s) => setScore(exId, s, bodyKg)));
      const topKg = Math.max(...sets.map((s) => num(s.kg) || 0));
      out.push({ date: w.date, w, item: it, sets, best, topKg });
    }
  }
  return out;
}
export function lastPerformance(exId, current) {
  const h = exerciseHistory(exId, current);
  return h.length ? h[h.length - 1] : null;
}
export function setsSummary(sets, exId) {
  const ex = EXERCISES[exId] || {};
  if (!sets.length) return '';
  const sameKg = sets.every((s) => num(s.kg) === num(sets[0].kg));
  const u = ex.unit === 'cm' ? ' cm' : ' kg';
  if (ex.unit === 'cm') return sets.map((s) => `${fmtN(s.kg)}`).join(' / ') + u;
  if (sameKg) return `${fmtN(sets[0].kg)}${u} × ${sets.map((s) => s.reps).join(', ')}`;
  return sets.map((s) => `${fmtN(s.kg)}×${s.reps}`).join(', ');
}
function fmtN(v) {
  const n = num(v);
  return isNaN(n) ? '0' : String(Math.round(n * 100) / 100).replace('.', ',');
}
function roundStep(x, step) {
  const s = step > 0 ? step : 0.5;
  return Math.round(x / s) * s;
}

// Suggestion de charge (double progression)
export function suggestion(item, exId, current, deload) {
  const ex = EXERCISES[exId] || {};
  const last = lastPerformance(exId, current);
  if (!last) {
    if (ex.unit === 'cm') return { kg: null, text: 'Première fois : note ta performance (cm) ou laisse vide.' };
    return { kg: null, text: `Première fois : choisis une charge qui laisse environ ${item.rir === '—' ? '2' : item.rir} rep(s) en réserve.` };
  }
  const sets = last.sets;
  const top = last.topKg;
  const recap = `Dernière fois (${shortDate(last.date)}) : ${setsSummary(sets, exId)}`;
  if (ex.unit === 'cm') {
    const best = Math.max(...sets.map((s) => num(s.kg) || 0));
    return { kg: null, text: `${recap}. Objectif : dépasser ${fmtN(best)} cm.` };
  }
  if (deload) return { kg: top, text: `${recap}. Décharge : même charge, moitié des séries, RIR 3-4.` };
  if (ex.type === 'explo') return { kg: top, text: `${recap}. Vitesse maximale à chaque rep.` };
  const atTop = sets.filter((s) => (num(s.kg) || 0) === top);
  const allMax = atTop.length >= Math.min(item.sets, sets.length) && atTop.every((s) => num(s.reps) >= item.max);
  const allUnder = sets.every((s) => num(s.reps) < item.min);
  if (allMax && ex.inc > 0) {
    const next = roundStep(top + ex.inc, Math.min(ex.inc, 1.25));
    return { kg: next, up: true, text: `${recap}. Haut de fourchette atteint partout → +${String(ex.inc).replace('.', ',')} kg.` };
  }
  if (allMax && ex.bw) {
    return { kg: top + 2.5, up: true, text: `${recap}. Haut de fourchette atteint → ajoute 2,5 kg de lest.` };
  }
  if (allUnder && top > 0) {
    const lower = roundStep(top * 0.95, ex.inc || 1);
    return { kg: lower, text: `${recap}. Sous la fourchette (${item.min}-${item.max}) : baisse à ${fmtN(lower)} kg et reconstruis.` };
  }
  return { kg: top, text: `${recap}. Même charge, vise +1 rep sur au moins une série.` };
}
function shortDate(s) {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

// Records établis pendant une séance (comparés à tout l'historique antérieur)
export function sessionPRs(w) {
  const out = [];
  const bodyKg = latestWeight();
  for (const it of w.items) {
    const sets = workingSets(it);
    if (!sets.length) continue;
    const best = Math.max(...sets.map((s) => setScore(it.ex, s, bodyKg)));
    const hist = exerciseHistory(it.ex, w);
    if (!hist.length) continue; // première fois : pas un record
    const prev = Math.max(...hist.map((h) => h.best));
    if (best > prev + 0.01) out.push({ ex: it.ex, best, prev });
  }
  return out;
}

export function workoutStats(w) {
  let volume = 0, sets = 0, reps = 0;
  for (const it of w.items) {
    const ex = EXERCISES[it.ex] || {};
    for (const s of workingSets(it)) {
      sets++;
      reps += num(s.reps) || 0;
      if (ex.unit === 'kg' && ex.type !== 'explo') volume += (num(s.kg) || 0) * (num(s.reps) || 0) * (ex.uni ? 2 : 1);
    }
  }
  const dur = w.end && w.start ? w.end - w.start : null;
  return { volume, sets, reps, dur };
}

export function bestRecords() {
  const rec = {};
  const bodyKg = latestWeight();
  for (const w of doneWorkouts()) {
    for (const it of w.items) {
      for (const s of workingSets(it)) {
        const sc = setScore(it.ex, s, bodyKg);
        const r = rec[it.ex] || { best: 0, kg: 0, reps: 0, date: null, setKg: 0, setReps: 0 };
        if (sc > r.best) { r.best = sc; r.date = w.date; r.setKg = num(s.kg) || 0; r.setReps = num(s.reps) || 0; }
        const kg = num(s.kg) || 0;
        if (kg > r.kg || (kg === r.kg && num(s.reps) > r.reps)) { r.kg = kg; r.reps = num(s.reps) || 0; }
        rec[it.ex] = r;
      }
    }
  }
  return rec;
}

// ---------- Semaines, décharge ----------
export function weekIndex(dateISO) {
  const start = state.settings.programStart;
  if (!start) return 1;
  return Math.floor(daysBetween(mondayOf(start), mondayOf(dateISO)) / 7) + 1;
}
export function isDeloadWeek(dateISO) {
  const mon = mondayOf(dateISO);
  if (state.deload[mon] !== undefined) return state.deload[mon];
  const every = state.settings.deloadEvery;
  const idx = weekIndex(mon);
  return every > 0 && idx > 0 && idx % every === 0;
}

export function weeklyMuscleSets(mondayISO) {
  const end = addDays(mondayISO, 6);
  const out = {};
  for (const w of doneWorkouts()) {
    if (w.date < mondayISO || w.date > end) continue;
    for (const it of w.items) {
      const ex = EXERCISES[it.ex];
      if (!ex) continue;
      const n = workingSets(it).length;
      if (!n) continue;
      ex.m.forEach((m, i) => {
        if (ex.m[0] === 'explo' && i > 0) return;
        out[m] = (out[m] || 0) + n * (i === 0 ? 1 : 0.5);
      });
    }
  }
  return out;
}

// ============ Composition corporelle ============
export const MEASURES = [
  { k: 'bras', label: 'Tour de bras (contracté)' },
  { k: 'avbras', label: 'Avant-bras' },
  { k: 'epaules', label: 'Épaules' },
  { k: 'poitrine', label: 'Poitrine' },
  { k: 'taille', label: 'Taille (au nombril)' },
  { k: 'hanches', label: 'Hanches' },
  { k: 'cuisse', label: 'Cuisse' },
  { k: 'mollet', label: 'Mollet' },
  { k: 'cou', label: 'Cou' },
  { k: 'bf', label: 'Masse grasse (balance)', unit: '%' },
];

// Formule de l'US Navy (cm)
export function navyBodyFat(sex, height, waist, neck, hip) {
  if (!height || !waist || !neck) return null;
  let bf;
  if (sex === 'f') {
    if (!hip || waist + hip - neck <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(height)) - 450;
  } else {
    if (waist - neck <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
  }
  return bf > 2 && bf < 60 ? bf : null;
}

export function latestMeasures() {
  const list = [...state.measures].sort((a, b) => (a.d < b.d ? -1 : 1));
  const last = {};
  for (const m of list) for (const k in m) if (k !== 'd' && k !== 'id' && m[k] !== '' && m[k] != null) last[k] = { v: m[k], d: m.d };
  return last;
}

export function bodyComposition() {
  const p = state.profile;
  if (!p) return null;
  const m = latestMeasures();
  const kg = currentWeight();
  let bf = navyBodyFat(p.sex, p.height, num(m.taille?.v), num(m.cou?.v), num(m.hanches?.v));
  let src = 'Formule US Navy (taille, cou' + (p.sex === 'f' ? ', hanches' : '') + ')';
  if (bf === null && m.bf) { bf = num(m.bf.v); src = 'Balance'; }
  if (bf === null || isNaN(bf)) return null;
  const fatKg = (kg * bf) / 100;
  const lean = kg - fatKg;
  const h = p.height / 100;
  const ffmi = lean / (h * h) + 6.1 * (1.8 - h);
  return { bf, fatKg, lean, ffmi, src };
}
