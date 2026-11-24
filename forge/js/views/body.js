// Écran « Corps » : poids, mensurations, composition corporelle, photos.
import { state, save, uid, today, addDays, fmtDate, fmt, num, esc } from '../store.js';
import { weightTrend, avgWeight, weightRate, currentWeight, GOALS, MEASURES, bodyComposition, latestMeasures } from '../calc.js';
import { lineChart } from '../charts.js';
import { putPhoto, allPhotos, deletePhoto, resizeImage } from '../photos.js';
import { openSheet, refresh, toast, icon } from '../ui.js';

let tab = 'poids';
let range = 90;
let selMeasure = 'bras';
let photoUrls = [];

export function leave() {
  photoUrls.forEach((u) => URL.revokeObjectURL(u));
  photoUrls = [];
}

export function render(root) {
  leave();
  root.innerHTML = `
    <header class="page-head"><div class="ph-center"><div class="ph-title">Corps</div></div></header>
    <div class="seg big">
      ${[['poids', 'Poids'], ['mesures', 'Mensurations'], ['photos', 'Photos']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}
    </div>
    <div id="body-content"></div>`;
  const c = root.querySelector('#body-content');
  if (tab === 'poids') renderWeight(c);
  else if (tab === 'mesures') renderMeasures(c);
  else renderPhotos(c);

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && t.dataset.act === 'tab') { tab = t.dataset.v; refresh(); }
  });
}

// ---------------- Poids ----------------
function verdict(rate) {
  if (!rate || !state.profile) return '';
  const g = GOALS[state.profile.goal];
  const [lo, hi] = g.rate;
  const p = rate.pctWeek;
  let msg, cls = 'good';
  if (p < lo) { msg = `Tu perds plus vite que prévu (${fmt(p, 2)} %/sem). Pour garder ton muscle, remonte un peu les calories.`; cls = 'bad'; }
  else if (p > hi) {
    msg = state.profile.goal === 'bulk'
      ? `Tu prends plus vite que prévu (${fmt(p, 2)} %/sem) : risque de stocker du gras.`
      : `Ton poids ne baisse pas assez (${fmt(p, 2)} %/sem). Vérifie que tu notes tout ; l’ajustement automatique corrigera la cible.`;
    cls = 'warn-text';
  } else msg = `Rythme dans la cible (${fmt(p, 2)} %/sem pour ${g.label.toLowerCase()}). Continue.`;
  if (state.profile.goal === 'recomp') msg += ' En recomposition, regarde aussi le tour de taille et le tour de bras : le poids seul ment.';
  return `<p class="${cls}">${msg}</p>`;
}

