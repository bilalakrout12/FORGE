// Écran « Séance » : saisie des séries, minuteur, changement d'exercice, validation.
import { state, save, saveSoon, uid, num, fmt, fmtDuration, esc } from '../store.js';
import { EXERCISES, MUSCLES } from '../data/exercises.js';
import { suggestion, lastPerformance, exerciseHistory, setScore, workingSets, workoutStats, sessionPRs, bestRecords, scoreLabel, latestWeight, setsSummary } from '../calc.js';
import { openSheet, refresh, go, toast, icon } from '../ui.js';
import { startRest, stopRest, unlockAudio, keepAwake } from '../timer.js';

let tick = null;
export function leave() {
  clearInterval(tick);
  tick = null;
  keepAwake(false);
}

const restLabel = (s) => (!s ? 'enchaîner' : s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) + ' s' : ''}` : `${s} s`);
const inVal = (v) => (v === null || v === undefined || isNaN(v) ? '' : String(Math.round(v * 100) / 100).replace('.', ','));

function cardHTML(w, it, i) {
  const ex = EXERCISES[it.ex] || { name: it.ex, m: [], unit: 'kg', type: 'iso' };
  const T = it.target;
  const sug = w.done ? null : suggestion(T, it.ex, w, w.deload);
  const last = lastPerformance(it.ex, w);
  const lastSets = last ? last.sets : [];
  const unitLabel = ex.unit === 'cm' ? 'cm' : ex.bw ? 'lest kg' : 'kg';
  const showRir = T.rir !== '—';
  const bodyKg = latestWeight();
  // record en direct ?
  const hist = exerciseHistory(it.ex, w);
  const prevBest = hist.length ? Math.max(...hist.map((h) => h.best)) : null;
  const curSets = workingSets(it);
  const curBest = curSets.length ? Math.max(...curSets.map((s) => setScore(it.ex, s, bodyKg))) : 0;
  const isPR = prevBest !== null && curBest > prevBest + 0.01;
  const okCount = it.sets.filter((s) => s.ok).length;

  const rows = it.sets.map((s, j) => {
    const ps = lastSets[j] || lastSets[lastSets.length - 1];
    const prevHere = j > 0 ? it.sets[j - 1].kg : ''; // charge de la série précédente de cette séance
    const phKg = prevHere !== '' ? prevHere : sug && sug.kg != null ? inVal(sug.kg) : ps ? inVal(num(ps.kg)) : ex.bw ? '0' : '';
    const phReps = ps ? String(ps.reps) : String(T.max);
    const phRir = showRir ? String(T.rir).split('-')[0] : '';
    return `<div class="set-row ${s.ok ? 'ok' : ''} ${showRir ? '' : 'norir'}" data-i="${i}" data-j="${j}">
      <span class="set-n">${j + 1}</span>
      <input class="in" data-f="kg" data-i="${i}" data-j="${j}" inputmode="decimal" enterkeyhint="next" value="${esc(s.kg)}" placeholder="${esc(phKg)}" aria-label="${unitLabel}">
      <input class="in" data-f="reps" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="next" value="${esc(s.reps)}" placeholder="${esc(phReps)}" aria-label="répétitions">
      ${showRir ? `<input class="in" data-f="rir" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="done" value="${esc(s.rir)}" placeholder="${esc(phRir)}" aria-label="RIR">` : ''}
      <button class="chk" data-act="check" data-i="${i}" data-j="${j}" aria-label="Valider la série">${icon('check')}</button>
    </div>`;
  }).join('');

  const mus = ex.m.map((m) => MUSCLES[m]).filter(Boolean).join(', ');
  const done = okCount === it.sets.length && it.sets.length > 0;
  return `<article class="card ex ${done ? 'ex-done' : ''}" id="ex-${i}">
    <div class="ex-head">
      <span class="tag ${T.ss ? 'ss' : ''}">${esc(it.tag || '+')}</span>
      <div class="ex-title"><b>${esc(ex.name)}</b>${isPR ? ' <span class="pr">Record</span>' : ''}
        <div class="muted small">${mus}</div></div>
      <button class="icon-btn sm" data-act="swap" data-i="${i}" aria-label="Changer d'exercice">${icon('swap')}</button>
      <button class="icon-btn sm" data-act="info" data-i="${i}" aria-label="Conseils">${icon('info')}</button>
    </div>
    <div class="ex-target" data-act="targets" data-i="${i}">
      <span>${T.sets} × ${T.min === T.max ? T.min : T.min + '-' + T.max}${ex.uni ? ' /côté' : ''}</span>
      ${showRir ? `<span>RIR ${esc(T.rir)}</span>` : '<span>explosif</span>'}
      <span>repos ${restLabel(T.rest)}</span>${T.ss ? '<span>superset</span>' : ''}
      <span class="muted">${icon('edit')}</span>
    </div>
    ${sug ? `<div class="sugg ${sug.up ? 'up' : ''}">${sug.up ? '⬆ ' : ''}${esc(sug.text)}</div>` : ''}
    <div class="set-head ${showRir ? '' : 'norir'}"><span>#</span><span>${unitLabel}</span><span>reps</span>${showRir ? '<span>RIR</span>' : ''}<span></span></div>
    ${rows}
    <div class="ex-foot">
      <button class="mini" data-act="addset" data-i="${i}">${icon('plus')} Série</button>
      <button class="mini" data-act="delset" data-i="${i}">${icon('minus')} Série</button>
      <span class="muted small">${okCount}/${it.sets.length}</span>
    </div>
  </article>`;
}

export function render(root, id) {
  clearInterval(tick);
  const w = state.workouts.find((x) => x.id === id);
  if (!w) { go('#/week'); return; }
  if (!w.done) keepAwake(true);
  const total = w.items.reduce((s, it) => s + it.sets.length, 0);
  const okAll = w.items.reduce((s, it) => s + it.sets.filter((x) => x.ok).length, 0);
  const st = workoutStats(w);

  root.innerHTML = `
    <header class="page-head sticky">
      <button class="icon-btn" data-act="back" aria-label="Retour">${icon('back')}</button>
      <div class="ph-center">
        <div class="ph-title">${esc(w.name)}${w.deload ? ' · décharge' : ''}</div>
        <div class="ph-sub"><input type="date" class="date-in" data-f="date" value="${w.date}"> · <span id="elapsed">${w.done && st.dur ? fmtDuration(st.dur) : ''}</span></div>
      </div>
      <button class="icon-btn" data-act="menu" aria-label="Options">⋯</button>
    </header>
    ${w.done ? `<div class="card banner ok"><div><b>Séance validée</b><div class="muted small">Tu peux corriger les valeurs : tout est enregistré automatiquement.${w.feel ? ` Ressenti ${w.feel}/10.` : ''}</div></div></div>` : ''}
    <div class="progress-line"><span style="width:${total ? (okAll / total) * 100 : 0}%"></span></div>
    ${w.items.map((it, i) => cardHTML(w, it, i)).join('')}
    ${w.notes ? `<div class="card"><b>Notes</b><p>${esc(w.notes)}</p></div>` : ''}
    <div class="bottom-actions">
      ${w.done
        ? `<button class="btn ghost wide" data-act="back">Fermer</button>`
        : `<button class="btn primary wide" data-act="finish">${icon('check')} Valider la séance (${okAll}/${total})</button>`}
    </div>`;

  if (!w.done) {
    const el = root.querySelector('#elapsed');
    const upd = () => { el.textContent = fmtDuration(Date.now() - w.start); };
    upd();
    tick = setInterval(upd, 15000);
  }

  root.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'date') {
      if (e.target.value) { w.date = e.target.value; save(); }
      return;
    }
    const s = w.items[+e.target.dataset.i].sets[+e.target.dataset.j];
    s[f] = e.target.value.trim();
    saveSoon();
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    const i = +t.dataset.i;
    const it = w.items[i];
    if (a === 'back') { stopRestIfDone(w); go('#/week'); }
    else if (a === 'check') check(root, w, i, +t.dataset.j);
    else if (a === 'addset') {
      const lastSet = it.sets[it.sets.length - 1];
      it.sets.push({ kg: lastSet ? lastSet.kg : '', reps: '', rir: '', ok: false });
      it.target.sets = it.sets.length;
      save(); refresh();
    } else if (a === 'delset') {
      if (it.sets.length <= 1) return toast('Il faut au moins une série');
      const lastSet = it.sets[it.sets.length - 1];
      if (lastSet.ok && !confirm('Supprimer cette série déjà validée ?')) return;
      it.sets.pop();
      it.target.sets = it.sets.length;
      save(); refresh();
    } else if (a === 'swap') swapSheet(w, i);
    else if (a === 'info') infoSheet(w, i);
    else if (a === 'targets') targetsSheet(w, i);
    else if (a === 'finish') finishSheet(w);
    else if (a === 'menu') menuSheet(w);
  });
}

function stopRestIfDone(w) { if (w.done) stopRest(); }

function check(root, w, i, j) {
  const it = w.items[i];
  const s = it.sets[j];
  const ex = EXERCISES[it.ex] || {};
  if (!s.ok) {
    const row = root.querySelector(`.set-row[data-i="${i}"][data-j="${j}"]`);
    for (const f of ['kg', 'reps', 'rir']) {
      const inp = row.querySelector(`[data-f="${f}"]`);
      if (inp && s[f] === '' && inp.placeholder) s[f] = inp.placeholder;
    }
    if (isNaN(num(s.reps)) || num(s.reps) <= 0) { toast('Indique le nombre de répétitions'); return; }
    s.ok = true;
    unlockAudio();
    if (!w.done) {
      const allDone = w.items.every((x) => x.sets.every((y) => y.ok));
      if (allDone) { stopRest(); toast('Toutes les séries sont faites : valide la séance !'); }
      else if (it.target.ss && !it.target.rest) {
        const next = w.items[i + 1];
        toast(`Superset : enchaîne avec ${EXERCISES[next?.ex]?.name || 'l’exercice suivant'}`);
      } else if (it.target.rest) {
        startRest(it.target.rest, `Repos · ${ex.name || ''}`);
      }
    }
  } else {
    s.ok = false;
  }
  save();
  refresh();
}

function swapSheet(w, i) {
  const it = w.items[i];
  const tpl = state.templates[w.tpl];
  const tItem = tpl?.items.find((x) => x.slot === it.slot);
  const pool = tItem ? [tItem.ex, ...tItem.alts] : [];
  const props = [...new Set(pool)].filter((x) => x !== it.ex && EXERCISES[x]);
  const prim = EXERCISES[it.ex]?.m[0];
  const more = Object.keys(EXERCISES).filter((k) => k !== it.ex && !props.includes(k) && EXERCISES[k].m[0] === prim);
  const rec = bestRecords();
  const line = (k) => {
    const ex = EXERCISES[k];
    const last = lastPerformance(k, w);
    const info = last ? `Dernière fois : ${setsSummary(last.sets, k)}` : rec[k] ? '' : 'Jamais fait';
    return `<button class="list-btn" data-act="pick" data-ex="${k}"><span><b>${esc(ex.name)}</b>
      <span class="muted small block">${ex.m.map((m) => MUSCLES[m]).join(', ')}${info ? ' · ' + esc(info) : ''}</span></span></button>`;
  };
  openSheet({
    title: 'Changer d’exercice',
    tall: true,
    html: `<p class="muted">Actuel : <b>${esc(EXERCISES[it.ex]?.name)}</b></p>
      ${tItem ? `<label class="check-line"><input type="checkbox" id="perm" checked> Remplacer aussi dans le programme (prochaines séances)</label>` : ''}
      <div class="section-label">Équivalents proposés</div>
      ${props.map(line).join('') || '<p class="muted">Aucun équivalent défini.</p>'}
      ${more.length ? `<details><summary>Autres exercices pour le même muscle (${more.length})</summary>${more.map(line).join('')}</details>` : ''}`,
    onAction(act, el, e, sheet) {
      if (act !== 'pick') return;
      const nx = el.dataset.ex;
      if (it.sets.some((s) => s.ok) && !confirm('Des séries sont déjà validées pour cet exercice. Les effacer ?')) return;
      const perm = sheet.body.querySelector('#perm')?.checked;
      it.ex = nx;
      it.sets = it.sets.map(() => ({ kg: '', reps: '', rir: '', ok: false }));
      if (perm && tItem) {
        const old = tItem.ex;
        tItem.ex = nx;
        tItem.alts = [old, ...tItem.alts.filter((a) => a !== nx && a !== old)];
      }
      save();
      sheet.close();
      refresh();
      toast(perm ? 'Exercice remplacé dans le programme' : 'Exercice remplacé pour cette séance');
    },
  });
}

function platesFor(total, bar, list) {
  let side = (total - bar) / 2;
  if (side < 0) return null;
  const out = [];
  for (const p of list) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return { out, rest: side };
}
const r25 = (x) => Math.round(x / 2.5) * 2.5;

function infoSheet(w, i) {
  const it = w.items[i];
  const ex = EXERCISES[it.ex];
  const rec = bestRecords()[it.ex];
  const sug = suggestion(it.target, it.ex, w, w.deload);
  const working = num(it.sets.find((s) => s.kg !== '')?.kg) || sug.kg || null;
  let warm = '';
  if (ex.type === 'compound' && ex.unit === 'kg' && !ex.bw && working) {
    const bar = state.settings.barKg;
    const steps = [];
    if (ex.bar) steps.push([bar, 10]);
    for (const [p, r] of [[0.5, 8], [0.7, 4], [0.85, 2]]) {
      const kg = r25(working * p);
      if (!ex.bar || kg > bar) steps.push([kg, r]);
    }
    warm = `<div class="section-label">Échauffement pour ${fmt(working, 1)} kg</div>
      <div class="chips">${steps.map(([kg, r]) => `<span class="chip">${fmt(kg, 1)} kg × ${r}</span>`).join('')}</div>
      <p class="muted small">Repos court (60-90 s) entre ces séries. Elles ne comptent pas dans le travail.</p>`;
  }
  let plates = '';
  if (ex.bar && working) {
    const r = platesFor(working, state.settings.barKg, state.settings.plates);
    if (r) plates = `<div class="section-label">Disques par côté (barre ${state.settings.barKg} kg)</div>
      <div class="chips">${r.out.length ? r.out.map((p) => `<span class="chip plate">${fmt(p, 2)}</span>`).join('') : '<span class="muted">barre seule</span>'}</div>
      ${r.rest > 0.01 ? `<p class="muted small">Reste ${fmt(r.rest, 2)} kg par côté impossible à charger avec tes disques.</p>` : ''}`;
  }
  openSheet({
    title: ex.name,
    html: `<p>${esc(ex.cues)}</p>
      <p class="muted small">Muscles : ${ex.m.map((m) => MUSCLES[m]).join(', ')}${ex.uni ? ' · unilatéral (reps par côté)' : ''}${ex.bw ? ' · charge = lest ajouté' : ''}</p>
      ${warm}${plates}
      ${rec ? `<div class="section-label">Record</div><p>${esc(scoreLabel(it.ex))} : <b>${fmt(rec.best, 1)}</b> (${fmt(rec.setKg, 1)} × ${rec.setReps}, ${rec.date.split('-').reverse().join('/')})</p>` : ''}
      <div class="section-label">Rappel RIR</div>
      <p class="muted small">RIR = répétitions que tu aurais encore pu faire proprement. RIR 0 = échec. Sur les gros exercices, reste à 1-2.</p>`,
  });
}

function targetsSheet(w, i) {
  const it = w.items[i];
  const T = it.target;
  const tpl = state.templates[w.tpl];
  const tItem = tpl?.items.find((x) => x.slot === it.slot);
  const rests = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  openSheet({
    title: 'Objectifs de l’exercice',
    html: `<div class="form-grid">
        <label>Séries<input class="in" id="t-sets" inputmode="numeric" value="${T.sets}"></label>
        <label>Reps min<input class="in" id="t-min" inputmode="numeric" value="${T.min}"></label>
        <label>Reps max<input class="in" id="t-max" inputmode="numeric" value="${T.max}"></label>
        <label>RIR<input class="in" id="t-rir" value="${esc(T.rir)}"></label>
      </div>
      <label class="full">Repos<select class="in" id="t-rest">${rests.map((r) => `<option value="${r}" ${r === T.rest ? 'selected' : ''}>${restLabel(r)}</option>`).join('')}</select></label>
      ${tItem ? `<label class="check-line"><input type="checkbox" id="t-perm" checked> Appliquer aussi au programme</label>` : ''}
      <div class="sheet-actions">
        <button class="btn danger ghost" data-act="remove">${icon('trash')} Retirer l’exercice</button>
        <button class="btn primary" data-act="ok">Enregistrer</button>
      </div>`,
    onAction(act, el, e, sheet) {
      const b = sheet.body;
      const perm = b.querySelector('#t-perm')?.checked;
      if (act === 'remove') {
        if (!confirm(perm ? 'Retirer cet exercice de la séance ET du programme ?' : 'Retirer cet exercice de cette séance ?')) return;
        w.items.splice(i, 1);
        if (perm && tItem) tpl.items = tpl.items.filter((x) => x !== tItem);
        save(); sheet.close(); refresh();
        return;
      }
      if (act !== 'ok') return;
      const sets = Math.max(1, Math.min(10, parseInt(b.querySelector('#t-sets').value) || T.sets));
      let min = parseInt(b.querySelector('#t-min').value) || T.min;
      let max = parseInt(b.querySelector('#t-max').value) || T.max;
      if (max < min) [min, max] = [max, min];
      const rir = b.querySelector('#t-rir').value.trim() || T.rir;
      const rest = +b.querySelector('#t-rest').value;
      Object.assign(T, { sets, min, max, rir, rest });
      while (it.sets.length < sets) it.sets.push({ kg: it.sets[it.sets.length - 1]?.kg || '', reps: '', rir: '', ok: false });
      while (it.sets.length > sets && !it.sets[it.sets.length - 1].ok) it.sets.pop();
      if (perm && tItem) Object.assign(tItem, { sets: w.deload ? tItem.sets : sets, min, max, rir: rir === '3-4' && w.deload ? tItem.rir : rir, rest });
      save(); sheet.close(); refresh();
    },
  });
}

function menuSheet(w) {
  openSheet({
    title: 'Options de la séance',
    html: `<button class="list-btn" data-act="add">${icon('plus')} <span>Ajouter un exercice</span></button>
      <button class="list-btn danger" data-act="del">${icon('trash')} <span>Supprimer cette séance</span></button>`,
    onAction(act, el, e, sheet) {
      if (act === 'del') {
        if (!confirm('Supprimer définitivement cette séance ?')) return;
        state.workouts = state.workouts.filter((x) => x !== w);
        save(); stopRest(); sheet.close(); go('#/week');
      } else if (act === 'add') {
        sheet.close();
        addExerciseSheet(w);
      }
    },
  });
}

function addExerciseSheet(w) {
  const groups = {};
  for (const [k, ex] of Object.entries(EXERCISES)) (groups[ex.m[0]] ||= []).push(k);
  const html = `<label class="check-line"><input type="checkbox" id="a-perm"> Ajouter aussi au programme</label>` +
    Object.entries(groups).map(([m, list]) => `<details><summary>${MUSCLES[m]}</summary>${list.map((k) => `<button class="list-btn" data-act="pick" data-ex="${k}">${esc(EXERCISES[k].name)}</button>`).join('')}</details>`).join('');
  openSheet({
    title: 'Ajouter un exercice',
    tall: true,
    html,
    onAction(act, el, e, sheet) {
      if (act !== 'pick') return;
      const k = el.dataset.ex;
      const ex = EXERCISES[k];
      const explo = ex.type === 'explo';
      const target = explo
        ? { sets: 3, min: 3, max: 5, rir: '—', rest: 60, ss: false }
        : { sets: 3, min: 8, max: 12, rir: '1', rest: 90, ss: false };
      const slot = 'x_' + uid();
      w.items.push({ slot, tag: '+', ex: k, target, sets: Array.from({ length: 3 }, () => ({ kg: '', reps: '', rir: '', ok: false })) });
      if (sheet.body.querySelector('#a-perm')?.checked) {
        const tpl = state.templates[w.tpl];
        const alts = Object.keys(EXERCISES).filter((x) => x !== k && EXERCISES[x].m[0] === ex.m[0]).slice(0, 4);
        tpl.items.push({ slot, tag: String(tpl.items.length), ex: k, alts, sets: 3, min: target.min, max: target.max, rir: target.rir, rest: target.rest });
      }
      save(); sheet.close(); refresh();
      setTimeout(() => document.getElementById('ex-' + (w.items.length - 1))?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
  });
}

function finishSheet(w) {
  const st = workoutStats(w);
  const total = w.items.reduce((s, it) => s + it.sets.length, 0);
  const prs = sessionPRs(w);
  const missing = total - st.sets;
  const dur = Date.now() - w.start;
  openSheet({
    title: 'Valider la séance',
    html: `<div class="stats3">
        <div class="stat"><div class="stat-v">${fmtDuration(dur)}</div><div class="stat-l">durée</div></div>
        <div class="stat"><div class="stat-v">${st.sets}/${total}</div><div class="stat-l">séries</div></div>
        <div class="stat"><div class="stat-v">${fmt(st.volume / 1000, 2)} t</div><div class="stat-l">tonnage</div></div>
      </div>
      ${prs.length ? `<div class="section-label">Records battus</div>${prs.map((p) => `<div class="pr-line">🏆 <b>${esc(EXERCISES[p.ex]?.name)}</b> : ${fmt(p.prev, 1)} → <b>${fmt(p.best, 1)}</b></div>`).join('')}` : ''}
      ${missing > 0 ? `<p class="warn">${missing} série(s) non cochée(s) : elles ne seront pas comptées.</p>` : ''}
      <label class="full">Ressenti global : <b id="feel-v">7</b>/10
        <input type="range" id="feel" min="1" max="10" value="7"></label>
      <p class="muted small">1 = très facile · 7 = dur mais propre · 10 = au bout de ma vie</p>
      <label class="full">Notes (sommeil, douleur, sensations…)<textarea class="in" id="notes" rows="3"></textarea></label>
      <div class="sheet-actions"><button class="btn primary wide" data-act="ok">${icon('check')} Valider</button></div>`,
    onInput(t, e, sheet) {
      if (t.id === 'feel') sheet.body.querySelector('#feel-v').textContent = t.value;
    },
    onAction(act, el, e, sheet) {
      if (act !== 'ok') return;
      w.feel = +sheet.body.querySelector('#feel').value;
      w.notes = sheet.body.querySelector('#notes').value.trim();
      w.done = true;
      w.end = Date.now();
      save();
      stopRest();
      keepAwake(false);
      sheet.close();
      go('#/week');
      toast(prs.length ? `Séance validée : ${prs.length} record(s) !` : 'Séance validée, bien joué');
    },
  });
}
