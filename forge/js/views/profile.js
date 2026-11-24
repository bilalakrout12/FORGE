// Écran « Profil » (+ accueil au premier lancement) : données perso, objectifs, programme, sauvegarde.
import { state, save, today, mondayOf, fmt, num, esc, replaceState, resetAll, resetProgram, APP_VERSION } from '../store.js';
import { ACTIVITY, GOALS, targets, currentWeight } from '../calc.js';
import { DAY_NAMES } from '../data/program.js';
import { templatesSorted } from '../workouts.js';
import { refresh, go, toast } from '../ui.js';

function profileForm(p, onboarding) {
  p = p || { sex: 'h', age: '', height: '', weight: '', activity: 1.725, goal: 'recomp', protPerKg: 2, kcalAdjust: 0, adaptive: true, name: '' };
  return `
    <label class="full">Prénom<input class="in" id="p-name" value="${esc(p.name || '')}" placeholder="facultatif"></label>
    <div class="seg big" id="p-sex">
      <button type="button" class="${p.sex !== 'f' ? 'on' : ''}" data-sex="h">Homme</button>
      <button type="button" class="${p.sex === 'f' ? 'on' : ''}" data-sex="f">Femme</button>
    </div>
    <div class="form-grid three">
      <label>Âge<input class="in" id="p-age" inputmode="numeric" value="${p.age || ''}" placeholder="ans"></label>
      <label>Taille<input class="in" id="p-height" inputmode="numeric" value="${p.height || ''}" placeholder="cm"></label>
      ${onboarding ? `<label>Poids<input class="in" id="p-weight" inputmode="decimal" value="${p.weight || ''}" placeholder="kg"></label>` : ''}
    </div>
    <div class="section-label">Niveau d’activité (hors séances comprises)</div>
    ${ACTIVITY.map((a) => `<label class="radio-card"><input type="radio" name="act" value="${a.v}" ${Math.abs(a.v - p.activity) < 0.001 ? 'checked' : ''}><span><b>${a.label}</b><span class="muted small block">${a.desc}</span></span></label>`).join('')}
    <div class="section-label">Objectif</div>
    ${Object.entries(GOALS).map(([k, g]) => `<label class="radio-card"><input type="radio" name="goal" value="${k}" ${p.goal === k ? 'checked' : ''}><span><b>${g.label}</b><span class="muted small block">${g.desc}</span></span></label>`).join('')}
    ${onboarding ? '' : `
      <div class="form-grid">
        <label>Protéines (g/kg)<select class="in" id="p-prot">${[1.6, 1.8, 2, 2.2, 2.4].map((v) => `<option value="${v}" ${v === p.protPerKg ? 'selected' : ''}>${String(v).replace('.', ',')}</option>`).join('')}</select></label>
        <label>Ajustement manuel (kcal)<input class="in" id="p-adj" inputmode="numeric" value="${p.kcalAdjust || 0}"></label>
      </div>
      <label class="check-line"><input type="checkbox" id="p-adapt" ${p.adaptive ? 'checked' : ''}> Ajuster automatiquement la cible selon mon poids réel et ce que je mange</label>`}
  `;
}

function readForm(root, onboarding) {
  const v = (id) => root.querySelector(id)?.value;
  const sex = root.querySelector('#p-sex .on')?.dataset.sex || 'h';
  const age = parseInt(v('#p-age'));
  const height = num(v('#p-height'));
  const activity = num(root.querySelector('input[name="act"]:checked')?.value);
  const goal = root.querySelector('input[name="goal"]:checked')?.value || 'recomp';
  if (!(age >= 14 && age <= 90)) return toast('Âge invalide'), null;
  if (!(height >= 130 && height <= 230)) return toast('Taille invalide (en cm)'), null;
  const out = { name: (v('#p-name') || '').trim(), sex, age, height, activity: activity || 1.55, goal };
  if (onboarding) {
    const w = num(v('#p-weight'));
    if (!(w > 30 && w < 300)) return toast('Poids invalide (en kg)'), null;
    out.weight = w;
  }
  return out;
}

function bindSex(root) {
  root.querySelector('#p-sex')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sex]');
    if (!b) return;
    root.querySelectorAll('#p-sex button').forEach((x) => x.classList.toggle('on', x === b));
  });
}

