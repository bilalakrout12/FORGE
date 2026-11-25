// Écran « Suivi » : progression des charges, volume par muscle, records, historique.
import { state, today, mondayOf, addDays, fmt, fmtDate, fmtDuration, esc } from '../store.js';
import { EXERCISES, MUSCLES } from '../data/exercises.js';
import { doneWorkouts, exerciseHistory, bestRecords, scoreLabel, weeklyMuscleSets, workoutStats, setsSummary } from '../calc.js';
import { templatesSorted, doneInWeek } from '../workouts.js';
import { lineChart, bars } from '../charts.js';
import { refresh, go, header, icon } from '../ui.js';

let selEx = null;
let volWeek = null;

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
  const ton = weekTonnage(mon), tonPrev = weekTonnage(addDays(mon, -7));

  const progEx = tpls.flatMap((t) => t.items.map((i) => i.ex));
  const withHist = [...new Set(all.flatMap((w) => w.items.filter((it) => it.sets.some((s) => s.ok)).map((it) => it.ex)))];
  withHist.sort((a, b) => (progEx.indexOf(a) === -1 ? 99 : progEx.indexOf(a)) - (progEx.indexOf(b) === -1 ? 99 : progEx.indexOf(b)));
  if (!selEx || !withHist.includes(selEx)) selEx = withHist.find((k) => EXERCISES[k]?.type === 'compound') || withHist[0] || null;

  let html = header({ title: 'Suivi', sub: all.length ? `${all.length} séance${all.length > 1 ? 's' : ''} validée${all.length > 1 ? 's' : ''}` : 'Rien à suivre pour l’instant' });

  html += `<div class="metrics">
    <div class="metric"><div class="metric-v">${streakWeeks()}</div><div class="metric-l">semaines complètes d’affilée</div></div>
    <div class="metric"><div class="metric-v">${fmt(ton / 1000, 1)}</div><div class="metric-l">tonnes cette semaine${tonPrev && ton ? `, ${ton >= tonPrev ? '+' : '−'}${fmt(Math.abs((ton - tonPrev) / tonPrev) * 100, 0)} %` : ''}</div></div>
    <div class="metric"><div class="metric-v">${Object.keys(bestRecords()).length}</div><div class="metric-l">exercices suivis</div></div>
  </div>`;

  if (!selEx) {
    html += `<p class="note" style="margin-top:28px">Valide ta première séance : la progression de chaque exercice apparaîtra ici.</p>`;
    root.innerHTML = html;
    return;
  }

  const h = exerciseHistory(selEx);
  const first = h[0], last = h[h.length - 1];
  const delta = last.best - first.best;
  const ex = EXERCISES[selEx];
  const unit = ex?.unit === 'cm' ? 'cm' : 'kg';
  html += `<section class="section">
    <div class="section-hd"><h2>Progression</h2></div>
    <select class="field" data-f="ex" aria-label="Exercice">${withHist.map((k) => `<option value="${k}" ${k === selEx ? 'selected' : ''}>${esc(EXERCISES[k]?.name || k)}</option>`).join('')}</select>
    <div style="margin-top:18px">
      <div class="hero-num"><span class="num">${fmt(last.best, 1)}</span><span class="unit">${unit}</span></div>
      <p class="hero-sub">${esc(scoreLabel(selEx))}${h.length > 1 ? `, <span class="${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta), 1)} ${unit}</span> depuis le ${fmtDate(first.date, { day: 'numeric', month: 'long' })}` : ''}</p>
    </div>
    ${lineChart([{ pts: h.map((x) => ({ x: x.date, y: x.best })) }], { label: scoreLabel(selEx) })}
    <div class="rows" style="margin-top:12px">${h.slice(-5).reverse().map((x) => `<div class="row"><span class="row-title">${fmtDate(x.date, { day: 'numeric', month: 'short' })}</span><span class="row-end">${esc(setsSummary(x.sets, selEx))}</span></div>`).join('')}</div>
  </section>`;

  if (volWeek === null) volWeek = Object.keys(weeklyMuscleSets(mon)).length ? 0 : -1;
  const vMon = addDays(mon, volWeek * 7);
  const vol = weeklyMuscleSets(vMon);
  html += `<section class="section">
    <div class="section-hd"><h2>Séries par muscle</h2></div>
    <div class="seg" style="margin-bottom:16px">
      <button class="${volWeek === -1 ? 'on' : ''}" data-act="vw" data-v="-1">Semaine passée</button>
      <button class="${volWeek === 0 ? 'on' : ''}" data-act="vw" data-v="0">Cette semaine</button>
    </div>
    ${bars(Object.keys(MUSCLES).filter((m) => m !== 'explo').map((m) => ({ label: MUSCLES[m], value: vol[m] || 0 })), { zone: [10, 20], max: 22 })}
    <p class="caption" style="margin-top:12px">Les repères pointillés encadrent 10 à 20 séries par semaine, la plage la plus efficace pour la prise de muscle. Un muscle secondaire compte pour une demi-série.</p>
  </section>`;

  const rec = bestRecords();
  const recList = Object.entries(rec).filter(([k]) => EXERCISES[k]).sort((a, b) => (progEx.indexOf(a[0]) === -1 ? 99 : progEx.indexOf(a[0])) - (progEx.indexOf(b[0]) === -1 ? 99 : progEx.indexOf(b[0])));
  html += `<section class="section">
    <div class="section-hd"><h2>Records</h2><span class="caption">1RM estimé, ou meilleur saut</span></div>
    <div class="rows">${recList.map(([k, r]) => `<div class="row"><span class="row-main"><span class="row-title">${esc(EXERCISES[k].name)}</span><span class="row-sub">${fmt(r.setKg, 1)} × ${r.setReps}, le ${fmtDate(r.date, { day: 'numeric', month: 'short' })}</span></span><span class="row-end"><span class="num">${fmt(r.best, 1)}</span> ${EXERCISES[k].unit === 'cm' ? 'cm' : 'kg'}</span></div>`).join('')}</div>
  </section>`;

  html += `<section class="section">
    <div class="section-hd"><h2>Historique</h2></div>
    <div class="rows">${all.slice().reverse().slice(0, 40).map((w) => {
      const s = workoutStats(w);
      return `<button class="row tap" style="width:100%;text-align:left" data-act="open" data-id="${w.id}">
        <span class="row-main"><span class="row-title">${esc(w.name)}</span><span class="row-sub">${fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'short' })}</span></span>
        <span class="row-end">${s.sets} séries<br>${fmt(s.volume / 1000, 1)} t${s.dur ? `, ${fmtDuration(s.dur)}` : ''}</span></button>`;
    }).join('')}</div>
  </section>`;

  root.innerHTML = html;
  root.addEventListener('change', (e) => { if (e.target.dataset.f === 'ex') { selEx = e.target.value; refresh(); } });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'vw') { volWeek = +t.dataset.v; refresh(); }
    if (t.dataset.act === 'open') go('#/session/' + t.dataset.id);
  });
}
