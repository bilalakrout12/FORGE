// Écran « Semaine » : planning des séances, glisser-déposer, nutrition et poids du jour.
import { state, save, today, mondayOf, addDays, weekday, fmtDate, fmt, fmtDuration, esc } from '../store.js';
import { DAY_NAMES } from '../data/program.js';
import { EXERCISES } from '../data/exercises.js';
import { weekIndex, isDeloadWeek, dayTotals, targets, workoutStats, avgWeight, lastPerformance, setsSummary } from '../calc.js';
import { inProgress, startWorkout, doneInWeek, templatesSorted, plannedDate, setPlanned, snapshotPlan, restorePlan, pendingInWeek, plannedCount } from '../workouts.js';
import { enableDrag, clickSuppressed } from '../drag.js';
import { openSheet, refresh, go, icon, toast, header } from '../ui.js';

let weekMon = null;
const DOW = ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

function restLabel(s) {
  if (!s) return 'enchaîner';
  return s >= 60 ? `${Math.floor(s / 60)}\u00a0min${s % 60 ? '\u00a0' + (s % 60) : ''}` : `${s}\u00a0s`;
}
function range(mon) {
  const sun = addDays(mon, 6);
  const a = fmtDate(mon, { day: 'numeric', month: mon.slice(5, 7) === sun.slice(5, 7) ? undefined : 'long' });
  return `Du ${a} au ${fmtDate(sun, { day: 'numeric', month: 'long' })}`;
}