// ---------- Premier lancement ----------
export function renderOnboarding(root) {
  root.innerHTML = `
    <div class="onboard">
      <div class="logo-big"><img src="icons/icon-192.png" alt=""></div>
      <h1>Bienvenue</h1>
      <p class="muted">Quelques infos pour calculer tes besoins et lancer ton programme (mardi, jeudi, vendredi). Tout reste sur ton téléphone.</p>
      <section class="card">${profileForm(null, true)}</section>
      <button class="btn primary wide" data-act="go">C’est parti</button>
    </div>`;
  bindSex(root);
  root.querySelector('[data-act="go"]').addEventListener('click', () => {
    const p = readForm(root, true);
    if (!p) return;
    state.profile = { ...p, protPerKg: 2, kcalAdjust: 0, adaptive: true };
    state.weights = state.weights.filter((w) => w.d !== today());
    state.weights.push({ d: today(), kg: p.weight });
    state.settings.programStart = mondayOf(today());
    save();
    go('#/week');
    toast('Profil créé : tes objectifs sont prêts');
  });
}

// ---------- Profil ----------
export function render(root) {
  const p = state.profile;
  const t = targets();
  const o = t.obs;
  const tpls = templatesSorted();
  const gl = GOALS[p.goal];
  root.innerHTML = `
    <header class="page-head"><div class="ph-center"><div class="ph-title">${p.name ? esc(p.name) : 'Profil'}</div><div class="ph-sub">${p.age} ans · ${p.height} cm · ${fmt(currentWeight(), 1)} kg</div></div></header>

    <section class="card">
      <h2>Tes objectifs du jour</h2>
      <div class="target-big"><b>${fmt(t.kcal, 0)}</b> kcal</div>
      <div class="stats3">
        <div class="stat"><div class="stat-v" style="color:var(--blue)">${t.p} g</div><div class="stat-l">protéines</div></div>
        <div class="stat"><div class="stat-v" style="color:var(--yellow)">${t.c} g</div><div class="stat-l">glucides</div></div>
        <div class="stat"><div class="stat-v" style="color:var(--accent)">${t.f} g</div><div class="stat-l">lipides</div></div>
      </div>
      <details class="tips" open><summary>Comment c’est calculé</summary>
        <div class="calc-lines small">
          <div>Poids de référence (moyenne 7 j) : <b>${fmt(t.kg, 1)} kg</b></div>
          <div>Métabolisme de base (Mifflin-St Jeor) : <b>${fmt(t.bmr, 0)} kcal</b></div>
          <div>× activité ${String(p.activity).replace('.', ',')} = dépense estimée : <b>${fmt(t.tdeeFormula, 0)} kcal</b></div>
          ${o.ok
            ? `<div>Dépense mesurée sur tes données (28 j : ${o.loggedDays} jours notés, ${fmt(o.kgWeek, 2)} kg/sem) : <b>${fmt(o.tdee, 0)} kcal</b>${o.outlier ? ' (valeur bornée, données peut-être incomplètes)' : ''}</div>
               <div>${p.adaptive ? `Dépense retenue (moyenne des deux) : <b>${fmt(t.tdee, 0)} kcal</b>` : 'Ajustement automatique désactivé : formule seule.'}</div>`
            : `<div class="muted">Ajustement automatique : il faut 14 jours de repas notés et 6 pesées sur 2 semaines (actuellement ${o.loggedDays}/14 jours, ${o.weighIns}/6 pesées).</div>`}
          <div>${gl.label} : <b>${t.delta > 0 ? '+' : ''}${t.delta} kcal</b>${num(p.kcalAdjust) ? ` · ajustement manuel ${p.kcalAdjust > 0 ? '+' : ''}${p.kcalAdjust} kcal` : ''}</div>
          <div>Protéines : ${String(p.protPerKg).replace('.', ',')} g/kg${t.bmi > 30 ? ' (sur un poids de référence, IMC > 30)' : ''} · Lipides : ≥ 0,8 g/kg et ≥ 25 % des kcal · Glucides : le reste</div>
          <div>Eau conseillée : ${fmt(t.water / 1000, 1)} L/jour (35 ml/kg, plus les jours chauds et d’entraînement)</div>
        </div>
        <p class="muted small">La cible suit ton poids : elle se met à jour toute seule quand ta moyenne bouge. Ce sont des estimations : c’est l’évolution réelle du poids et des mensurations qui tranche.</p>
      </details>
    </section>

    <section class="card">
      <h2>Mes infos</h2>
      ${profileForm(p, false)}
      <button class="btn primary wide" data-act="saveP">Enregistrer</button>
    </section>

    <section class="card">
      <h2>Programme</h2>
      ${tpls.map((tp) => `<div class="row-between line"><span><span class="dot" style="--c:${tp.color}"></span><b>${esc(tp.name)}</b></span>
        <select class="in sm" data-tday="${tp.id}">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${d === tp.day ? 'selected' : ''}>${DAY_NAMES[d]}</option>`).join('')}</select></div>`).join('')}
      <div class="row-between line"><span>Semaine de décharge</span>
        <select class="in sm" id="s-deload">${[0, 4, 5, 6, 7, 8, 10].map((v) => `<option value="${v}" ${v === state.settings.deloadEvery ? 'selected' : ''}>${v ? `toutes les ${v} sem.` : 'jamais (manuel)'}</option>`).join('')}</select></div>
      <div class="row-between line"><span>Début du programme</span><input class="in sm" type="date" id="s-start" value="${state.settings.programStart || today()}"></div>
      <button class="btn ghost wide" data-act="resetProg">Restaurer le programme d’origine</button>
    </section>

    <section class="card">
      <h2>Séance</h2>
      <label class="check-line"><input type="checkbox" id="s-sound" ${state.settings.sound ? 'checked' : ''}> Bip à la fin du repos (iPhone : désactive le mode silencieux)</label>
      <label class="check-line"><input type="checkbox" id="s-wake" ${state.settings.wakeLock ? 'checked' : ''}> Garder l’écran allumé pendant la séance</label>
      <div class="row-between line"><span>Poids de la barre</span>
        <select class="in sm" id="s-bar">${[20, 15, 10].map((v) => `<option value="${v}" ${v === state.settings.barKg ? 'selected' : ''}>${v} kg</option>`).join('')}</select></div>
    </section>

    <section class="card">
      <h2>Mes données</h2>
      <p class="muted small">Tout est stocké sur ce téléphone, rien n’est envoyé ailleurs. Exporte une sauvegarde de temps en temps (iCloud Drive, Fichiers) : si tu supprimes l’app de l’écran d’accueil, les données partent avec. Les photos ne sont pas incluses dans la sauvegarde.</p>
      <button class="btn primary wide" data-act="export">Exporter une sauvegarde</button>
      <label class="btn ghost wide">Importer une sauvegarde<input type="file" accept="application/json,.json" id="imp" hidden></label>
      <button class="btn danger ghost wide" data-act="wipe">Tout effacer</button>
    </section>
    <p class="muted small center">Forge ${APP_VERSION} · données produits : Open Food Facts (licence ODbL)</p>`;

  bindSex(root);

  root.addEventListener('change', (e) => {
    const t2 = e.target;
    if (t2.dataset.tday) { state.templates[t2.dataset.tday].day = +t2.value; save(); toast('Jour modifié'); }
    else if (t2.id === 's-deload') { state.settings.deloadEvery = +t2.value; save(); }
    else if (t2.id === 's-start' && t2.value) { state.settings.programStart = t2.value; save(); }
    else if (t2.id === 's-sound') { state.settings.sound = t2.checked; save(); }
    else if (t2.id === 's-wake') { state.settings.wakeLock = t2.checked; save(); }
    else if (t2.id === 's-bar') { state.settings.barKg = +t2.value; save(); }
    else if (t2.id === 'imp' && t2.files[0]) importFile(t2.files[0]);
  });

  root.addEventListener('click', (e) => {
    const t2 = e.target.closest('[data-act]');
    if (!t2) return;
    const a = t2.dataset.act;
    if (a === 'saveP') {
      const np = readForm(root, false);
      if (!np) return;
      Object.assign(state.profile, np, {
        protPerKg: num(root.querySelector('#p-prot').value) || 2,
        kcalAdjust: parseInt(root.querySelector('#p-adj').value) || 0,
        adaptive: root.querySelector('#p-adapt').checked,
      });
      save(); refresh(); toast('Profil enregistré, objectifs recalculés');
    } else if (a === 'resetProg') {
      if (confirm('Remettre les exercices, séries et jours d’origine ? Ton historique est conservé.')) { resetProgram(); refresh(); toast('Programme restauré'); }
    } else if (a === 'export') exportData();
    else if (a === 'wipe') {
      if (confirm('Effacer TOUTES les données (séances, repas, poids) ?') && confirm('Vraiment ? C’est définitif.')) { resetAll(); go('#/week'); location.reload(); }
    }
  });
}

async function exportData() {
  const name = `forge-sauvegarde-${today()}.json`;
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sauvegarde Forge' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importFile(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || typeof data !== 'object' || !('workouts' in data)) throw new Error('format');
      if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
      replaceState(data);
      toast('Sauvegarde importée');
      go('#/week');
      location.reload();
    } catch (e) {
      toast('Fichier invalide');
    }
  };
  r.readAsText(f);
}
