// Écran « Séance » : saisie des séries, minuteur, changement d'exercice, validation.
import { state, save, saveSoon, uid, num, fmt, fmtDate, fmtDuration, esc } from '../store.js';
import { EXERCISES, MUSCLES } from '../data/exercises.js';
import { suggestion, lastPerformance, exerciseHistory, setScore, workingSets, workoutStats, sessionPRs, bestRecords, scoreLabel, latestWeight, setsSummary } from '../calc.js';
import { barbell } from '../charts.js';
import { openSheet, refresh, go, toast, icon } from '../ui.js';
import { startRest, stopRest, unlockAudio, keepAwake } from '../timer.js';

let tick = null;
let onScroll = null;
export function leave() {
  clearInterval(tick);
  tick = null;
  keepAwake(false);
  if (onScroll) window.removeEventListener('scroll', onScroll);
}

const restLabel = (s) => (!s ? 'enchaîner' : s >= 60 ? `${Math.floor(s / 60)}\u00a0min${s % 60 ? '\u00a0' + (s % 60) : ''}` : `${s}\u00a0s`);
const inVal = (v) => (v === null || v === undefined || isNaN(v) ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
const range = (T) => (T.min === T.max ? `${T.min}` : `${T.min} à ${T.max}`);

function exHTML(w, it, i) {
  const ex = EXERCISES[it.ex] || { name: it.ex, m: [], unit: 'kg', type: 'iso' };
  const T = it.target;
  const sug = w.done ? null : suggestion(T, it.ex, w, w.deload);
  const last = lastPerformance(it.ex, w);
  const lastSets = last ? last.sets : [];
  const unit = ex.unit === 'cm' ? 'cm' : ex.bw ? 'lest' : 'kg';
  const showRir = T.rir !== '—';
  const bodyKg = latestWeight();
  const hist = exerciseHistory(it.ex, w);
  const prevBest = hist.length ? Math.max(...hist.map((h) => h.best)) : null;
  const cur = workingSets(it);
  const curBest = cur.length ? Math.max(...cur.map((s) => setScore(it.ex, s, bodyKg))) : 0;
  const isPR = prevBest !== null && curBest > prevBest + 0.01;
  const okCount = it.sets.filter((s) => s.ok).length;
  const complete = okCount === it.sets.length && it.sets.length > 0;
  const next = T.ss && !T.rest ? w.items[i + 1] : null;

  const targetBits = [`${T.sets} × ${range(T)}${ex.uni ? ' par côté' : ''}`];
  targetBits.push(showRir ? `${T.rir} en réserve` : 'vitesse maximale');
  targetBits.push(next ? `enchaîner avec ${EXERCISES[next.ex]?.name || 'le suivant'}` : `repos ${restLabel(T.rest)}`);

  let note = '';
  if (sug && ex.type === 'explo' && ex.unit !== 'cm') {
    if (sug.kg) note = `<p class="ex-note">Objectif <b>${inVal(sug.kg)} kg</b>, comme la dernière fois.</p>`;
  } else if (sug) {
    if (sug.kg != null && ex.unit !== 'cm') note = `<p class="ex-note ${sug.up ? 'up' : ''}">Objectif <b>${inVal(sug.kg)} ${unit === 'lest' ? 'kg de lest' : 'kg'}</b>. ${esc(sug.text.replace(/^Dernière fois[^:]*: [^.]*\. ?/, ''))}</p>`;
    else note = `<p class="ex-note">${esc(sug.text.replace(/^Dernière fois[^:]*: [^.]*\. ?/, ''))}</p>`;
  }

  const rows = it.sets.map((s, j) => {
    const ps = lastSets[j];
    const prevHere = j > 0 ? it.sets[j - 1].kg : '';
    const phKg = prevHere !== '' ? prevHere : sug && sug.kg != null ? inVal(sug.kg) : ps ? inVal(num(ps.kg)) : ex.bw ? '0' : '';
    const phReps = ps ? String(ps.reps) : String(T.max);
    const phRir = showRir ? String(T.rir).split('-')[0] : '';
    const prev = ps ? (ex.unit === 'cm' ? `${inVal(num(ps.kg))} cm` : `${inVal(num(ps.kg))} × ${ps.reps}`) : '–';
    return `<div class="set set-grid ${s.ok ? 'done' : ''} ${showRir ? '' : 'norir'}" data-i="${i}" data-j="${j}">
      <span class="s-n">${j + 1}</span>
      <span class="s-prev">${prev}</span>
      <input data-f="kg" data-i="${i}" data-j="${j}" inputmode="decimal" enterkeyhint="next" value="${esc(s.kg)}" placeholder="${esc(phKg)}" aria-label="Série ${j + 1}, ${unit}">
      <input data-f="reps" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="next" value="${esc(s.reps)}" placeholder="${esc(phReps)}" aria-label="Série ${j + 1}, répétitions">
      ${showRir ? `<input data-f="rir" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="done" value="${esc(s.rir)}" placeholder="${esc(phRir)}" aria-label="Série ${j + 1}, répétitions en réserve">` : ''}
      <button class="s-chk" data-act="check" data-i="${i}" data-j="${j}" aria-label="${s.ok ? 'Annuler la série' : 'Valider la série'} ${j + 1}">${icon('check')}</button>
    </div>`;
  }).join('');

  return `<section class="ex ${complete ? 'complete' : ''}" id="ex-${i}">
    <div class="ex-hd">
      <span class="ex-idx">${esc(it.tag || '+')}</span>
      <div><h2>${esc(ex.name)}${isPR ? '<span class="record">Record</span>' : ''}</h2>
        <p class="ex-target">${targetBits.join(', ')}</p></div>
      <button class="icon-btn" data-act="menu-ex" data-i="${i}" aria-label="Options de ${esc(ex.name)}">${icon('more')}</button>
    </div>
    ${note}
    <div class="sets">
      <div class="sets-hd set-grid ${showRir ? '' : 'norir'}"><span>Série</span><span>Avant</span><span>${unit}</span><span>Reps</span>${showRir ? '<span>Réserve</span>' : ''}<span></span></div>
      ${rows}
    </div>
    <button class="link add-set" data-act="addset" data-i="${i}">Ajouter une série</button>
  </section>`;
}

export function render(root, id) {
  clearInterval(tick);
  const w = state.workouts.find((x) => x.id === id);
  if (!w) { go('#/week'); return; }
  if (!w.done) keepAwake(true);
  const total = w.items.reduce((s, it) => s + it.sets.length, 0);
  const okAll = w.items.reduce((s, it) => s + it.sets.filter((x) => x.ok).length, 0);
  const st = workoutStats(w);
  const code = state.templates[w.tpl]?.code;

  root.innerHTML = `
    <div class="bar" id="bar">
      <button class="bar-back" data-act="back">${icon('back')}Semaine</button>
      <span class="bar-title">${esc(w.name)}</span>
      <span class="bar-end">${w.done ? '' : `<button class="link" data-act="finish">Terminer</button>`}<button class="icon-btn" data-act="menu" aria-label="Options de la séance">${icon('more')}</button></span>
    </div>
    <div class="ses-hd">
      <p class="kicker"><span class="date-field">${code ? `Séance ${esc(code)}, ` : ''}${fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'long' })}<input type="date" data-f="date" value="${w.date}" aria-label="Changer la date"></span>${w.deload ? ', décharge' : ''}</p>
      <h1>${esc(w.name)}</h1>
      <div class="ses-stats">
        <div class="ses-stat"><span class="num" id="elapsed">${w.done && st.dur ? fmtDuration(st.dur).replace(' min', '') : '0'}</span><span>minutes</span></div>
        <div class="ses-stat"><span class="num">${okAll}<span class="faint">/${total}</span></span><span>séries</span></div>
        <div class="ses-stat"><span class="num">${fmt(st.volume / 1000, 1)}</span><span>tonnes</span></div>
      </div>
      <div class="progress"><i style="width:${total ? (okAll / total) * 100 : 0}%"></i></div>
    </div>
    ${w.done ? `<p class="note" style="margin-bottom:14px">Séance validée${w.feel ? `, ressenti ${w.feel} sur 10` : ''}. Tes corrections sont enregistrées automatiquement.</p>` : ''}
    ${w.items.map((it, i) => exHTML(w, it, i)).join('')}
    ${w.notes ? `<div class="section"><div class="section-hd"><h2>Notes</h2></div><p class="note">${esc(w.notes)}</p></div>` : ''}
    <div class="ses-end">${w.done
      ? `<button class="btn wide" data-act="back">Fermer</button>`
      : `<button class="btn primary wide" data-act="finish">Terminer la séance</button>`}</div>`;

  if (!w.done) {
    const el = root.querySelector('#elapsed');
    const upd = () => { el.textContent = Math.max(0, Math.round((Date.now() - w.start) / 60000)); };
    upd();
    tick = setInterval(upd, 15000);
  } else if (st.dur) {
    root.querySelector('#elapsed').textContent = Math.round(st.dur / 60000);
  }

  const bar = root.querySelector('#bar');
  if (onScroll) window.removeEventListener('scroll', onScroll);
  onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 70);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  root.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'date') {
      if (e.target.value) { w.date = e.target.value; save(); refresh(); }
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
    if (a === 'back') { if (w.done) stopRest(); go('#/week'); }
    else if (a === 'check') check(root, w, i, +t.dataset.j);
    else if (a === 'addset') {
      const lastSet = it.sets[it.sets.length - 1];
      it.sets.push({ kg: lastSet ? lastSet.kg : '', reps: '', rir: '', ok: false });
      it.target.sets = it.sets.length;
      save(); refresh();
    } else if (a === 'menu-ex') exMenu(w, i);
    else if (a === 'finish') finishSheet(w);
    else if (a === 'menu') menuSheet(w);
  });
}

