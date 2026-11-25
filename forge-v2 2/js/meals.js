// Idées de repas végétariens adaptées aux calories restantes, recettes, et plats personnels.
import { state, save, uid, today, addDays, fmt, num, esc, norm } from './store.js';
import { RECIPES, INGREDIENTS } from './data/recipes.js';
import { dayTotals, targets } from './calc.js';
import { openSheet, refresh, toast, icon } from './ui.js';
import { addFlow } from './views/nutrition.js';

const ORDER = ['pdj', 'dej', 'col', 'din'];
const WEIGHT = { pdj: 0.25, dej: 0.35, col: 0.12, din: 0.28 };
const LABEL = { pdj: 'petit-déjeuner', dej: 'déjeuner', col: 'collation', din: 'dîner' };
const SEG = [['pdj', 'Matin'], ['dej', 'Midi'], ['col', 'Collation'], ['din', 'Soir']];

const plural = (n, one, many) => (n > 1 ? many : one);
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const portionsLabel = (f) => `${fmt(f, 2)} ${plural(f, 'portion', 'portions')}`;

// ---------- Budget du repas ----------
export function nextMeal(date) {
  const log = state.foodLog[date] || [];
  const has = (m) => log.some((e) => e.meal === m);
  if (date !== today()) return ORDER.find((m) => !has(m)) || 'col';
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  let i = ORDER.indexOf(h < 10.5 ? 'pdj' : h < 15 ? 'dej' : h < 18.5 ? 'col' : 'din');
  while (i < ORDER.length - 1 && has(ORDER[i])) i++;
  return ORDER[i];
}

// Part des calories et protéines restantes à consacrer à ce repas,
// selon les repas de la journée qui ne sont pas encore notés.
export function mealBudget(date, meal) {
  const tg = targets();
  const tot = dayTotals(date);
  const left = tg.kcal - tot.kcal;
  const leftP = Math.max(0, tg.p - tot.p);
  const log = state.foodLog[date] || [];
  const rest = ORDER.slice(ORDER.indexOf(meal)).filter((m) => m === meal || !log.some((e) => e.meal === m));
  const share = WEIGHT[meal] / rest.reduce((s, m) => s + WEIGHT[m], 0);
  // un repas ne dépasse pas une part raisonnable de la journée, même si un repas a été sauté
  const cap = { pdj: 0.35, dej: 0.42, col: 0.2, din: 0.45 }[meal] * tg.kcal;
  const kcal = Math.min(Math.max(0, left * share), cap);
  return { kcal, p: leftP * share * (left * share > 0 ? kcal / (left * share) : 1), left, leftP };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h % 1000) / 1000;
}
function recentRecipes(date) {
  const ids = new Set();
  for (let i = 0; i <= 4; i++) for (const e of state.foodLog[addDays(date, -i)] || []) if (e.kind === 'recipe') ids.add(e.ref);
  return ids;
}

// Score d'une recette (plus bas = meilleur) et portion adaptée
function rate(r, budget, meal, date, recent) {
  const T = budget.kcal;
  const f = Math.min(1.75, Math.max(0.5, Math.round((T / r.kcal) * 4) / 4));
  const kcal = r.kcal * f;
  const fit = Math.abs(kcal - T) / Math.max(T, 250);
  const need = T > 0 ? Math.min(0.45, (budget.p * 4) / T) : 0.25;
  const dens = (r.p * 4) / r.kcal;
  const score = fit
    + Math.max(0, need - dens) * 3            // manque de protéines par rapport au besoin restant
    + Math.abs(f - 1) * 0.25                  // on préfère une portion proche de la normale
    + (r.meals.includes(meal) ? 0 : 1.5)
    + (recent.has(r.id) ? 0.6 : 0)            // déjà mangé ces derniers jours
    + (r.treat ? 0.3 : 0)
    + hash(r.id + date) * 0.25;               // les idées changent d'un jour à l'autre
  return { r, f, kcal, p: r.p * f, score };
}

export function suggestions(date, meal, n = 3) {
  let budget = mealBudget(date, meal);
  let m = meal;
  let full = false;
  if (budget.kcal < 120) { full = true; m = 'col'; budget = { ...budget, kcal: 160, p: 15 }; }
  const recent = recentRecipes(date);
  const list = RECIPES.filter((r) => r.meals.includes(m)).map((r) => rate(r, budget, m, date, recent))
    .filter((x) => !full || x.kcal <= 220)
    .sort((a, b) => a.score - b.score);
  return { list: list.slice(0, n), budget, meal: m, full };
}

