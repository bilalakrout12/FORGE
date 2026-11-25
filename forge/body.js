// Écran « Corps » : poids, mensurations, composition corporelle, photos.
import { state, save, uid, today, addDays, fmtDate, fmt, num, esc } from '../store.js';
import { weightTrend, avgWeight, weightRate, currentWeight, GOALS, MEASURES, bodyComposition, latestMeasures } from '../calc.js';
import { lineChart } from '../charts.js';
import { putPhoto, allPhotos, deletePhoto, resizeImage } from '../photos.js';
import { openSheet, refresh, toast, icon, header } from '../ui.js';

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
  root.innerHTML = header({ title: 'Corps' }) + `
    <div class="seg lg">${[['poids', 'Poids'], ['mesures', 'Mensurations'], ['photos', 'Photos']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>
    <div id="body-content"></div>`;
  const c = root.querySelector('#body-content');
  if (tab === 'poids') renderWeight(c);
  else if (tab === 'mesures') renderMeasures(c);
  else renderPhotos(c);
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act="tab"]');
    if (t) { tab = t.dataset.v; refresh(); }
  });
}

const signed = (v, d = 1) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), d)}`;

// ---------------- Poids ----------------
function verdict(rate) {
  const g = GOALS[state.profile.goal];
  const [lo, hi] = g.rate;
  const p = rate.pctWeek;
  let msg;
  if (p < lo) msg = `<span class="neg">Tu perds plus vite que prévu.</span> Au-delà de ${fmt(-lo, 1)} % par semaine, tu risques de perdre du muscle : remonte un peu les calories.`;
  else if (p > hi) msg = state.profile.goal === 'bulk'
    ? `<span class="neg">Tu prends plus vite que prévu</span>, une partie sera du gras.`
    : `Le poids ne baisse pas encore. Vérifie que tu notes tout ce que tu manges : la cible s’ajuste d’elle-même avec tes données.`;
  else msg = `<span class="pos">Rythme dans la cible</span> pour la ${g.label.toLowerCase()}.`;
  if (state.profile.goal === 'recomp') msg += ' En recomposition, le tour de taille et le tour de bras comptent plus que la balance.';
  return `<p class="note" style="margin-top:10px">${msg}</p>`;
}

function renderWeight(c) {
  const t = today();
  const todayW = state.weights.find((w) => w.d === t);
  const a7 = avgWeight(t, 7), a7p = avgWeight(addDays(t, -7), 7), a30p = avgWeight(addDays(t, -30), 7);
  const rate = weightRate(21);
  const tr = weightTrend().filter((w) => w.d >= addDays(t, -range));
  const comp = bodyComposition();
  c.innerHTML = `
    <section style="margin-top:24px">
      <div class="hero-num"><span class="num">${a7 ? fmt(a7, 1) : '–'}</span><span class="unit">kg, moyenne sur 7 jours</span></div>
      <p class="hero-sub">${a7 && a7p ? `${signed(a7 - a7p)} kg en une semaine` : 'L’évolution apparaîtra après une semaine de pesées'}${a7 && a30p ? `, ${signed(a7 - a30p)} kg en un mois` : ''}.</p>
    </section>
    <section class="section">
      <div class="section-hd"><h2>Pesée</h2></div>
      <div style="display:flex;gap:10px">
        <div class="suffix" style="flex:1"><input class="field big" id="w-kg" inputmode="decimal" placeholder="${fmt(currentWeight(), 1)}" value="${todayW ? String(todayW.kg).replace('.', ',') : ''}" aria-label="Poids en kg" style="text-align:left;padding-left:16px"><span>kg</span></div>
        <button class="btn primary" data-act="saveW" style="height:64px">Noter</button>
      </div>
      <div class="row" style="border-bottom:0;padding-bottom:0"><label class="row-title" for="w-date">Date de la pesée</label><input class="field sm" type="date" id="w-date" value="${t}"></div>
      <p class="caption" style="margin-top:8px">Le matin, à jeun. Le poids varie d’un jour à l’autre : seule la moyenne compte.</p>
    </section>
    <section class="section">
      <div class="section-hd"><h2>Évolution</h2></div>
      <div class="seg" style="margin-bottom:6px">${[[30, '1 mois'], [90, '3 mois'], [365, '1 an']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-r="${v}">${l}</button>`).join('')}</div>
      ${lineChart([
        { pts: tr.map((w) => ({ x: w.d, y: w.kg })), color: 'var(--ink-3)', line: false, dots: true, r: 2.2 },
        { pts: tr.map((w) => ({ x: w.d, y: w.avg })), color: 'var(--blue)', width: 2.2 },
      ], { label: 'Pesées et moyenne sur 7 jours', empty: 'Note quelques pesées pour voir la courbe' })}
      <p class="caption">Points : pesées. Ligne : moyenne sur 7 jours.</p>
      ${rate ? `<p style="margin-top:14px">Sur 3 semaines : <b class="num" style="font-size:22px">${signed(rate.kgWeek, 2)}</b> kg par semaine, soit ${signed(rate.pctWeek, 2)} % du poids.</p>${verdict(rate)}` : ''}
    </section>
    ${comp ? compSection(comp) : ''}
    <section class="section">
      <div class="section-hd"><h2>Dernières pesées</h2></div>
      <div class="rows">${[...state.weights].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 14).map((w) => `<div class="row"><span class="row-title">${fmtDate(w.d, { weekday: 'long', day: 'numeric', month: 'short' })}</span><span class="row-end"><span class="num">${fmt(w.kg, 1)}</span> kg <button class="icon-btn sm faint" data-del="${w.d}" aria-label="Supprimer la pesée">${icon('trash')}</button></span></div>`).join('') || '<p class="meal-empty">Aucune pesée.</p>'}</div>
    </section>`;

  c.addEventListener('click', (e) => {
    const r = e.target.closest('[data-r]');
    if (r) { range = +r.dataset.r; refresh(); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const old = state.weights.find((w) => w.d === del.dataset.del);
      state.weights = state.weights.filter((w) => w !== old);
      save(); refresh();
      toast('Pesée supprimée', { action: 'Annuler', onAction: () => { state.weights.push(old); save(); refresh(); } });
      return;
    }
    if (e.target.closest('[data-act="saveW"]')) {
      const d = c.querySelector('#w-date').value || t;
      const kg = num(c.querySelector('#w-kg').value);
      if (!(kg > 25 && kg < 350)) return toast('Indique ton poids en kg');
      state.weights = state.weights.filter((w) => w.d !== d);
      state.weights.push({ d, kg });
      save(); refresh(); toast('Pesée notée');
    }
  });
}

function compSection(comp) {
  return `<section class="section">
    <div class="section-hd"><h2>Composition estimée</h2></div>
    <div class="rows">
      <div class="row"><span class="row-title">Masse grasse</span><span class="row-end"><span class="num">${fmt(comp.bf, 1)}</span> %</span></div>
      <div class="row"><span class="row-title">Masse maigre</span><span class="row-end"><span class="num">${fmt(comp.lean, 1)}</span> kg</span></div>
      <div class="row"><span class="row-title">Gras</span><span class="row-end"><span class="num">${fmt(comp.fatKg, 1)}</span> kg</span></div>
      <div class="row"><span class="row-main"><span class="row-title">Indice de masse maigre</span><span class="row-sub">18 à 20 moyen, 20 à 22 musclé, au-delà très musclé</span></span><span class="row-end"><span class="num">${fmt(comp.ffmi, 1)}</span></span></div>
    </div>
    <p class="caption" style="margin-top:8px">Calculé avec ${comp.src === 'Balance' ? 'la valeur de ta balance' : 'la formule de l’US Navy, à partir du tour de taille et du cou'}. Marge d’erreur de 3 à 4 points : fie-toi à la tendance.</p>
  </section>`;
}

// ---------------- Mensurations ----------------
function renderMeasures(c) {
  const list = [...state.measures].sort((a, b) => (a.d < b.d ? -1 : 1));
  const last = latestMeasures();
  const firstOf = (k) => list.find((m) => m[k] !== undefined && m[k] !== '' && m[k] !== null);
  const meta = MEASURES.find((m) => m.k === selMeasure);
  const pts = list.filter((m) => m[selMeasure] !== undefined && m[selMeasure] !== '').map((m) => ({ x: m.d, y: num(m[selMeasure]) }));
  const comp = bodyComposition();

  let reading = '';
  const fT = firstOf('taille'), fB = firstOf('bras');
  if (fT && fB && last.taille && last.bras && last.taille.d !== fT.d) {
    const dT = num(last.taille.v) - num(fT.taille), dB = num(last.bras.v) - num(fB.bras);
    const good = dT <= 0 && dB >= 0, bad = dT > 0 && dB <= 0;
    reading = `<section class="section"><div class="section-hd"><h2>Ce que ça dit</h2></div>
      <p style="font-size:17px">Depuis le ${fmtDate(fT.d, { day: 'numeric', month: 'long' })} : taille <b>${signed(dT)} cm</b>, bras <b>${signed(dB)} cm</b>.</p>
      <p class="note" style="margin-top:6px">${good ? '<span class="pos">La taille baisse et le bras monte : la recomposition fonctionne.</span>' : bad ? '<span class="neg">La taille monte sans gain au bras.</span> Vérifie les calories et la régularité des séances.' : 'Signaux mitigés. Attends encore quatre semaines avant de conclure.'}</p></section>`;
  }

  c.innerHTML = `
    <section class="section" style="margin-top:24px">
      <div class="section-hd"><h2>Nouvelle mesure</h2><input class="field sm" type="date" id="m-date" value="${today()}" aria-label="Date de la mesure"></div>
      <div>${MEASURES.map((m) => `<div class="measure-row"><label for="m-${m.k}">${esc(m.label)}</label><div class="suffix"><input class="field" id="m-${m.k}" inputmode="decimal" placeholder="${last[m.k] ? String(last[m.k].v).replace('.', ',') : '–'}" style="padding-right:34px"><span>${m.unit || 'cm'}</span></div></div>`).join('')}</div>
      <div class="actions"><button class="btn primary" data-act="saveM">Enregistrer</button></div>
      <details><summary>Comment bien mesurer</summary><p class="note">Mètre ruban souple, le matin, sans serrer, toujours au même endroit. Bras contracté, au plus gros du biceps, toujours le même. Taille au nombril, ventre relâché. Cou juste sous la pomme d’Adam. Hanches au plus large. Une mesure toutes les deux à quatre semaines suffit.</p></details>
    </section>
    ${comp ? compSection(comp) : `<p class="caption" style="margin-top:20px">Note ton tour de taille et ton tour de cou${state.profile.sex === 'f' ? ' et de hanches' : ''} pour estimer ton taux de masse grasse.</p>`}
    ${reading}
    <section class="section">
      <div class="section-hd"><h2>Évolution</h2></div>
      <select class="field" id="m-sel" aria-label="Mesure affichée">${MEASURES.map((m) => `<option value="${m.k}" ${m.k === selMeasure ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
      ${lineChart([{ pts }], { label: meta.label, minPad: 0.3, empty: 'Pas encore de mesure' })}
    </section>
    ${list.length ? `<section class="section">
      <div class="section-hd"><h2>Bilan</h2></div>
      <table class="table"><thead><tr><th>Mesure</th><th>Début</th><th>Actuel</th><th>Écart</th></tr></thead><tbody>
      ${MEASURES.map((m) => {
        const f = firstOf(m.k), l = last[m.k];
        if (!f || !l) return '';
        const d = num(l.v) - num(f[m.k]);
        const shrink = ['taille', 'hanches', 'bf'].includes(m.k);
        const cls = d === 0 ? '' : (d < 0) === shrink ? 'pos' : 'neg';
        return `<tr><td>${esc(m.label)}</td><td>${fmt(num(f[m.k]), 1)}</td><td>${fmt(num(l.v), 1)}</td><td class="${cls}">${signed(d)}</td></tr>`;
      }).join('')}</tbody></table>
    </section>` : ''}`;

  c.addEventListener('change', (e) => { if (e.target.id === 'm-sel') { selMeasure = e.target.value; refresh(); } });
  c.addEventListener('click', (e) => {
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
    save(); refresh(); toast(`${n} mesure${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`);
  });
}

// ---------------- Photos ----------------
async function renderPhotos(c) {
  c.innerHTML = `
    <section style="margin-top:24px">
      <p class="note">Même lumière, même tenue, même distance, le matin. Une série face, profil et dos toutes les quatre semaines. Les photos restent sur ton téléphone.</p>
      <div class="grid2" style="grid-template-columns:1fr auto;margin-top:14px">
        <select class="field" id="p-pose" aria-label="Pose"><option>Face</option><option>Profil</option><option>Dos</option></select>
        <label class="btn primary">${icon('camera')}Ajouter<input type="file" accept="image/*" id="p-file" hidden></label>
      </div>
    </section>
    <div id="p-list"></div>`;
  let photos = [];
  try { photos = await allPhotos(); } catch (e) { c.querySelector('#p-list').innerHTML = '<p class="warn" style="margin-top:20px">Le stockage des photos n’est pas disponible sur cet appareil.</p>'; return; }
  const byDate = {};
  photos.forEach((p) => (byDate[p.d] ||= []).push(p));
  const dates = Object.keys(byDate).sort().reverse();
  c.querySelector('#p-list').innerHTML = dates.length ? `
    ${dates.length > 1 ? `<section class="section"><div class="section-hd"><h2>Comparer</h2></div>
      <div class="grid3">
        <select class="field" id="c-a" aria-label="Première date">${dates.map((d, i) => `<option value="${d}" ${i === dates.length - 1 ? 'selected' : ''}>${fmtDate(d, { day: 'numeric', month: 'short' })}</option>`).join('')}</select>
        <select class="field" id="c-b" aria-label="Seconde date">${dates.map((d) => `<option value="${d}">${fmtDate(d, { day: 'numeric', month: 'short' })}</option>`).join('')}</select>
        <select class="field" id="c-pose" aria-label="Pose"><option>Face</option><option>Profil</option><option>Dos</option></select>
      </div>
      <div class="actions"><button class="btn" data-act="cmp">Comparer</button></div></section>` : ''}
    ${dates.map((d) => `<section class="section"><div class="section-hd"><h2>${fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })}</h2></div><div class="photo-grid">
      ${byDate[d].map((p) => { const u = URL.createObjectURL(p.blob); photoUrls.push(u); return `<figure data-pid="${p.id}"><img src="${u}" alt="${esc(p.pose)}, ${d}"><figcaption>${esc(p.pose)}</figcaption></figure>`; }).join('')}
    </div></section>`).join('')}` : '<p class="caption" style="margin-top:22px">Aucune photo pour l’instant.</p>';

  c.addEventListener('change', async (e) => {
    if (e.target.id !== 'p-file' || !e.target.files[0]) return;
    try {
      const blob = await resizeImage(e.target.files[0]);
      await putPhoto({ id: uid(), d: today(), pose: c.querySelector('#p-pose').value, blob });
      toast('Photo ajoutée');
      refresh();
    } catch (err) { toast('Photo illisible : ' + err.message); }
  });
  c.addEventListener('click', (e) => {
    const fig = e.target.closest('[data-pid]');
    if (fig) {
      const p = photos.find((x) => x.id === fig.dataset.pid);
      const u = URL.createObjectURL(p.blob); photoUrls.push(u);
      openSheet({
        title: `${p.pose}, ${fmtDate(p.d, { day: 'numeric', month: 'long' })}`,
        html: `<img class="photo-full" src="${u}" alt=""><div class="link-row" style="margin-top:14px"><button class="link danger" data-act="del">Supprimer la photo</button></div>`,
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
      openSheet({ title: pose, tall: true, html: `<div class="cmp"><figure><img src="${ua}" alt=""><figcaption>${fmtDate(a, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption></figure><figure><img src="${ub}" alt=""><figcaption>${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption></figure></div>` });
    }
  });
}