function check(root, w, i, j) {
  const it = w.items[i];
  const s = it.sets[j];
  const ex = EXERCISES[it.ex] || {};
  if (!s.ok) {
    const row = root.querySelector(`.set[data-i="${i}"][data-j="${j}"]`);
    for (const f of ['kg', 'reps', 'rir']) {
      const inp = row.querySelector(`[data-f="${f}"]`);
      if (inp && s[f] === '' && inp.placeholder) s[f] = inp.placeholder;
    }
    if (isNaN(num(s.reps)) || num(s.reps) <= 0) { toast('Indique le nombre de répétitions'); return; }
    s.ok = true;
    unlockAudio();
    if (!w.done) {
      const allDone = w.items.every((x) => x.sets.every((y) => y.ok));
      if (allDone) { stopRest(); toast('Toutes les séries sont faites'); }
      else if (it.target.ss && !it.target.rest) toast(`Enchaîne avec ${EXERCISES[w.items[i + 1]?.ex]?.name || 'l’exercice suivant'}`);
      else if (it.target.rest) startRest(it.target.rest, ex.name || 'Repos');
    }
  } else {
    s.ok = false;
  }
  save();
  refresh();
}

function exMenu(w, i) {
  const it = w.items[i];
  const ex = EXERCISES[it.ex];
  openSheet({
    title: ex.name,
    html: `<div class="rows">
      <button class="row tap" style="width:100%;text-align:left" data-act="swap"><span class="row-main"><span class="row-title">Changer d’exercice</span><span class="row-sub">3 ou 4 équivalents proposés</span></span>${icon('next').replace('class="ic"', 'class="ic chev"')}</button>
      <button class="row tap" style="width:100%;text-align:left" data-act="info"><span class="row-main"><span class="row-title">Conseils et échauffement</span><span class="row-sub">Technique, séries de chauffe, disques</span></span>${icon('next').replace('class="ic"', 'class="ic chev"')}</button>
      <button class="row tap" style="width:100%;text-align:left" data-act="targets"><span class="row-main"><span class="row-title">Modifier l’objectif</span><span class="row-sub">Séries, répétitions, repos</span></span>${icon('next').replace('class="ic"', 'class="ic chev"')}</button>
      <button class="row tap" style="width:100%;text-align:left" data-act="delset"><span class="row-main"><span class="row-title">Retirer la dernière série</span></span></button>
    </div>`,
    onAction(act, el, e, sheet) {
      if (act === 'delset') {
        if (it.sets.length <= 1) return toast('Il faut garder au moins une série');
        const last = it.sets[it.sets.length - 1];
        if (last.ok && !confirm('Cette série est validée. La retirer quand même ?')) return;
        it.sets.pop();
        it.target.sets = it.sets.length;
        save(); sheet.close(); refresh();
        return;
      }
      sheet.close();
      if (act === 'swap') swapSheet(w, i);
      else if (act === 'info') infoSheet(w, i);
      else if (act === 'targets') targetsSheet(w, i);
    },
  });
}