// ---------- Section de l'écran Nutrition ----------
export function suggestionsHTML(date) {
  const meal = nextMeal(date);
  const s = suggestions(date, meal);
  const intro = s.full
    ? `Ta cible du jour est atteinte. Si tu as encore faim, voici des collations légères et protéinées.`
    : `Il te reste ${fmt(Math.max(0, s.budget.left), 0)} kcal et ${fmt(s.budget.leftP, 0)} g de protéines aujourd’hui. Portions calculées pour environ ${fmt(s.budget.kcal, 0)} kcal.`;
  return `<section class="section">
    <div class="section-hd"><h2>Idées pour le ${s.full ? 'creux' : LABEL[meal]}</h2><button class="link" data-act="recipes" data-meal="${s.meal}">Tout voir</button></div>
    <p class="note">${intro}</p>
    <div class="rows" style="margin-top:10px">${s.list.map((x) => recipeRow(x)).join('')}</div>
    <div class="link-row" style="margin-top:10px"><button class="link" data-act="dishes">Mes plats${state.dishes.length ? ` (${state.dishes.length})` : ''}</button></div>
  </section>`;
}

function recipeRow(x) {
  return `<button class="food" data-act="recipe" data-id="${x.r.id}" data-f="${x.f}">
    <span class="food-main"><span class="food-name">${esc(x.r.name)}</span>
      <span class="food-meta">${x.r.time} min, ${portionsLabel(x.f)}, ${fmt(x.p, 0)} g de protéines</span></span>
    <span class="food-kcal">${fmt(x.kcal, 0)}<small>kcal</small></span></button>`;
}

// ---------- Quantités lisibles ----------
function qtyLabel(key, g) {
  const d = INGREDIENTS[key];
  const o = d[6] || {};
  if (o.u) {
    const n = Math.max(0.5, Math.round((g / o.u[2]) * 2) / 2);
    return `${fmt(n, 1)} ${plural(n, o.u[0], o.u[1])}`;
  }
  if (o.sp && g <= o.sp * 3) {
    const tbsp = Math.round((g / o.sp) * 2) / 2;
    if (tbsp >= 1) return `${fmt(tbsp, 1)} c. à soupe`;
    const tsp = Math.max(1, Math.round((g / (o.sp / 3)) * 2) / 2);
    return `${fmt(tsp, 1)} c. à café`;
  }
  const r = g >= 30 ? Math.round(g / 5) * 5 : Math.round(g);
  return `${fmt(r, 0)} ${o.ml ? 'ml' : 'g'}`;
}

function macrosBlock(m, f) {
  return `<div class="qty-macros">
    <div><span class="num">${fmt(m.kcal * f, 0)}</span><span>kcal</span></div>
    <div><span class="num">${fmt(m.p * f, 0)}</span><span>protéines</span></div>
    <div><span class="num">${fmt(m.c * f, 0)}</span><span>glucides</span></div>
    <div><span class="num">${fmt(m.f * f, 0)}</span><span>lipides</span></div></div>`;
}
const stepper = (f) => `<div class="row" style="border-bottom:0"><span class="row-title">Portions</span>
  <span class="stepper"><button data-act="pminus" aria-label="Moins">${icon('minus')}</button><span class="num" style="font-size:24px;min-width:54px;text-align:center" id="pval">${fmt(f, 2)}</span><button data-act="pplus" aria-label="Plus">${icon('plus')}</button></span></div>`;
const mealSeg = (meal) => `<p class="label">Repas</p><div class="seg" id="meal-seg">${SEG.map(([m, l]) => `<button class="${m === meal ? 'on' : ''}" data-act="meal" data-v="${m}">${l}</button>`).join('')}</div>`;

function logPortion(date, meal, src, portions) {
  const per = { kcal: src.kcal, p: src.p, c: src.c, f: src.f, fib: src.fib || 0 };
  (state.foodLog[date] ||= []).push({
    id: uid(), meal, quick: true, kind: src.kind, ref: src.id, name: src.name, portions, per,
    kcal: per.kcal * portions, p: per.p * portions, c: per.c * portions, f: per.f * portions, fib: per.fib * portions,
  });
  save();
}

