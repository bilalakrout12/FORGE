// Écran « Profil » (+ accueil au premier lancement) : infos perso, objectifs, programme, sauvegarde.
import { state, save, today, mondayOf, fmt, num, esc, replaceState, resetAll, resetProgram, APP_VERSION } from '../store.js';
import { ACTIVITY, GOALS, targets, currentWeight } from '../calc.js';
import { DAY_NAMES } from '../data/program.js';
import { templatesSorted } from '../workouts.js';
import { refresh, go, toast, icon, header } from '../ui.js';

const tick = icon('check').replace('class="ic"', 'class="ic tick"');

function choiceList(name, items, current) {
  return `<div class="group">${items.map((it) => `<label class="choice">
      <input type="radio" name="${name}" value="${it.v}" ${String(it.v) === String(current) ? 'checked' : ''}>
      <span class="row-main"><span class="row-title">${it.label}</span><span class="row-sub">${it.desc}</span></span>${tick}</label>`).join('')}</div>`;
}

function profileForm(p, onboarding) {
  p = p || { sex: 'h', age: '', height: '', weight: '', activity: 1.725, goal: 'recomp', protPerKg: 2, kcalAdjust: 0, adaptive: true, name: '' };
  return `
    <label class="label" for="p-name">Prénom</label>
    <input class="field" id="p-name" value="${esc(p.name || '')}" placeholder="Facultatif" autocomplete="given-name">
    <p class="label">Sexe</p>
    <div class="seg lg" id="p-sex">
      <button type="button" class="${p.sex !== 'f' ? 'on' : ''}" data-sex="h">Homme</button>
      <button type="button" class="${p.sex === 'f' ? 'on' : ''}" data-sex="f">Femme</button>
    </div>
    <div class="${onboarding ? 'grid3' : 'grid2'}">
      <div><label class="label" for="p-age">Âge</label><div class="suffix"><input class="field" id="p-age" inputmode="numeric" value="${p.age || ''}"><span>ans</span></div></div>
      <div><label class="label" for="p-height">Taille</label><div class="suffix"><input class="field" id="p-height" inputmode="numeric" value="${p.height || ''}"><span>cm</span></div></div>
      ${onboarding ? `<div><label class="label" for="p-weight">Poids</label><div class="suffix"><input class="field" id="p-weight" inputmode="decimal" value="${p.weight || ''}"><span>kg</span></div></div>` : ''}
    </div>
    <p class="label">Activité au quotidien, séances comprises</p>
    ${choiceList('act', ACTIVITY, ACTIVITY.find((a) => Math.abs(a.v - p.activity) < 0.001)?.v ?? 1.55)}
    <p class="label">Objectif</p>
    ${choiceList('goal', Object.entries(GOALS).map(([k, g]) => ({ v: k, label: g.label, desc: g.desc })), p.goal)}
    ${onboarding ? '' : `
      <div class="grid2">
        <div><label class="label" for="p-prot">Protéines par kg</label><select class="field" id="p-prot">${[1.6, 1.8, 2, 2.2, 2.4].map((v) => `<option value="${v}" ${v === p.protPerKg ? 'selected' : ''}>${String(v).replace('.', ',')} g</option>`).join('')}</select></div>
        <div><label class="label" for="p-adj">Ajustement</label><div class="suffix"><input class="field" id="p-adj" inputmode="numeric" value="${p.kcalAdjust || 0}"><span>kcal</span></div></div>
      </div>
      <label class="row" style="margin-top:8px"><span class="row-main"><span class="row-title">Ajustement automatique</span><span class="row-sub">La cible suit ta dépense réelle, mesurée avec tes repas et ton poids</span></span><span class="switch"><input type="checkbox" id="p-adapt" ${p.adaptive ? 'checked' : ''}><span></span></span></label>`}
  `;
}

function readForm(root, onboarding) {
  const v = (id) => root.querySelector(id)?.value;
  const sex = root.querySelector('#p-sex .on')?.dataset.sex || 'h';
  const age = parseInt(v('#p-age'));
  const height = num(v('#p-height'));
  const activity = num(root.querySelector('input[name="act"]:checked')?.value);
  const goal = root.querySelector('input[name="goal"]:checked')?.value || 'recomp';
  if (!(age >= 14 && age <= 90)) { toast('Indique ton âge'); return null; }
  if (!(height >= 130 && height <= 230)) { toast('Indique ta taille en centimètres'); return null; }
  const out = { name: (v('#p-name') || '').trim(), sex, age, height, activity: activity || 1.55, goal };
  if (onboarding) {
    const w = num(v('#p-weight'));
    if (!(w > 30 && w < 300)) { toast('Indique ton poids en kilos'); return null; }
    out.weight = w;
  }
  return out;
}