function renderWeight(c) {
  const t = today();
  const todayW = state.weights.find((w) => w.d === t);
  const a7 = avgWeight(t, 7), a7p = avgWeight(addDays(t, -7), 7), a30p = avgWeight(addDays(t, -30), 7);
  const rate = weightRate(21);
  const start = addDays(t, -range);
  const tr = weightTrend().filter((w) => w.d >= start);
  const comp = bodyComposition();
  c.innerHTML = `
    <section class="card">
      <div class="weigh-row">
        <input class="in" type="date" id="w-date" value="${t}">
        <input class="in big" id="w-kg" inputmode="decimal" placeholder="kg" value="${todayW ? String(todayW.kg).replace('.', ',') : ''}">
        <button class="btn primary" data-act="saveW">OK</button>
      </div>
      <p class="muted small">Pèse-toi le matin, à jeun, après être allé aux toilettes. Seule la moyenne sur 7 jours compte.</p>
    </section>
    <div class="stats3">
      <div class="stat"><div class="stat-v">${a7 ? fmt(a7, 1) : '–'}</div><div class="stat-l">moyenne 7 j</div></div>
      <div class="stat"><div class="stat-v">${a7 && a7p ? (a7 - a7p >= 0 ? '+' : '') + fmt(a7 - a7p, 1) : '–'}</div><div class="stat-l">vs sem. passée</div></div>
      <div class="stat"><div class="stat-v">${a7 && a30p ? (a7 - a30p >= 0 ? '+' : '') + fmt(a7 - a30p, 1) : '–'}</div><div class="stat-l">sur 30 j</div></div>
    </div>
    <section class="card">
      <div class="row-between"><h2>Évolution</h2>
        <div class="seg">${[[30, '1 m'], [90, '3 m'], [365, '1 an']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-r="${v}">${l}</button>`).join('')}</div></div>
      ${lineChart([
        { pts: tr.map((w) => ({ x: w.d, y: w.avg })), color: 'var(--accent)', dots: false, width: 2.6 },
        { pts: tr.map((w) => ({ x: w.d, y: w.kg })), color: 'var(--muted)', line: false, r: 2.4, faint: true },
      ], { title: 'Points : pesées · Ligne : moyenne 7 jours (kg)' })}
      ${rate ? `<p>Rythme sur 3 semaines : <b>${rate.kgWeek >= 0 ? '+' : ''}${fmt(rate.kgWeek, 2)} kg/sem</b></p>${verdict(rate)}` : '<p class="muted small">Le rythme s’affiche après au moins 4 pesées sur 1 semaine.</p>'}
    </section>
    ${comp ? compCard(comp) : ''}
    <section class="card">
      <h2>Dernières pesées</h2>
      ${[...state.weights].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 14).map((w) => `<div class="hist-row"><span class="muted">${fmtDate(w.d)}</span><span><b>${fmt(w.kg, 1)} kg</b> <button class="icon-btn xs" data-del="${w.d}" aria-label="Supprimer">✕</button></span></div>`).join('') || '<p class="muted">Aucune pesée.</p>'}
    </section>`;

  c.addEventListener('click', (e) => {
    const r = e.target.closest('[data-r]');
    if (r) { range = +r.dataset.r; refresh(); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm('Supprimer cette pesée ?')) return;
      state.weights = state.weights.filter((w) => w.d !== del.dataset.del);
      save(); refresh(); return;
    }
    if (e.target.closest('[data-act="saveW"]')) {
      const d = c.querySelector('#w-date').value || t;
      const kg = num(c.querySelector('#w-kg').value);
      if (!(kg > 25 && kg < 350)) return toast('Poids invalide');
      state.weights = state.weights.filter((w) => w.d !== d);
      state.weights.push({ d, kg });
      save(); refresh(); toast('Pesée enregistrée');
    }
  });
}

function compCard(comp) {
  return `<section class="card">
    <h2>Composition estimée</h2>
    <div class="stats4">
      <div class="stat"><div class="stat-v">${fmt(comp.bf, 1)} %</div><div class="stat-l">masse grasse</div></div>
      <div class="stat"><div class="stat-v">${fmt(comp.lean, 1)}</div><div class="stat-l">kg masse maigre</div></div>
      <div class="stat"><div class="stat-v">${fmt(comp.fatKg, 1)}</div><div class="stat-l">kg de gras</div></div>
      <div class="stat"><div class="stat-v">${fmt(comp.ffmi, 1)}</div><div class="stat-l">FFMI</div></div>
    </div>
    <p class="muted small">Source : ${esc(comp.src)}. Marge d’erreur de ±3-4 points : suis la tendance, pas le chiffre exact. FFMI (indice de masse maigre) : 18-20 = moyen, 20-22 = musclé, 22-25 = très musclé.</p>
  </section>`;
}

// ---------------- Mensurations ----------------
function renderMeasures(c) {
  const list = [...state.measures].sort((a, b) => (a.d < b.d ? -1 : 1));
  const last = latestMeasures();
  const firstOf = (k) => list.find((m) => m[k] !== undefined && m[k] !== '' && m[k] !== null);
  const pts = list.filter((m) => m[selMeasure] !== undefined && m[selMeasure] !== '').map((m) => ({ x: m.d, y: num(m[selMeasure]) }));
  const meta = MEASURES.find((m) => m.k === selMeasure);
  const comp = bodyComposition();

  // lecture recomposition
  let reading = '';
  const fT = firstOf('taille'), fB = firstOf('bras');
  if (fT && fB && last.taille && last.bras && last.taille.d !== fT.d) {
    const dT = num(last.taille.v) - num(fT.taille), dB = num(last.bras.v) - num(fB.bras);
    const wFirst = state.weights.filter((w) => w.d <= fT.d).slice(-1)[0];
    const dW = wFirst ? currentWeight() - wFirst.kg : null;
    reading = `<section class="card"><h2>Lecture</h2><p>Depuis le ${fmtDate(fT.d, { day: 'numeric', month: 'long' })} : taille <b>${dT >= 0 ? '+' : ''}${fmt(dT, 1)} cm</b>, bras <b>${dB >= 0 ? '+' : ''}${fmt(dB, 1)} cm</b>${dW !== null ? `, poids <b>${dW >= 0 ? '+' : ''}${fmt(dW, 1)} kg</b>` : ''}.</p>
      <p class="${dT <= 0 && dB >= 0 ? 'good' : 'muted'}">${dT <= 0 && dB >= 0 ? 'Taille qui baisse et bras qui monte : la recomposition fonctionne.' : dT > 0 && dB <= 0 ? 'Taille en hausse sans gain au bras : vérifie les calories et la régularité des séances.' : 'Signaux mitigés : attends 4 semaines de plus avant de conclure.'}</p></section>`;
  }

  c.innerHTML = `
    <section class="card">
      <div class="row-between"><h2>Nouvelle mesure</h2><input class="in date-sm" type="date" id="m-date" value="${today()}"></div>
      <div class="form-grid">
        ${MEASURES.map((m) => `<label>${esc(m.label)} <span class="muted small">(${m.unit || 'cm'})</span><input class="in" id="m-${m.k}" inputmode="decimal" placeholder="${last[m.k] ? String(last[m.k].v).replace('.', ',') : ''}"></label>`).join('')}
      </div>
      <button class="btn primary wide" data-act="saveM">Enregistrer</button>
      <details class="tips"><summary>Comment bien mesurer</summary>
        <p class="small">Mètre ruban souple, le matin, toujours au même endroit, sans serrer. Bras : contracté, au plus gros du biceps, toujours le même bras. Taille : au niveau du nombril, ventre relâché, en fin d’expiration. Cou : juste sous la pomme d’Adam. Hanches : au plus large des fesses. Cuisse : au plus gros, debout. Une mesure toutes les 2 à 4 semaines suffit.</p>
      </details>
    </section>
    ${comp ? compCard(comp) : '<p class="muted small center">Renseigne taille et cou' + (state.profile?.sex === 'f' ? ' et hanches' : '') + ' pour estimer ton taux de masse grasse.</p>'}
    ${reading}
    <section class="card">
      <select class="in" id="m-sel">${MEASURES.map((m) => `<option value="${m.k}" ${m.k === selMeasure ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
      ${lineChart([{ pts, color: 'var(--blue)' }], { title: `${meta.label} (${meta.unit || 'cm'})`, minPad: 0.3 })}
    </section>
    <section class="card">
      <h2>Bilan</h2>
      <div class="table">
        <div class="tr th"><span>Mesure</span><span>Début</span><span>Actuel</span><span>Écart</span></div>
        ${MEASURES.map((m) => {
          const f = firstOf(m.k);
          const l = last[m.k];
          if (!f || !l) return '';
          const d = num(l.v) - num(f[m.k]);
          return `<div class="tr"><span>${esc(m.label)}</span><span>${fmt(num(f[m.k]), 1)}</span><span>${fmt(num(l.v), 1)}</span><span class="${d === 0 ? '' : (d > 0) === ['taille', 'hanches', 'bf'].includes(m.k) ? 'bad' : 'good'}">${d >= 0 ? '+' : ''}${fmt(d, 1)}</span></div>`;
        }).join('')}
      </div>
    </section>
    <section class="card">
      <h2>Historique</h2>
      ${list.slice().reverse().map((m) => `<div class="hist-row"><span class="muted">${fmtDate(m.d)}</span><span class="small">${MEASURES.filter((x) => m[x.k] !== undefined && m[x.k] !== '').map((x) => `${x.label.split(' ')[0]} ${fmt(num(m[x.k]), 1)}`).join(' · ')} <button class="icon-btn xs" data-delm="${m.d}">✕</button></span></div>`).join('') || '<p class="muted">Aucune mesure.</p>'}
    </section>`;

  c.addEventListener('change', (e) => { if (e.target.id === 'm-sel') { selMeasure = e.target.value; refresh(); } });
  c.addEventListener('click', (e) => {
    const del = e.target.closest('[data-delm]');
    if (del) {
      if (!confirm('Supprimer les mesures de cette date ?')) return;
      state.measures = state.measures.filter((m) => m.d !== del.dataset.delm);
      save(); refresh(); return;
    }
    if (!e.target.closest('[data-act="saveM"]')) return;
    const d = c.querySelector('#m-date').value || today();
    const entry = state.measures.find((m) => m.d === d) || { d };
    let n = 0;
    for (const m of MEASURES) {
      const v = num(c.querySelector('#m-' + m.k).value);
      if (!isNaN(v) && v > 0) { entry[m.k] = v; n++; }
    }
    if (!n) return toast('Aucune valeur saisie');
    if (!state.measures.includes(entry)) state.measures.push(entry);
    save(); refresh(); toast(`${n} mesure(s) enregistrée(s)`);
  });
}

// ---------------- Photos ----------------
async function renderPhotos(c) {
  c.innerHTML = `
    <section class="card">
      <h2>Photos de progression</h2>
      <p class="muted small">Même lumière, même tenue, même distance, le matin. Une série (face, profil, dos) toutes les 4 semaines. Les photos restent uniquement sur ton téléphone.</p>
      <div class="photo-add">
        <select class="in" id="p-pose"><option>Face</option><option>Profil</option><option>Dos</option></select>
        <label class="btn primary">${icon('camera')} Ajouter<input type="file" accept="image/*" id="p-file" hidden></label>
      </div>
    </section>
    <div id="p-list"><p class="muted center">Chargement…</p></div>`;
  let photos = [];
  try { photos = await allPhotos(); } catch (e) { c.querySelector('#p-list').innerHTML = '<p class="warn">Stockage des photos indisponible.</p>'; return; }
  const byDate = {};
  photos.forEach((p) => (byDate[p.d] ||= []).push(p));
  const dates = Object.keys(byDate).sort().reverse();
  c.querySelector('#p-list').innerHTML = dates.length ? `
    ${dates.length > 1 ? `<section class="card"><h2>Comparer</h2><div class="cmp-row">
      <select class="in" id="c-a">${dates.map((d, i) => `<option ${i === dates.length - 1 ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <select class="in" id="c-b">${dates.map((d) => `<option>${d}</option>`).join('')}</select>
      <select class="in" id="c-pose"><option>Face</option><option>Profil</option><option>Dos</option></select>
      <button class="btn ghost" data-act="cmp">Voir</button></div></section>` : ''}
    ${dates.map((d) => `<section class="card"><b>${fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })}</b><div class="photo-grid">
      ${byDate[d].map((p) => { const u = URL.createObjectURL(p.blob); photoUrls.push(u); return `<figure data-pid="${p.id}"><img src="${u}" alt="${esc(p.pose)}"><figcaption>${esc(p.pose)}</figcaption></figure>`; }).join('')}
    </div></section>`).join('')}` : '<p class="muted center">Aucune photo pour l’instant.</p>';

  c.addEventListener('change', async (e) => {
    if (e.target.id !== 'p-file' || !e.target.files[0]) return;
    try {
      const blob = await resizeImage(e.target.files[0]);
      await putPhoto({ id: uid(), d: today(), pose: c.querySelector('#p-pose').value, blob });
      toast('Photo ajoutée');
      refresh();
    } catch (err) { toast('Erreur : ' + err.message); }
  });
  c.addEventListener('click', (e) => {
    const fig = e.target.closest('[data-pid]');
    if (fig) {
      const p = photos.find((x) => x.id === fig.dataset.pid);
      const u = URL.createObjectURL(p.blob); photoUrls.push(u);
      openSheet({
        title: `${p.pose} · ${fmtDate(p.d)}`,
        html: `<img class="photo-full" src="${u}" alt=""><div class="sheet-actions"><button class="btn danger ghost wide" data-act="del">${icon('trash')} Supprimer</button></div>`,
        async onAction(act, el, ev, sheet) {
          if (act === 'del' && confirm('Supprimer cette photo ?')) { await deletePhoto(p.id); sheet.close(); refresh(); }
        },
      });
    }
    if (e.target.closest('[data-act="cmp"]')) {
      const a = c.querySelector('#c-a').value, b = c.querySelector('#c-b').value, pose = c.querySelector('#c-pose').value;
      const pa = (byDate[a] || []).find((p) => p.pose === pose), pb = (byDate[b] || []).find((p) => p.pose === pose);
      if (!pa || !pb) return toast(`Pas de photo « ${pose} » à l’une de ces dates`);
      const ua = URL.createObjectURL(pa.blob), ub = URL.createObjectURL(pb.blob);
      photoUrls.push(ua, ub);
      openSheet({ title: `Comparaison · ${pose}`, tall: true, html: `<div class="cmp-view"><figure><img src="${ua}"><figcaption>${fmtDate(a)}</figcaption></figure><figure><img src="${ub}"><figcaption>${fmtDate(b)}</figcaption></figure></div>` });
    }
  });
}