// ---------- Fiche recette ----------
export function openRecipe(id, date, meal, startF = 1) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  let f = startF, m = r.meals.includes(meal) ? meal : r.meals[0];
  const budget = mealBudget(date, m);
  const sheet = openSheet({ title: r.name, tall: true, html: '', onAction: act });
  function body() {
    sheet.setBody(`
      <p class="muted">${r.time} min, végétarien${r.batch ? ', se garde 3 jours au frais' : ''}${r.treat ? ', plat plaisir' : ''}</p>
      ${stepper(f)}
      <div id="mac">${macrosBlock(r, f)}</div>
      <p class="caption" style="margin-top:8px">${startF !== 1 || budget.kcal ? `Il te reste environ ${fmt(budget.kcal, 0)} kcal pour ce repas.` : ''} Une portion : ${fmt(r.kcal, 0)} kcal, ${fmt(r.p, 0)} g de protéines.</p>
      <div class="section"><div class="section-hd"><h2>Ingrédients</h2><span class="caption" id="for">pour ${portionsLabel(f)}</span></div>
        <div class="rows" id="ing">${ingRows()}</div>
        ${r.season ? `<p class="note" style="margin-top:10px">Assaisonnement : ${esc(r.season)}.</p>` : ''}</div>
      <div class="section"><div class="section-hd"><h2>Préparation</h2></div>
        <ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      ${mealSeg(m)}
      <div class="actions"><button class="btn primary" data-act="log">Ajouter au journal</button></div>
      <div class="link-row" style="margin-top:14px"><button class="link" data-act="copy">Copier dans mes plats pour l’adapter</button></div>`);
  }
  function ingRows() {
    return r.ing.map(([k, g]) => `<div class="row"><span class="row-title">${esc(cap1(INGREDIENTS[k][0]))}</span><span class="row-end">${qtyLabel(k, g * f)}</span></div>`).join('');
  }
  function update() {
    const b = sheet.body;
    b.querySelector('#pval').textContent = fmt(f, 2);
    b.querySelector('#mac').innerHTML = macrosBlock(r, f);
    b.querySelector('#ing').innerHTML = ingRows();
    b.querySelector('#for').textContent = `pour ${portionsLabel(f)}`;
  }
  function act(a, el) {
    if (a === 'pminus') { f = Math.max(0.25, f - 0.25); update(); }
    else if (a === 'pplus') { f = Math.min(6, f + 0.25); update(); }
    else if (a === 'meal') { m = el.dataset.v; sheet.body.querySelectorAll('#meal-seg button').forEach((x) => x.classList.toggle('on', x === el)); }
    else if (a === 'log') {
      logPortion(date, m, { kind: 'recipe', id: r.id, name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib }, f);
      sheet.close(); refresh();
      toast(`Ajouté au ${LABEL[m]} : ${r.name}`);
    } else if (a === 'copy') {
      const items = r.ing.map(([k, g]) => {
        const d = INGREDIENTS[k];
        return { food: { key: 'i:' + k, name: cap1(d[0]), kcal: d[1], p: d[2], c: d[3], f: d[4], fib: d[5] }, g };
      });
      sheet.close();
      openDishEditor({ name: r.name, servings: 1, items, steps: r.steps.join('\n') + (r.season ? `\nAssaisonnement : ${r.season}.` : '') }, date, true);
    }
  }
  body();
}