function bindSex(root) {
  root.querySelector('#p-sex')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sex]');
    if (b) root.querySelectorAll('#p-sex button').forEach((x) => x.classList.toggle('on', x === b));
  });
}

// ---------- Premier lancement ----------
export function renderOnboarding(root) {
  root.innerHTML = `
    <div class="onboard">
      <h1 class="brand">Forge</h1>
      <p class="lead">Ton programme de musculation, tes charges, ce que tu manges et l’évolution de ton corps, au même endroit. Tout reste sur ce téléphone.</p>
      <section class="section">${profileForm(null, true)}</section>
      <div class="actions"><button class="btn primary" data-act="go">Calculer mes besoins</button></div>
      <p class="caption" style="margin-top:12px">Le programme démarre cette semaine : mardi, jeudi et vendredi. Tu pourras changer les jours.</p>
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
  });
}

// ---------- Profil ----------
export function render(root) {
  const p = state.profile;
  const t = targets();
  const o = t.obs;
  const tpls = templatesSorted();
  const gl = GOALS[p.goal];
  const line = (label, value) => `<div class="row"><span class="row-title">${label}</span><span class="row-end">${value}</span></div>`;

  root.innerHTML = header({ title: p.name || 'Profil', sub: `${p.age} ans, ${p.height} cm, ${fmt(currentWeight(), 1)} kg` }) + `
    <section>
      <div class="hero-num"><span class="num">${fmt(t.kcal, 0)}</span><span class="unit">kcal par jour</span></div>
      <p class="hero-sub">${gl.label}, avec ${t.p} g de protéines, ${t.c} g de glucides et ${t.f} g de lipides.</p>
    </section>

    <section class="section">
      <div class="section-hd"><h2>Le calcul</h2></div>
      <div class="rows">
        ${line('Poids de référence', `<span class="num">${fmt(t.kg, 1)}</span> kg`)}
        ${line('Métabolisme de base', `<span class="num">${fmt(t.bmr, 0)}</span> kcal`)}
        ${line(`Dépense estimée, × ${String(p.activity).replace('.', ',')}`, `<span class="num">${fmt(t.tdeeFormula, 0)}</span> kcal`)}
        ${o.ok ? line('Dépense mesurée sur 28 jours', `<span class="num">${fmt(o.tdee, 0)}</span> kcal`) : ''}
        ${o.ok && p.adaptive ? line('Dépense retenue', `<span class="num">${fmt(t.tdee, 0)}</span> kcal`) : ''}
        ${line(gl.label, `<span class="num">${t.delta > 0 ? '+' : t.delta < 0 ? '−' : ''}${Math.abs(t.delta)}</span> kcal`)}
        ${num(p.kcalAdjust) ? line('Ajustement manuel', `<span class="num">${p.kcalAdjust > 0 ? '+' : '−'}${Math.abs(p.kcalAdjust)}</span> kcal`) : ''}
        ${line('Eau conseillée', `<span class="num">${fmt(t.water / 1000, 1)}</span> L`)}
      </div>
      <p class="note" style="margin-top:12px">Métabolisme de base selon Mifflin-St Jeor, multiplié par ton niveau d’activité. ${o.ok
        ? `Ta dépense réelle, déduite de tes ${o.loggedDays} jours de repas et de l’évolution de ton poids (${fmt(o.kgWeek, 2).replace('-', '−')} kg par semaine), est ${p.adaptive ? 'moyennée avec la formule.' : 'affichée pour information.'}${o.outlier ? ' Elle s’écarte beaucoup de la formule : vérifie que tu notes tous tes repas.' : ''}`
        : `L’ajustement automatique démarre après 14 jours de repas notés et 6 pesées sur deux semaines (pour l’instant ${o.loggedDays} jours et ${o.weighIns} pesées).`}</p>
      <p class="note" style="margin-top:8px">Protéines à ${String(p.protPerKg).replace('.', ',')} g par kg${t.bmi > 30 ? ' d’un poids de référence' : ''}, lipides à 0,8 g par kg au minimum, glucides pour le reste. La cible suit ta moyenne de poids et se met à jour seule.</p>
    </section>

    <section class="section">
      <div class="section-hd"><h2>Mes infos</h2></div>
      ${profileForm(p, false)}
      <div class="actions"><button class="btn primary" data-act="saveP">Enregistrer</button></div>
    </section>

    <section class="section">
      <div class="section-hd"><h2>Programme</h2></div>
      <div class="rows">
        ${tpls.map((tp) => `<div class="row"><span class="row-main"><span class="row-title"><b class="num" style="font-size:20px;margin-right:10px">${esc(tp.code)}</b>${esc(tp.name)}</span></span>
          <select class="field sm select" data-tday="${tp.id}" aria-label="Jour de ${esc(tp.name)}">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${d === tp.day ? 'selected' : ''}>${DAY_NAMES[d]}</option>`).join('')}</select></div>`).join('')}
        <div class="row"><span class="row-title">Semaine de décharge</span>
          <select class="field sm select" id="s-deload">${[0, 4, 5, 6, 7, 8, 10].map((v) => `<option value="${v}" ${v === state.settings.deloadEvery ? 'selected' : ''}>${v ? `toutes les ${v} semaines` : 'à la demande'}</option>`).join('')}</select></div>
        <div class="row"><span class="row-title">Début du programme</span><input class="field sm" type="date" id="s-start" value="${state.settings.programStart || today()}"></div>
      </div>
      <div class="link-row" style="margin-top:12px"><button class="link" data-act="resetProg">Revenir au programme d’origine</button></div>
    </section>

    <section class="section">
      <div class="section-hd"><h2>Séance</h2></div>
      <div class="rows">
        <label class="row"><span class="row-main"><span class="row-title">Bip à la fin du repos</span><span class="row-sub">Muet si l’iPhone est en mode silencieux</span></span><span class="switch"><input type="checkbox" id="s-sound" ${state.settings.sound ? 'checked' : ''}><span></span></span></label>
        <label class="row"><span class="row-main"><span class="row-title">Écran toujours allumé</span><span class="row-sub">Pendant une séance</span></span><span class="switch"><input type="checkbox" id="s-wake" ${state.settings.wakeLock ? 'checked' : ''}><span></span></span></label>
        <div class="row"><span class="row-title">Barre olympique</span><select class="field sm select" id="s-bar">${[20, 15, 10].map((v) => `<option value="${v}" ${v === state.settings.barKg ? 'selected' : ''}>${v} kg</option>`).join('')}</select></div>
      </div>
    </section>

    <section class="section">
      <div class="section-hd"><h2>Données</h2></div>
      <p class="note">Tout est enregistré sur ce téléphone et nulle part ailleurs. Si tu retires Forge de l’écran d’accueil, les données sont effacées : exporte une sauvegarde de temps en temps. Les photos n’en font pas partie.</p>
      <div class="actions"><button class="btn" data-act="export">Exporter</button><label class="btn">Importer<input type="file" accept="application/json,.json" id="imp" hidden></label></div>
      <div class="link-row" style="margin-top:16px"><button class="link danger" data-act="wipe">Tout effacer</button></div>
    </section>
    <p class="caption" style="margin-top:34px">Forge ${APP_VERSION}. Produits : Open Food Facts, licence ODbL.</p>`;

  bindSex(root);

  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.tday) { state.templates[el.dataset.tday].day = +el.value; save(); toast(`${state.templates[el.dataset.tday].name} : le ${DAY_NAMES[+el.value].toLowerCase()}`); }
    else if (el.id === 's-deload') { state.settings.deloadEvery = +el.value; save(); }
    else if (el.id === 's-start' && el.value) { state.settings.programStart = el.value; save(); }
    else if (el.id === 's-sound') { state.settings.sound = el.checked; save(); }
    else if (el.id === 's-wake') { state.settings.wakeLock = el.checked; save(); }
    else if (el.id === 's-bar') { state.settings.barKg = +el.value; save(); }
    else if (el.id === 'imp' && el.files[0]) importFile(el.files[0]);
  });

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act;
    if (a === 'saveP') {
      const np = readForm(root, false);
      if (!np) return;
      Object.assign(state.profile, np, {
        protPerKg: num(root.querySelector('#p-prot').value) || 2,
        kcalAdjust: parseInt(root.querySelector('#p-adj').value) || 0,
        adaptive: root.querySelector('#p-adapt').checked,
      });
      save(); refresh(); toast('Infos enregistrées, objectifs recalculés');
    } else if (a === 'resetProg') {
      if (confirm('Revenir aux exercices, séries et jours d’origine ? Ton historique est conservé.')) { resetProgram(); refresh(); toast('Programme d’origine rétabli'); }
    } else if (a === 'export') exportData();
    else if (a === 'wipe') {
      if (confirm('Effacer toutes les données : séances, repas, poids, mesures ?') && confirm('C’est définitif. Tout effacer ?')) { resetAll(); go('#/week'); location.reload(); }
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
      go('#/week');
      location.reload();
    } catch (e) {
      toast('Ce fichier n’est pas une sauvegarde Forge');
    }
  };
  r.readAsText(f);
}
