// Écran « Semaine » : calendrier des séances, nutrition et poids du jour.
import { state, save, today, mondayOf, addDays, weekday, fmtDate, fmtDay, fmt, fmtDuration, esc } from '../store.js';
import { DAY_NAMES } from '../data/program.js';
import { EXERCISES } from '../data/exercises.js';
import { weekIndex, isDeloadWeek, dayTotals, targets, workoutStats, avgWeight, lastPerformance, setsSummary } from '../calc.js';
import { inProgress, startWorkout, doneInWeek, templatesSorted } from '../workouts.js';
import { openSheet, refresh, go, icon } from '../ui.js';

let weekMon = null;

function restLabel(s) {
  if (!s) return 'enchaîner';
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) : ''}` : `${s} s`;
}

export function render(root) {
  const t0 = today();
  if (!weekMon) weekMon = mondayOf(t0);
  const mon = weekMon;
  const sun = addDays(mon, 6);
  const idx = weekIndex(mon);
  const deload = isDeloadWeek(mon);
  const tg = targets();
  const tpls = templatesSorted();
  const cur = inProgress();

  // résumé de la semaine
  const doneCount = tpls.filter((t) => doneInWeek(t.id, mon)).length;
  let kcalSum = 0, kcalDays = 0;
  for (let d = mon; d <= sun && d <= t0; d = addDays(d, 1)) {
    const k = dayTotals(d).kcal;
    if (k > 0) { kcalSum += k; kcalDays++; }
  }
  const wNow = avgWeight(sun < t0 ? sun : t0, 7);
  const wPrev = avgWeight(addDays(mon, -1), 7);

  let html = `
  <header class="page-head">
    <button class="icon-btn" data-act="prev" aria-label="Semaine précédente">${icon('back')}</button>
    <div class="ph-center">
      <div class="ph-title">Semaine ${idx > 0 ? idx : '–'}</div>
      <div class="ph-sub">${fmtDay(mon)} – ${fmtDay(sun)}</div>
    </div>
    <button class="icon-btn" data-act="next" aria-label="Semaine suivante">${icon('next')}</button>
  </header>
  ${mon !== mondayOf(t0) ? `<button class="link-btn center" data-act="today">Revenir à cette semaine</button>` : ''}
  ${cur ? `<div class="card banner accent" data-act="open" data-id="${cur.id}">
      <div><b>Séance en cours</b><div class="muted small">${esc(cur.name)} · commencée ${new Date(cur.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div>
      <span class="pill">Reprendre</span></div>` : ''}
  ${deload ? `<div class="card banner deload"><div><b>Semaine de décharge</b><div class="muted small">Moitié des séries, mêmes charges, RIR 3-4. Le corps récupère et la progression repart.</div></div>
      <button class="pill ghost" data-act="deload" data-v="0">Annuler</button></div>` : ''}
  <div class="stats3">
    <div class="stat"><div class="stat-v">${doneCount}/${tpls.length}</div><div class="stat-l">séances</div></div>
    <div class="stat"><div class="stat-v">${kcalDays ? fmt(kcalSum / kcalDays, 0) : '–'}</div><div class="stat-l">kcal / jour${tg ? ` (cible ${fmt(tg.kcal, 0)})` : ''}</div></div>
    <div class="stat"><div class="stat-v">${wNow ? fmt(wNow, 1) : '–'}</div><div class="stat-l">kg moy.${wNow && wPrev ? ` (${wNow - wPrev >= 0 ? '+' : ''}${fmt(wNow - wPrev, 1)})` : ''}</div></div>
  </div>
  <div class="days">`;

  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const wd = weekday(d);
    const isToday = d === t0;
    const doneHere = state.workouts.filter((w) => w.done && w.date === d);
    const planned = tpls.filter((t) => t.day === wd);
    const tot = dayTotals(d);
    const weigh = state.weights.find((w) => w.d === d);
    let body = '';
    for (const w of doneHere) {
      const st = workoutStats(w);
      const col = state.templates[w.tpl]?.color || 'var(--accent)';
      body += `<div class="sess done" style="--c:${col}" data-act="open" data-id="${w.id}">
        <span class="sess-check">${icon('check')}</span>
        <div class="sess-main"><b>${esc(w.name)}</b><div class="muted small">${st.sets} séries · ${fmt(st.volume / 1000, 1)} t${st.dur ? ' · ' + fmtDuration(st.dur) : ''}${w.deload ? ' · décharge' : ''}</div></div></div>`;
    }
    for (const t of planned) {
      const doneW = doneInWeek(t.id, d);
      if (doneW && doneW.date === d) continue;
      if (doneW) {
        body += `<div class="sess moved" style="--c:${t.color}"><div class="sess-main"><b>${esc(t.name)}</b><div class="muted small">faite le ${fmtDate(doneW.date, { weekday: 'long' })}</div></div></div>`;
        continue;
      }
      if (cur && cur.tpl === t.id && cur.date >= mon && cur.date <= sun) continue;
      const past = d < t0;
      body += `<div class="sess ${past ? 'missed' : isToday ? 'today' : ''}" style="--c:${t.color}" data-act="preview" data-tpl="${t.id}" data-date="${d}">
        <div class="sess-main"><b>${esc(t.name)}</b><div class="muted small">${t.items.length} exercices · ~55 min${past ? ' · non faite' : ''}</div></div>
        ${isToday ? `<span class="pill">Commencer</span>` : past ? `<span class="pill ghost">Rattraper</span>` : `<span class="muted small">prévue</span>`}</div>`;
    }
    const meta = [];
    if (tot.kcal > 0) meta.push(`${fmt(tot.kcal, 0)} kcal · ${fmt(tot.p, 0)} g prot.`);
    if (weigh) meta.push(`${fmt(weigh.kg, 1)} kg`);
    html += `<section class="day ${isToday ? 'is-today' : ''}">
      <div class="day-head">
        <div><span class="day-name">${DAY_NAMES[wd]}</span> <span class="muted">${fmtDay(d)}</span></div>
        <button class="icon-btn sm" data-act="add" data-date="${d}" aria-label="Ajouter une séance">${icon('plus')}</button>
      </div>
      ${body}
      ${meta.length ? `<div class="day-meta" data-act="nutri" data-date="${d}">${meta.join(' · ')}</div>` : ''}
    </section>`;
  }
  html += `</div>`;
  if (!deload) html += `<button class="link-btn center muted" data-act="deload" data-v="1">Passer cette semaine en décharge</button>`;
  root.innerHTML = html;

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'prev') { weekMon = addDays(weekMon, -7); refresh(); }
    else if (a === 'next') { weekMon = addDays(weekMon, 7); refresh(); }
    else if (a === 'today') { weekMon = mondayOf(today()); refresh(); }
    else if (a === 'open') go('#/session/' + t.dataset.id);
    else if (a === 'preview') preview(t.dataset.tpl, t.dataset.date);
    else if (a === 'add') addSheet(t.dataset.date);
    else if (a === 'nutri') go('#/nutrition/' + t.dataset.date);
    else if (a === 'deload') { state.deload[weekMon] = t.dataset.v === '1'; save(); refresh(); }
  });
}

function preview(tplId, date) {
  const t = state.templates[tplId];
  const isPast = date < today();
  const startDate = today();
  const rows = t.items.map((it) => {
    const ex = EXERCISES[it.ex];
    const last = lastPerformance(it.ex, null);
    return `<div class="prev-row"><span class="tag">${it.tag}</span><div>
      <b>${esc(ex?.name || it.ex)}</b>
      <div class="muted small">${it.sets} × ${it.min === it.max ? it.min : it.min + '-' + it.max}${ex?.uni ? ' /côté' : ''} · RIR ${it.rir} · repos ${restLabel(it.rest)}</div>
      ${last ? `<div class="small">Dernière fois : ${esc(setsSummary(last.sets, it.ex))}</div>` : ''}
    </div></div>`;
  }).join('');
  openSheet({
    title: t.name,
    html: `<p class="muted">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${isDeloadWeek(startDate) ? ' · semaine de décharge' : ''}</p>
      ${rows}
      <div class="sheet-actions">
        ${isPast ? `<button class="btn ghost" data-act="start" data-date="${date}">Noter à cette date</button>` : ''}
        <button class="btn primary" data-act="start" data-date="${startDate}">${isPast ? 'Faire aujourd’hui' : date === today() ? 'Commencer la séance' : 'Commencer maintenant'}</button>
      </div>`,
    onAction(act, el, e, sheet) {
      if (act === 'start') { sheet.close(); startWorkout(tplId, el.dataset.date); }
    },
  });
}

function addSheet(date) {
  const list = templatesSorted().map((t) => `<button class="list-btn" data-act="pick" data-tpl="${t.id}" style="--c:${t.color}">
      <span class="dot"></span><span><b>${esc(t.name)}</b><span class="muted small"> · ${DAY_NAMES[t.day]}</span></span></button>`).join('');
  openSheet({
    title: 'Ajouter une séance',
    html: `<p class="muted">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>${list}
      <p class="muted small">Pour changer durablement les jours d'entraînement : Profil › Programme.</p>`,
    onAction(act, el, e, sheet) {
      if (act === 'pick') { sheet.close(); startWorkout(el.dataset.tpl, date > today() ? today() : date); }
    },
  });
}