// ---------- Toutes les recettes ----------
export function openCatalogue(date, meal, startTab = 'recipes') {
  let tab = startTab, m = meal, q = '', fast = false, prot = false, batch = false;
  const sheet = openSheet({ title: 'Recettes', tall: true, html: '', onAction: act, onInput: inp });
  function listHTML() {
    if (tab === 'dishes') return dishesListHTML();
    const budget = mealBudget(date, m);
    const recent = recentRecipes(date);
    const toks = norm(q).split(/\s+/).filter(Boolean);
    const items = RECIPES
      .filter((r) => toks.length || r.meals.includes(m))   // une recherche porte sur toutes les recettes
      .filter((r) => !fast || r.time <= 15)
      .filter((r) => !prot || (r.p * 4) / r.kcal >= 0.25)
      .filter((r) => !batch || r.batch)
      .filter((r) => toks.every((t) => norm(r.name + ' ' + r.ing.map(([k]) => INGREDIENTS[k][0]).join(' ')).includes(t)))
      .map((r) => rate(r, budget.kcal < 120 ? { ...budget, kcal: 300 } : budget, m, date, recent))
      .sort((a, b) => a.score - b.score);
    return items.length ? items.map(recipeRow).join('') : '<p class="meal-empty">Aucune recette ne correspond.</p>';
  }
  function body() {
    sheet.setBody(`
      <div class="seg lg"><button class="${tab === 'recipes' ? 'on' : ''}" data-act="tab" data-v="recipes">Recettes</button><button class="${tab === 'dishes' ? 'on' : ''}" data-act="tab" data-v="dishes">Mes plats</button></div>
      ${tab === 'recipes' ? `
        <div class="search" style="margin-top:12px"><div class="suffix"><span class="search-ic">${icon('search')}</span><input class="field" id="rq" type="search" placeholder="Lentilles, tofu, feta…" value="${esc(q)}" aria-label="Rechercher une recette"></div></div>
        <div class="seg" style="margin-top:10px" id="mseg">${SEG.map(([k, l]) => `<button class="${k === m ? 'on' : ''}" data-act="m" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="chips">
          <button class="chip ${fast ? 'on' : ''}" data-act="fast">15 min ou moins</button>
          <button class="chip ${prot ? 'on' : ''}" data-act="prot">Riches en protéines</button>
          <button class="chip ${batch ? 'on' : ''}" data-act="batch">À préparer à l’avance</button>
        </div>
        <p class="caption" style="margin-top:10px">Classées selon ce qu’il te reste aujourd’hui. Portions ajustées en conséquence.</p>` : `
        <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="newdish">${icon('plus')}Créer un plat</button></div>`}
      <div id="rlist" style="margin-top:6px">${listHTML()}</div>`);
  }
  function act(a, el) {
    if (a === 'tab') { tab = el.dataset.v; body(); }
    else if (a === 'm') { m = el.dataset.v; body(); }
    else if (a === 'fast') { fast = !fast; body(); }
    else if (a === 'prot') { prot = !prot; body(); }
    else if (a === 'batch') { batch = !batch; body(); }
    else if (a === 'recipe') { sheet.close(); openRecipe(el.dataset.id, date, m, +el.dataset.f); }
    else if (a === 'dish') { sheet.close(); openDishView(el.dataset.id, date, m); }
    else if (a === 'newdish') { sheet.close(); openDishEditor(null, date); }
  }
  let t;
  function inp(target) {
    if (target.id !== 'rq') return;
    q = target.value;
    clearTimeout(t);
    t = setTimeout(() => { sheet.body.querySelector('#rlist').innerHTML = listHTML(); }, 120);
  }
  body();
}

// ---------- Mes plats ----------
export function dishMacros(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const it of d.items) {
    const k = (num(it.g) || 0) / 100;
    t.kcal += it.food.kcal * k; t.p += it.food.p * k; t.c += it.food.c * k; t.f += it.food.f * k; t.fib += (it.food.fib || 0) * k;
  }
  const s = Math.max(1, num(d.servings) || 1);
  for (const k in t) t[k] /= s;
  return t;
}

export function dishesListHTML() {
  if (!state.dishes.length) return '<p class="meal-empty">Enregistre les plats que tu prépares souvent : tu les ajouteras ensuite en un geste, avec leurs valeurs calculées.</p>';
  return state.dishes.map((d) => {
    const m = dishMacros(d);
    return `<button class="food" data-act="dish" data-id="${d.id}">
      <span class="food-main"><span class="food-name">${esc(d.name)}</span><span class="food-meta">${d.items.length} ingrédient${d.items.length > 1 ? 's' : ''}, ${fmt(m.p, 0)} g de protéines par portion</span></span>
      <span class="food-kcal">${fmt(m.kcal, 0)}<small>kcal</small></span></button>`;
  }).join('');
}

export function openDishView(id, date, meal) {
  const d = state.dishes.find((x) => x.id === id);
  if (!d) return;
  const per = dishMacros(d);
  let f = 1, m = meal;
  const sheet = openSheet({ title: d.name, tall: true, html: '', onAction: act });
  const ing = () => d.items.map((it) => `<div class="row"><span class="row-title">${esc(it.food.name)}</span><span class="row-end">${fmt(Math.round((num(it.g) * f) / Math.max(1, d.servings)), 0)} g</span></div>`).join('');
  sheet.setBody(`
    <p class="muted">Ton plat, ${d.servings > 1 ? `recette pour ${d.servings} portions` : 'une portion'}.</p>
    ${stepper(f)}
    <div id="mac">${macrosBlock(per, f)}</div>
    <div class="section"><div class="section-hd"><h2>Ingrédients</h2><span class="caption" id="for">pour ${portionsLabel(f)}</span></div><div class="rows" id="ing">${ing()}</div></div>
    ${d.steps ? `<div class="section"><div class="section-hd"><h2>Préparation</h2></div><ol class="steps">${d.steps.split('\n').filter((s) => s.trim()).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${mealSeg(m)}
    <div class="actions"><button class="btn" data-act="edit">Modifier</button><button class="btn primary" data-act="log">Ajouter au journal</button></div>`);
  function act(a, el) {
    const b = sheet.body;
    if (a === 'pminus' || a === 'pplus') {
      f = a === 'pminus' ? Math.max(0.25, f - 0.25) : Math.min(8, f + 0.25);
      b.querySelector('#pval').textContent = fmt(f, 2);
      b.querySelector('#mac').innerHTML = macrosBlock(per, f);
      b.querySelector('#ing').innerHTML = ing();
      b.querySelector('#for').textContent = `pour ${portionsLabel(f)}`;
    } else if (a === 'meal') { m = el.dataset.v; b.querySelectorAll('#meal-seg button').forEach((x) => x.classList.toggle('on', x === el)); }
    else if (a === 'log') {
      logPortion(date, m, { kind: 'dish', id: d.id, name: d.name, ...per }, f);
      sheet.close(); refresh();
      toast(`Ajouté au ${LABEL[m]} : ${d.name}`);
    } else if (a === 'edit') { sheet.close(); openDishEditor(d, date); }
  }
}

// Création ou modification d'un plat. `src` : plat existant ou brouillon.
export function openDishEditor(src, date, isDraft = false) {
  const existing = src && !isDraft && src.id ? src : null;
  const draft = JSON.parse(JSON.stringify(src || { name: '', servings: 1, items: [], steps: '' }));
  const sheet = openSheet({ title: existing ? 'Modifier le plat' : 'Nouveau plat', tall: true, html: '', onAction: act, onInput: inp });
  function totals() {
    const m = dishMacros(draft);
    return `<div class="qty-macros">
      <div><span class="num">${fmt(m.kcal, 0)}</span><span>kcal</span></div><div><span class="num">${fmt(m.p, 0)}</span><span>protéines</span></div>
      <div><span class="num">${fmt(m.c, 0)}</span><span>glucides</span></div><div><span class="num">${fmt(m.f, 0)}</span><span>lipides</span></div></div>
      <p class="caption" style="margin-top:6px">Par portion${draft.servings > 1 ? `, sur ${draft.servings} portions` : ''}.</p>`;
  }
  function body() {
    sheet.setBody(`
      <label class="label" for="d-name" style="margin-top:0">Nom</label>
      <input class="field" id="d-name" value="${esc(draft.name)}" placeholder="Bowl lentilles du lundi">
      <div class="row" style="border-bottom:0;margin-top:6px"><span class="row-main"><span class="row-title">Nombre de portions</span><span class="row-sub">Les quantités ci-dessous sont pour toute la recette</span></span>
        <span class="stepper"><button data-act="sminus" aria-label="Moins">${icon('minus')}</button><span class="num" style="font-size:24px;min-width:36px;text-align:center">${draft.servings}</span><button data-act="splus" aria-label="Plus">${icon('plus')}</button></span></div>
      <div class="section" style="margin-top:18px"><div class="section-hd"><h2>Ingrédients</h2></div>
        <div>${draft.items.map((it, i) => `<div class="measure-row" style="grid-template-columns:1fr 96px 34px">
            <label for="g-${i}">${esc(it.food.name)}</label>
            <div class="suffix"><input class="field" id="g-${i}" data-i="${i}" inputmode="decimal" value="${String(it.g).replace('.', ',')}" style="padding-right:30px"><span>g</span></div>
            <button class="icon-btn sm faint" data-act="rm" data-i="${i}" aria-label="Retirer ${esc(it.food.name)}">${icon('trash')}</button></div>`).join('') || '<p class="meal-empty">Aucun ingrédient pour l’instant.</p>'}</div>
        <div class="link-row" style="margin-top:10px"><button class="link" data-act="add">${icon('plus').replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-5px;width:18px;height:18px"')} Ajouter un ingrédient</button></div>
      </div>
      <div id="tot" style="margin-top:6px">${totals()}</div>
      <label class="label" for="d-steps">Préparation (facultatif, une étape par ligne)</label>
      <textarea class="field" id="d-steps" rows="4">${esc(draft.steps || '')}</textarea>
      <div class="actions">
        ${existing ? `<button class="btn square danger" data-act="del" aria-label="Supprimer le plat">${icon('trash')}</button>` : ''}
        <button class="btn primary" data-act="save">Enregistrer le plat</button></div>`);
  }
  function inp(t) {
    if (t.id === 'd-name') draft.name = t.value;
    else if (t.id === 'd-steps') draft.steps = t.value;
    else if (t.dataset.i !== undefined && t.id?.startsWith('g-')) {
      draft.items[+t.dataset.i].g = num(t.value) || 0;
      sheet.body.querySelector('#tot').innerHTML = totals();
    }
  }
  function act(a, el) {
    if (a === 'sminus') { draft.servings = Math.max(1, draft.servings - 1); body(); }
    else if (a === 'splus') { draft.servings = Math.min(20, draft.servings + 1); body(); }
    else if (a === 'rm') { draft.items.splice(+el.dataset.i, 1); body(); }
    else if (a === 'add') {
      addFlow(null, date, false, { onPick: ({ food, g }) => { draft.items.push({ food, g }); body(); } });
    } else if (a === 'del') {
      if (!confirm(`Supprimer le plat « ${existing.name} » ?`)) return;
      state.dishes = state.dishes.filter((x) => x !== existing);
      save(); sheet.close(); refresh(); toast('Plat supprimé');
    } else if (a === 'save') {
      if (!draft.name.trim()) return toast('Donne un nom au plat');
      if (!draft.items.length) return toast('Ajoute au moins un ingrédient');
      const clean = { name: draft.name.trim(), servings: draft.servings, items: draft.items.filter((it) => num(it.g) > 0), steps: (draft.steps || '').trim() };
      if (existing) Object.assign(existing, clean);
      else state.dishes.unshift({ id: uid(), created: today(), ...clean });
      save(); sheet.close(); refresh();
      toast(existing ? 'Plat modifié' : `Enregistré dans tes plats : ${clean.name}`);
    }
  }
  body();
}

// Transforme les aliments notés pour un repas en plat réutilisable
export function saveMealAsDish(date, meal) {
  const items = (state.foodLog[date] || []).filter((e) => e.meal === meal && !e.quick).map((e) => ({ food: { ...e.food }, g: e.g }));
  openDishEditor({ name: '', servings: 1, items, steps: '' }, date, true);
}

// Modifier une portion de recette ou de plat déjà notée
export function editPortionEntry(date, e) {
  let f = e.portions || 1, m = e.meal;
  const per = e.per || { kcal: e.kcal, p: e.p, c: e.c, f: e.f, fib: e.fib || 0 };
  const sheet = openSheet({
    title: e.name,
    html: `${stepper(f)}<div id="mac">${macrosBlock(per, f)}</div>${mealSeg(m)}
      <div class="actions"><button class="btn square danger" data-act="del" aria-label="Supprimer">${icon('trash')}</button><button class="btn primary" data-act="save">Enregistrer</button></div>
      ${e.kind === 'recipe' ? '<div class="link-row" style="margin-top:14px"><button class="link" data-act="open">Voir la recette</button></div>' : ''}`,
    onAction(a, el) {
      const b = sheet.body;
      if (a === 'pminus' || a === 'pplus') {
        f = a === 'pminus' ? Math.max(0.25, f - 0.25) : Math.min(8, f + 0.25);
        b.querySelector('#pval').textContent = fmt(f, 2);
        b.querySelector('#mac').innerHTML = macrosBlock(per, f);
      } else if (a === 'meal') { m = el.dataset.v; b.querySelectorAll('#meal-seg button').forEach((x) => x.classList.toggle('on', x === el)); }
      else if (a === 'save') {
        Object.assign(e, { portions: f, meal: m, per, kcal: per.kcal * f, p: per.p * f, c: per.c * f, f: per.f * f, fib: per.fib * f });
        save(); sheet.close(); refresh();
      } else if (a === 'del') {
        state.foodLog[date] = state.foodLog[date].filter((x) => x !== e);
        save(); sheet.close(); refresh();
        toast(`Supprimé : ${e.name}`, { action: 'Annuler', onAction: () => { (state.foodLog[date] ||= []).push(e); save(); refresh(); } });
      } else if (a === 'open') { sheet.close(); openRecipe(e.ref, date, e.meal, f); }
    },
  });
}