export function render(root) {
  const t0 = today();
  if (!weekMon) weekMon = mondayOf(t0);
  const mon = weekMon, sun = addDays(mon, 6);
  const idx = weekIndex(mon);
  const deload = isDeloadWeek(mon);
  const tg = targets();
  const cur = inProgress();
  const tpls = templatesSorted();

  // chiffres de la semaine
  const done = tpls.filter((t) => doneInWeek(t.id, mon)).length;
  const planned = plannedCount(mon);
  let kSum = 0, kDays = 0;
  for (let d = mon; d <= sun && d <= t0; d = addDays(d, 1)) {
    const k = dayTotals(d).kcal;
    if (k > 0) { kSum += k; kDays++; }
  }
  const wNow = avgWeight(sun < t0 ? sun : t0, 7);
  const wPrev = avgWeight(addDays(mon, -1), 7);
  const dW = wNow && wPrev ? wNow - wPrev : null;

  const pending = pendingInWeek(mon);
  const isThisWeek = mon === mondayOf(t0);

  let html = header({
    title: idx > 0 ? `Semaine ${idx}` : 'Semaine',
    sub: range(mon),
    actions: `<button class="icon-btn" data-act="prev" aria-label="Semaine précédente">${icon('prev')}</button><button class="icon-btn" data-act="next" aria-label="Semaine suivante">${icon('next')}</button>`,
  });

  if (!isThisWeek) html += `<div class="link-row" style="margin:-8px 0 14px"><button class="link" data-act="today">Revenir à cette semaine</button></div>`;
  html += `<div class="metrics">
    <div class="metric"><div class="metric-v">${done}<small>/${planned}</small></div><div class="metric-l">séances faites</div></div>
    <div class="metric"><div class="metric-v">${kDays ? fmt(kSum / kDays, 0) : '–'}</div><div class="metric-l">kcal par jour${tg ? `, cible ${fmt(tg.kcal, 0)}` : ''}</div></div>
    <div class="metric"><div class="metric-v">${wNow ? fmt(wNow, 1) : '–'}</div><div class="metric-l">kg en moyenne${dW !== null ? (Math.abs(dW) < 0.05 ? ', stable' : `, ${dW > 0 ? '+' : '−'}${fmt(Math.abs(dW), 1)}`) : ''}</div></div>
  </div>`;

  if (deload) {
    html += `<div class="notice"><p><b>Semaine de décharge.</b> Moitié des séries, mêmes charges, 3 à 4 reps en réserve.</p><button class="link" data-act="deload" data-v="0">Annuler</button></div>`;
  }

  html += `<ol class="week">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const wd = weekday(d);
    const cls = d === t0 ? 'today' : d < t0 ? 'past' : '';
    let body = '';

    // séances validées ce jour-là
    for (const w of state.workouts.filter((x) => x.done && x.date === d)) {
      const st = workoutStats(w);
      const code = state.templates[w.tpl]?.code || '·';
      body += `<button class="block is-done" data-act="open" data-id="${w.id}">
        <span class="code">${esc(code)}</span>
        <span class="block-main"><span class="block-title">${esc(w.name)}</span><span class="block-meta">${st.sets} séries, ${fmt(st.volume / 1000, 1)} t${st.dur ? `, ${fmtDuration(st.dur)}` : ''}</span></span>
        <span class="block-end">${icon('check')}Faite</span></button>`;
    }
    // séance en cours
    if (cur && cur.date === d) {
      const code = state.templates[cur.tpl]?.code || '·';
      body += `<button class="block is-live" data-act="open" data-id="${cur.id}">
        <span class="code">${esc(code)}</span>
        <span class="block-main"><span class="block-title">${esc(cur.name)}</span><span class="block-meta">Commencée à ${new Date(cur.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></span>
        <span class="block-end">En cours</span></button>`;
    }
    // séances prévues (déplaçables)
    for (const p of pending.filter((x) => x.date === d)) {
      const t = p.tpl;
      const missed = d < t0;
      body += `<div class="block ${missed ? 'is-missed' : ''}" role="button" tabindex="0" data-drag data-act="preview" data-tpl="${t.id}" data-date="${d}" aria-label="${esc(t.name)}, maintenir pour déplacer">
        <span class="code">${esc(t.code)}</span>
        <span class="block-main"><span class="block-title">${esc(t.name)}</span><span class="block-meta">${t.items.length} exercices, 55 min</span></span>
        <span class="block-end">${missed ? 'Non faite' : ''}${icon('grip').replace('class="ic"', 'class="ic grip"')}</span></div>`;
    }

    const tot = dayTotals(d);
    const weigh = state.weights.find((w) => w.d === d);
    const foot = [];
    if (tot.kcal > 0) foot.push(`${fmt(tot.kcal, 0)} kcal, ${fmt(tot.p, 0)} g de protéines`);
    if (weigh) foot.push(`${fmt(weigh.kg, 1)} kg`);

    if (!body) body = `<div class="day-empty"><span>Repos</span><button class="icon-btn sm faint" data-act="add" data-date="${d}" aria-label="Ajouter une séance le ${DAY_NAMES[wd]}">${icon('plus')}</button></div>`;
    html += `<li class="day ${cls}" data-drop="${d}">
      <div class="day-date"><span class="dow">${d === t0 ? 'auj.' : DOW[wd]}</span><span class="dom">${+d.slice(8)}</span></div>
      <div class="day-body">${body}${foot.length ? `<div class="day-foot">${foot.join(', ')}</div>` : ''}</div>
    </li>`;
  }
  html += `</ol>`;
  if (pending.length) html += `<p class="hint">Maintiens une séance pour la déplacer sur un autre jour, ou la faire glisser vers la poubelle.</p>`;
  if (!deload) html += `<div class="link-row" style="margin-top:18px"><button class="link" data-act="deload" data-v="1">Passer en semaine de décharge</button></div>`;
  root.innerHTML = html;

  root.addEventListener('click', (e) => {
    if (clickSuppressed()) return;
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'prev') { weekMon = addDays(weekMon, -7); refresh(); }
    else if (a === 'next') { weekMon = addDays(weekMon, 7); refresh(); }
    else if (a === 'today') { weekMon = mondayOf(today()); refresh(); }
    else if (a === 'open') go('#/session/' + t.dataset.id);
    else if (a === 'preview') preview(t.dataset.tpl, t.dataset.date, mon);
    else if (a === 'add') addSheet(t.dataset.date, mon);
    else if (a === 'deload') { state.deload[weekMon] = t.dataset.v === '1'; save(); refresh(); }
  });
  root.addEventListener('keydown', (e) => {
    const t = e.target.closest('[data-act="preview"]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); preview(t.dataset.tpl, t.dataset.date, mon); }
  });

  enableDrag(root, {
    onDrop({ tpl, from, to }) {
      if (to === from) return;
      const snap = snapshotPlan(mon);
      const name = state.templates[tpl].name;
      if (to === 'trash') {
        setPlanned(tpl, mon, null);
        refresh();
        toast(`${name} retirée de la semaine`, { action: 'Annuler', onAction: () => { restorePlan(mon, snap); refresh(); } });
      } else {
        setPlanned(tpl, mon, to);
        refresh();
        toast(`${name} déplacée au ${DAY_NAMES[weekday(to)].toLowerCase()}`, { action: 'Annuler', onAction: () => { restorePlan(mon, snap); refresh(); } });
      }
    },
  });
}

function preview(tplId, date, mon) {
  const t = state.templates[tplId];
  const t0 = today();
  const isPast = date < t0;
  const rows = t.items.map((it) => {
    const ex = EXERCISES[it.ex];
    const last = lastPerformance(it.ex, null);
    return `<div class="row"><div class="row-main">
        <div class="row-title">${esc(ex?.name || it.ex)}</div>
        <div class="row-sub">${it.sets} × ${it.min === it.max ? it.min : `${it.min} à ${it.max}`}${ex?.uni ? ' par côté' : ''}, ${it.rest ? `repos ${restLabel(it.rest)}` : 'enchaîné avec le suivant'}</div>
        ${last ? `<div class="caption">Dernière fois : ${esc(setsSummary(last.sets, it.ex))}</div>` : ''}
      </div></div>`;
  }).join('');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    days.push(`<button class="chip ${d === date ? 'on' : ''}" data-act="move" data-date="${d}">${DOW[weekday(d)].replace('.', '')} ${+d.slice(8)}</button>`);
  }
  openSheet({
    title: t.name,
    html: `<p class="muted">${isPast ? 'Prévue le' : 'Prévue'} ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${isDeloadWeek(date) ? ', semaine de décharge' : ''}.</p>
      <div class="rows" style="margin-top:14px">${rows}</div>
      <div class="actions"><button class="btn primary" data-act="start" data-date="${t0}">Commencer maintenant</button></div>
      ${isPast ? `<div class="actions" style="margin-top:10px"><button class="btn" data-act="start" data-date="${date}">Noter à la date prévue</button></div>` : ''}
      <p class="label">Déplacer cette semaine</p>
      <div class="chips">${days.join('')}</div>
      <div class="link-row" style="margin-top:18px"><button class="link danger" data-act="skip">Retirer de la semaine</button></div>`,
    onAction(act, el, e, sheet) {
      if (act === 'start') { sheet.close(); startWorkout(tplId, el.dataset.date); }
      else if (act === 'move' || act === 'skip') {
        const snap = snapshotPlan(mon);
        const to = act === 'skip' ? null : el.dataset.date;
        setPlanned(tplId, mon, to);
        sheet.close(); refresh();
        toast(to ? `${t.name} déplacée au ${DAY_NAMES[weekday(to)].toLowerCase()}` : `${t.name} retirée de la semaine`, { action: 'Annuler', onAction: () => { restorePlan(mon, snap); refresh(); } });
      }
    },
  });
}

function addSheet(date, mon) {
  const t0 = today();
  const removed = templatesSorted().filter((t) => !plannedDate(t.id, mon) && !doneInWeek(t.id, mon));
  const list = templatesSorted().map((t) => `<button class="row tap" style="width:100%;text-align:left" data-act="pick" data-tpl="${t.id}">
      <span class="row-main"><span class="row-title"><b class="num" style="font-size:20px;margin-right:10px">${esc(t.code)}</b>${esc(t.name)}</span></span>
      <span class="row-end">${removed.includes(t) ? 'retirée' : DAY_NAMES[t.day].toLowerCase()}</span></button>`).join('');
  openSheet({
    title: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }),
    html: `<p class="muted">${date >= t0 ? 'Prévoir une séance ce jour-là, ou la commencer tout de suite.' : 'Noter une séance faite ce jour-là.'}</p>
      <div class="rows" style="margin-top:12px">${list}</div>
      <p class="caption" style="margin-top:14px">Pour changer les jours habituels : Profil, Programme.</p>`,
    onAction(act, el, e, sheet) {
      if (act !== 'pick') return;
      const id = el.dataset.tpl;
      sheet.close();
      if (date < t0) { startWorkout(id, date); return; }
      if (date === t0) { startWorkout(id, t0); return; }
      const snap = snapshotPlan(mon);
      setPlanned(id, mon, date);
      refresh();
      toast(`${state.templates[id].name} prévue le ${DAY_NAMES[weekday(date)].toLowerCase()}`, { action: 'Annuler', onAction: () => { restorePlan(mon, snap); refresh(); } });
    },
  });
}