function swapSheet(w, i) {
  const it = w.items[i];
  const tpl = state.templates[w.tpl];
  const tItem = tpl?.items.find((x) => x.slot === it.slot);
  const pool = tItem ? [tItem.ex, ...tItem.alts] : [];
  const props = [...new Set(pool)].filter((x) => x !== it.ex && EXERCISES[x]);
  const prim = EXERCISES[it.ex]?.m[0];
  const more = Object.keys(EXERCISES).filter((k) => k !== it.ex && !props.includes(k) && EXERCISES[k].m[0] === prim);
  const line = (k) => {
    const ex = EXERCISES[k];
    const last = lastPerformance(k, w);
    return `<button class="row tap" style="width:100%;text-align:left" data-act="pick" data-ex="${k}"><span class="row-main">
      <span class="row-title">${esc(ex.name)}</span>
      <span class="row-sub">${last ? `Dernière fois ${esc(setsSummary(last.sets, k))}` : ex.m.map((m) => MUSCLES[m]).join(', ')}</span></span></button>`;
  };
  openSheet({
    title: 'Changer d’exercice',
    tall: true,
    html: `<p class="muted">À la place de ${esc(EXERCISES[it.ex]?.name)}.</p>
      ${tItem ? `<label class="row" style="margin-top:8px"><span class="row-main"><span class="row-title">Garder pour les prochaines séances</span></span><span class="switch"><input type="checkbox" id="perm" checked><span></span></span></label>` : ''}
      <p class="label">Équivalents</p>
      <div class="rows">${props.map(line).join('') || '<p class="caption" style="padding:12px 0">Aucun équivalent défini.</p>'}</div>
      ${more.length ? `<details><summary>Autres exercices pour ce muscle (${more.length})</summary><div class="rows">${more.map(line).join('')}</div></details>` : ''}`,
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
      save(); sheet.close(); refresh();
      toast(perm ? 'Remplacé aussi dans le programme' : 'Remplacé pour cette séance');
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
    warm = `<div class="section"><div class="section-hd"><h2>Échauffement</h2><span class="caption">pour ${fmt(working, 1)} kg</span></div>
      <div class="rows">${steps.map(([kg, r], k) => `<div class="row"><span class="row-title">Série ${k + 1}</span><span class="row-end"><span class="num">${fmt(kg, 1)}</span> kg × ${r}</span></div>`).join('')}</div>
      <p class="caption" style="margin-top:8px">Repos court entre ces séries. Elles ne comptent pas dans le travail.</p></div>`;
  }
  let plates = '';
  if (ex.bar && working) {
    const r = platesFor(working, state.settings.barKg, state.settings.plates);
    if (r) plates = `<div class="section"><div class="section-hd"><h2>Disques par côté</h2><span class="caption">barre de ${state.settings.barKg} kg</span></div>
      ${r.out.length ? barbell(r.out) + `<p class="note" style="margin-top:6px">${r.out.map((p) => fmt(p, 2)).join(' + ')} kg de chaque côté.</p>` : '<p class="note">Barre seule.</p>'}
      ${r.rest > 0.01 ? `<p class="caption">Il manque ${fmt(r.rest, 2)} kg par côté avec tes disques.</p>` : ''}</div>`;
  }
  openSheet({
    title: ex.name,
    tall: !!(warm || plates),
    html: `<p style="font-size:17px;line-height:1.5">${esc(ex.cues)}</p>
      <p class="caption" style="margin-top:10px">${ex.m.map((m) => MUSCLES[m]).join(', ')}${ex.uni ? '. Répétitions comptées par côté' : ''}${ex.bw ? '. La charge saisie est le lest ajouté' : ''}.</p>
      ${warm}${plates}
      ${rec ? `<div class="section"><div class="section-hd"><h2>Record</h2></div><p class="note">${esc(scoreLabel(it.ex))} : <b class="num" style="font-size:22px;color:var(--ink)">${fmt(rec.best, 1)}</b>, avec ${fmt(rec.setKg, 1)} × ${rec.setReps} le ${rec.date.split('-').reverse().join('/')}.</p></div>` : ''}`,
  });
}

function targetsSheet(w, i) {
  const it = w.items[i];
  const T = it.target;
  const tpl = state.templates[w.tpl];
  const tItem = tpl?.items.find((x) => x.slot === it.slot);
  const rests = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  openSheet({
    title: 'Objectif',
    html: `<div class="grid2">
        <div><label class="label" for="t-sets">Séries</label><input class="field" id="t-sets" inputmode="numeric" value="${T.sets}"></div>
        <div><label class="label" for="t-rir">Reps en réserve</label><input class="field" id="t-rir" value="${esc(T.rir)}"></div>
        <div><label class="label" for="t-min">Reps minimum</label><input class="field" id="t-min" inputmode="numeric" value="${T.min}"></div>
        <div><label class="label" for="t-max">Reps maximum</label><input class="field" id="t-max" inputmode="numeric" value="${T.max}"></div>
      </div>
      <label class="label" for="t-rest">Repos</label>
      <select class="field" id="t-rest">${rests.map((r) => `<option value="${r}" ${r === T.rest ? 'selected' : ''}>${restLabel(r)}</option>`).join('')}</select>
      ${tItem ? `<label class="row" style="margin-top:10px"><span class="row-main"><span class="row-title">Appliquer au programme</span></span><span class="switch"><input type="checkbox" id="t-perm" checked><span></span></span></label>` : ''}
      <div class="actions"><button class="btn primary" data-act="ok">Enregistrer</button></div>
      <div class="link-row" style="margin-top:16px"><button class="link danger" data-act="remove">Retirer cet exercice</button></div>`,
    onAction(act, el, e, sheet) {
      const b = sheet.body;
      const perm = b.querySelector('#t-perm')?.checked;
      if (act === 'remove') {
        if (!confirm(perm ? 'Retirer cet exercice de la séance et du programme ?' : 'Retirer cet exercice de cette séance ?')) return;
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
    title: 'Séance',
    html: `<div class="rows">
      <button class="row tap" style="width:100%;text-align:left" data-act="add"><span class="row-main"><span class="row-title">Ajouter un exercice</span></span>${icon('next').replace('class="ic"', 'class="ic chev"')}</button>
      <button class="row tap" style="width:100%;text-align:left" data-act="del"><span class="row-main"><span class="row-title" style="color:var(--red)">Supprimer cette séance</span></span></button>
    </div>`,
    onAction(act, el, e, sheet) {
      if (act === 'del') {
        if (!confirm('Supprimer définitivement cette séance et ses séries ?')) return;
        state.workouts = state.workouts.filter((x) => x !== w);
        save(); stopRest(); sheet.close(); go('#/week');
        toast('Séance supprimée');
      } else if (act === 'add') { sheet.close(); addExerciseSheet(w); }
    },
  });
}

function addExerciseSheet(w) {
  const groups = {};
  for (const [k, ex] of Object.entries(EXERCISES)) (groups[ex.m[0]] ||= []).push(k);
  const html = `<label class="row"><span class="row-main"><span class="row-title">Ajouter aussi au programme</span></span><span class="switch"><input type="checkbox" id="a-perm"><span></span></span></label>` +
    Object.entries(groups).map(([m, list]) => `<details class="cat"><summary>${MUSCLES[m]}<span>${list.length}</span></summary><div class="rows">${list.map((k) => `<button class="row tap" style="width:100%;text-align:left" data-act="pick" data-ex="${k}"><span class="row-title">${esc(EXERCISES[k].name)}</span></button>`).join('')}</div></details>`).join('');
  openSheet({
    title: 'Ajouter un exercice',
    tall: true,
    html,
    onAction(act, el, e, sheet) {
      if (act !== 'pick') return;
      const k = el.dataset.ex;
      const ex = EXERCISES[k];
      const target = ex.type === 'explo'
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
  let feel = 7;
  openSheet({
    title: 'Terminer la séance',
    html: `<div class="rows">
        <div class="row"><span class="row-title">Durée</span><span class="row-end"><span class="num">${Math.round(dur / 60000)}</span> min</span></div>
        <div class="row"><span class="row-title">Séries</span><span class="row-end"><span class="num">${st.sets}</span> sur ${total}</span></div>
        <div class="row"><span class="row-title">Tonnage</span><span class="row-end"><span class="num">${fmt(st.volume / 1000, 2)}</span> t</span></div>
        ${prs.map((p) => `<div class="row"><span class="row-main"><span class="row-title">${esc(EXERCISES[p.ex]?.name)}</span><span class="row-sub" style="color:var(--yellow-ink)">Nouveau record</span></span><span class="row-end">${fmt(p.prev, 1)} → <span class="num">${fmt(p.best, 1)}</span></span></div>`).join('')}
      </div>
      ${missing > 0 ? `<p class="warn" style="margin-top:12px">${missing} série${missing > 1 ? 's' : ''} non cochée${missing > 1 ? 's ne seront pas comptées' : ' ne sera pas comptée'}.</p>` : ''}
      <p class="label">Difficulté ressentie</p>
      <div class="scale">${Array.from({ length: 10 }, (_, k) => `<button data-act="feel" data-v="${k + 1}" class="${k + 1 === feel ? 'on' : ''}">${k + 1}</button>`).join('')}</div>
      <div class="scale-legend"><span>facile</span><span>dur mais propre</span><span>à fond</span></div>
      <label class="label" for="notes">Notes</label>
      <textarea class="field" id="notes" rows="3" placeholder="Sommeil, douleur, sensations"></textarea>
      <div class="actions"><button class="btn primary" data-act="ok">Valider la séance</button></div>`,
    onAction(act, el, e, sheet) {
      if (act === 'feel') {
        feel = +el.dataset.v;
        sheet.body.querySelectorAll('.scale button').forEach((b) => b.classList.toggle('on', +b.dataset.v === feel));
        return;
      }
      if (act !== 'ok') return;
      w.feel = feel;
      w.notes = sheet.body.querySelector('#notes').value.trim();
      w.done = true;
      w.end = Date.now();
      save(); stopRest(); keepAwake(false); sheet.close();
      go('#/week');
      toast(prs.length ? `Séance validée, ${prs.length} record${prs.length > 1 ? 's' : ''}` : 'Séance validée');
    },
  });
}
