// Écran « Suivi » : progression des charges, records, volume par muscle, historique.
import { state, save, today, mondayOf, addDays, fmt, fmtDate, fmtDuration, esc } from '../store.js';
import { EXERCISES, MUSCLES } from '../data/exercises.js';
import { doneWorkouts, exerciseHistory, bestRecords, scoreLabel, weeklyMuscleSets, workoutStats, setsSummary } from '../calc.js';
import { templatesSorted, doneInWeek } from '../workouts.js';
import { lineChart, hBars } from '../charts.js';
import { refresh, go, icon } from '../ui.js';

let selEx = null;
let volWeek = 0; // 0 = cette semaine, -1 = la précédente…

function streakWeeks() {
  const tpls = templatesSorted();
  let mon = mondayOf(today());
  const full = (m) => tpls.every((t) => doneInWeek(t.id, m));
  let n = full(mon) ? 1 : 0;
  mon = addDays(mon, -7);
  while (full(mon)) { n++; mon = addDays(mon, -7); }
  return n;
}

function weekTonnage(mon) {
  const end = addDays(mon, 6);
  return doneWorkouts().filter((w) => w.date >= mon && w.date <= end).reduce((s, w) => s + workoutStats(w).volume, 0);
}

export function render(root) {
  const all = doneWorkouts();
  const mon = mondayOf(today());
  const tpls = templatesSorted();
  const thisWeek = tpls.filter((t) => doneInWeek(t.id, mon)).length;
  const ton = weekTonnage(mon), tonPrev = weekTonnage(addDays(mon, -7));

  // exercices ayant un historique (ceux du programme d'abord)
  const progEx = tpls.flatMap((t) => t.items.map((i) => i.ex));
  const withHist = [...new Set(all.flatMap((w) => w.items.filter((it) => it.sets.some((s) => s.ok)).map((it) => it.ex)))];
  withHist.sort((a, b) => (progEx.includes(b) - progEx.includes(a)) || (EXERCISES[a]?.name || a).localeCompare(EXERCISES[b]?.name || b));
  if (!selEx || !withHist.includes(selEx)) selEx = withHist[0] || null;

  let exBlock = '<p class="muted">Valide ta première séance pour voir ta progression ici.</p>';
  if (selEx) {
    const h = exerciseHistory(selEx);
    const first = h[0], last = h[h.length - 1];
    const delta = last.best - first.best;
    const pct = first.best ? (delta / first.best) * 100 : 0;
    const ex = EXERCISES[selEx];
    exBlock = `
      <select class="in" data-f="ex">${withHist.map((k) => `<option value="${k}" ${k === selEx ? 'selected' : ''}>${esc(EXERCISES[k]?.name || k)}</option>`).join('')}</select>
      ${lineChart([{ pts: h.map((x) => ({ x: x.date, y: x.best })), color: 'var(--accent)' }], { title: scoreLabel(selEx) })}
      ${h.length > 1 ? `<p class="${delta >= 0 ? 'good' : 'bad'}">${delta >= 0 ? '+' : ''}${fmt(delta, 1)} ${ex?.unit === 'cm' ? 'cm' : 'kg'} (${delta >= 0 ? '+' : ''}${fmt(pct, 1)} %) depuis le ${fmtDate(first.date, { day: 'numeric', month: 'long' })}</p>` : ''}
      <div class="hist-list">${h.slice(-6).reverse().map((x) => `<div class="hist-row"><span class="muted">${fmtDate(x.date)}</span><span>${esc(setsSummary(x.sets, selEx))}</span></div>`).join('')}</div>`;
  }

  const vMon = addDays(mon, volWeek * 7);
  const vol = weeklyMuscleSets(vMon);
  const volItems = Object.keys(MUSCLES).filter((m) => m !== 'explo').map((m) => ({ label: MUSCLES[m], value: vol[m] || 0 }));

  const rec = bestRecords();
  const recList = Object.entries(rec).filter(([k]) => EXERCISES[k]).sort((a, b) => (progEx.includes(b[0]) - progEx.includes(a[0])));

  root.innerHTML = `
    <header class="page-head"><div class="ph-center"><div class="ph-title">Suivi</div></div></header>
    <div class="stats4">
      <div class="stat"><div class="stat-v">${all.length}</div><div class="stat-l">séances</div></div>
      <div class="stat"><div class="stat-v">${thisWeek}/${tpls.length}</div><div class="stat-l">cette semaine</div></div>
      <div class="stat"><div class="stat-v">${streakWeeks()}</div><div class="stat-l">sem. complètes d'affilée</div></div>
      <div class="stat"><div class="stat-v">${fmt(ton / 1000, 1)} t</div><div class="stat-l">tonnage${tonPrev ? ` (${ton >= tonPrev ? '+' : ''}${fmt(((ton - tonPrev) / tonPrev) * 100, 0)} %)` : ''}</div></div>
    </div>

    <section class="card">
      <h2>Progression par exercice</h2>
      ${exBlock}
    </section>

    <section class="card">
      <div class="row-between"><h2>Séries par muscle</h2>
        <div class="seg">
          <button class="${volWeek === -1 ? 'on' : ''}" data-act="vw" data-v="-1">Sem. passée</button>
          <button class="${volWeek === 0 ? 'on' : ''}" data-act="vw" data-v="0">Cette sem.</button>
        </div></div>
      ${hBars(volItems, { ref: [10, 20], max: 22 })}
      <p class="muted small">Zone verte : 10 à 20 séries par semaine, la plage la plus efficace selon les études. Le muscle principal compte 1, les muscles secondaires 0,5.</p>
    </section>

    <section class="card">
      <h2>Records</h2>
      ${recList.length ? recList.map(([k, r]) => `<div class="hist-row"><span>${esc(EXERCISES[k].name)}</span><span><b>${fmt(r.best, 1)}</b> <span class="muted small">(${fmt(r.setKg, 1)} × ${r.setReps})</span></span></div>`).join('') : '<p class="muted">Aucun record pour l’instant.</p>'}
      <p class="muted small">Valeur affichée : 1RM estimé (charge × (1 + (reps + RIR) / 30)), ou performance en cm pour les sauts.</p>
    </section>

    <section class="card">
      <h2>Historique</h2>
      ${all.length ? all.slice().reverse().slice(0, 40).map((w) => {
        const s = workoutStats(w);
        return `<div class="hist-row link" data-act="open" data-id="${w.id}" style="--c:${state.templates[w.tpl]?.color || 'var(--accent)'}">
          <span><span class="dot"></span><b>${esc(w.name)}</b><span class="muted small block">${fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'short' })}</span></span>
          <span class="right small">${s.sets} séries<br><span class="muted">${fmt(s.volume / 1000, 1)} t${s.dur ? ' · ' + fmtDuration(s.dur) : ''}</span></span></div>`;
      }).join('') : '<p class="muted">Pas encore de séance validée.</p>'}
    </section>`;

  root.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'ex') { selEx = e.target.value; refresh(); }
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'vw') { volWeek = +t.dataset.v; refresh(); }
    if (t.dataset.act === 'open') go('#/session/' + t.dataset.id);
  });
}
