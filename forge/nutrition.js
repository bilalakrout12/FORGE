// Écran « Nutrition » : journal du jour, scan de code-barres, calories et macros.
import { state, save, uid, today, addDays, fmtDate, fmt, num, esc, norm } from '../store.js';
import { FOODS } from '../data/foods.js';
import { dayTotals, entryValues, targets, GOALS } from '../calc.js';
import { fetchProduct, searchOFF } from '../off.js';
import { scanBarcode } from '../scanner.js';
import { openSheet, refresh, toast, icon, header } from '../ui.js';
import { suggestionsHTML, openRecipe, openCatalogue, openDishView, openDishEditor, dishesListHTML, saveMealAsDish, editPortionEntry, nextMeal } from '../meals.js';

let viewDate = null;
export const MEALS = [['pdj', 'Petit-déjeuner'], ['dej', 'Déjeuner'], ['col', 'Collation'], ['din', 'Dîner']];
const mealName = (m) => (MEALS.find((x) => x[0] === m) || [m, m])[1];

function defaultMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h < 10.5 ? 'pdj' : h < 15 ? 'dej' : h < 18.5 ? 'col' : 'din';
}

// ---------- Base d'aliments ----------
function customFoods() { return state.customFoods.map((c) => ({ ...c, key: 'c:' + c.id, src: 'custom' })); }
function localPool() { return [...customFoods(), ...Object.values(state.offCache), ...FOODS]; }
function snapshot(f) {
  return { key: f.key || f.id, name: f.name, brand: f.brand || '', kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0, fib: +f.fib || 0, ns: f.ns || null, portion: f.portion || null, code: f.code || null };
}
function searchLocal(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const seen = new Set();
  const res = [];
  for (const f of localPool()) {
    const k = f.key || f.id;
    if (seen.has(k)) continue;
    const hay = norm(f.name + ' ' + (f.brand || ''));
    if (toks.every((t) => hay.includes(t))) {
      seen.add(k);
      res.push({ f, score: (norm(f.name).startsWith(toks[0]) ? 0 : 1) + (f.src === 'custom' ? -0.5 : 0) + f.name.length / 200 });
    }
  }
  return res.sort((a, b) => a.score - b.score).slice(0, 40).map((r) => r.f);
}
const isFav = (key) => state.favorites.some((f) => f.key === key);
const nsBadge = (ns) => (ns ? `<span class="ns ns-${ns}" title="Nutri-Score ${ns.toUpperCase()}">${ns.toUpperCase()}</span>` : '');

function foodRow(f) {
  const k = f.key || f.id;
  return `<button class="food" data-act="pick" data-key="${esc(k)}">
    <span class="food-main"><span class="food-name">${esc(f.name)}${isFav(k) ? ' <span class="fav" aria-label="favori">★</span>' : ''}</span>
      <span class="food-meta">${f.brand ? esc(f.brand) + ', ' : ''}${fmt(f.p, 1)} g prot., ${fmt(f.c, 1)} g gluc., ${fmt(f.f, 1)} g lip.</span></span>
    ${nsBadge(f.ns)}<span class="food-kcal">${fmt(f.kcal, 0)}<small>kcal</small></span>
  </button>`;
}

// ---------- Page ----------
export function render(root, dateParam) {
  if (dateParam) viewDate = dateParam;
  if (!viewDate) viewDate = today();
  const d = viewDate;
  const t0 = today();
  const tg = targets();
  const tot = dayTotals(d);
  tot.kcal = Math.round(tot.kcal);
  const log = state.foodLog[d] || [];
  const water = state.water[d] || 0;
  const yest = state.foodLog[addDays(d, -1)] || [];
  const left = tg.kcal - tot.kcal;
  const pct = Math.min(100, (tot.kcal / tg.kcal) * 100);

  const dayLabel = d === t0 ? 'Aujourd’hui' : d === addDays(t0, -1) ? 'Hier' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
  let html = header({
    title: 'Nutrition',
    sub: `${dayLabel}${d === t0 ? ', ' + fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}`,
    actions: `<button class="icon-btn" data-act="prev" aria-label="Jour précédent">${icon('prev')}</button><button class="icon-btn" data-act="next" aria-label="Jour suivant">${icon('next')}</button>`,
  });
  if (d !== t0) html += `<div class="link-row" style="margin:-8px 0 14px"><button class="link" data-act="today">Revenir à aujourd’hui</button></div>`;

  const macro = (label, v, t) => `<div><div class="macro-l">${label}</div><div class="macro-v">${fmt(v, 0)}<small> / ${t} g</small></div><div class="macro-t"><i style="width:${Math.min(100, (v / t) * 100)}%"></i></div></div>`;
  html += `<section>
    <div class="hero-num"><span class="num">${fmt(tot.kcal, 0)}</span><span class="unit">sur ${fmt(tg.kcal, 0)} kcal</span></div>
    <div class="kcal-track ${left < 0 ? 'over' : ''}"><i style="width:${pct}%"></i></div>
    <p class="hero-sub">${left >= 0 ? `Il reste ${fmt(left, 0)} kcal.` : `<span class="neg">${fmt(-left, 0)} kcal au-dessus de la cible.</span>`} Objectif ${GOALS[state.profile.goal].label.toLowerCase()}.</p>
    <div class="macros">${macro('Protéines', tot.p, tg.p)}${macro('Glucides', tot.c, tg.c)}${macro('Lipides', tot.f, tg.f)}</div>
    <div class="duo">
      <button class="btn primary" data-act="scan">${icon('scan')}Scanner</button>
      <button class="btn" data-act="add" data-meal="${defaultMeal()}">${icon('search')}Rechercher</button>
    </div>
  </section>`;
  if (d === t0) html += suggestionsHTML(d);

  for (const [m, label] of MEALS) {
    const items = log.filter((e) => e.meal === m);
    const sub = items.reduce((s, e) => s + entryValues(e).kcal, 0);
    const ycount = yest.filter((e) => e.meal === m).length;
    html += `<section class="meal">
      <div class="meal-hd"><h2>${label}${sub ? `<span class="kc">${fmt(sub, 0)} kcal</span>` : ''}</h2>
        <div class="meal-btns">${!items.length && ycount ? `<button class="link" data-act="copy" data-meal="${m}">Comme hier</button>` : ''}${items.filter((e) => !e.quick).length >= 2 ? `<button class="link" data-act="savedish" data-meal="${m}">En faire un plat</button>` : ''}
          <button class="icon-btn sm" data-act="add" data-meal="${m}" aria-label="Ajouter au ${label.toLowerCase()}">${icon('plus')}</button></div></div>
      ${items.length ? `<div>${items.map((e) => {
        const v = entryValues(e);
        return `<button class="food" data-act="edit" data-id="${e.id}">
          <span class="food-main"><span class="food-name">${esc(e.quick ? e.name || 'Ajout rapide' : e.food.name)}</span>
          <span class="food-meta">${e.kind ? `${fmt(e.portions, 2)} portion${e.portions > 1 ? 's' : ''}` : e.quick ? 'Ajout rapide' : `${fmt(e.g, 0)} g`}, ${fmt(v.p, 0)} g de protéines</span></span>
          <span class="food-kcal">${fmt(v.kcal, 0)}<small>kcal</small></span></button>`;
      }).join('')}</div>` : `<p class="meal-empty">Rien de noté.</p>`}
    </section>`;
  }

  html += `<section class="meal">
    <div class="meal-hd" style="border:0"><h2>Eau<span class="kc">${fmt(water / 1000, 2)} sur ${fmt(tg.water / 1000, 1)} L</span></h2>
      <div class="stepper"><button data-act="water" data-v="-250" aria-label="Retirer un verre">${icon('minus')}</button><button data-act="water" data-v="250" aria-label="Ajouter un verre de 25 cl">${icon('plus')}</button></div></div>
    <div class="kcal-track" style="margin-top:4px"><i style="width:${Math.min(100, (water / tg.water) * 100)}%;background:var(--blue)"></i></div>
  </section>`;
  if (!log.length && yest.length) html += `<div class="actions"><button class="btn" data-act="copyday">${icon('copy')}Reprendre toute la journée d’hier</button></div>`;
  html += `<p class="caption" style="margin-top:26px">Les aliments de base sont des valeurs moyennes. Scanne un produit pour ses valeurs exactes.</p>`;
  root.innerHTML = html;

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'prev') { viewDate = addDays(viewDate, -1); refresh(); }
    else if (a === 'next') { viewDate = addDays(viewDate, 1); refresh(); }
    else if (a === 'today') { viewDate = today(); refresh(); }
    else if (a === 'add') addFlow(t.dataset.meal, d);
    else if (a === 'scan') addFlow(defaultMeal(), d, true);
    else if (a === 'edit') editEntry(d, t.dataset.id);
    else if (a === 'recipe') openRecipe(t.dataset.id, d, nextMeal(d), +t.dataset.f);
    else if (a === 'recipes') openCatalogue(d, t.dataset.meal || nextMeal(d));
    else if (a === 'dishes') openCatalogue(d, nextMeal(d), 'dishes');
    else if (a === 'savedish') saveMealAsDish(d, t.dataset.meal);
    else if (a === 'water') { state.water[d] = Math.max(0, (state.water[d] || 0) + +t.dataset.v); save(); refresh(); }
    else if (a === 'copy' || a === 'copyday') {
      const src = yest.filter((x) => a === 'copyday' || x.meal === t.dataset.meal);
      state.foodLog[d] = [...(state.foodLog[d] || []), ...src.map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: uid() }))];
      save(); refresh();
      toast(`${src.length} aliment${src.length > 1 ? 's' : ''} repris d’hier`, { action: 'Annuler', onAction: () => { const ids = new Set(src.map((x) => x.id)); state.foodLog[d] = (state.foodLog[d] || []).slice(0, -src.length); save(); refresh(); } });
    }
  });
}

function pushRecent(food) {
  const s = snapshot(food);
  state.recents = [s, ...state.recents.filter((r) => r.key !== s.key)].slice(0, 40);
}

// ---------- Ajout d'un aliment ----------
export function addFlow(meal, date, scanFirst = false, opts = {}) {
  const picking = !!opts.onPick;
  const ctx = { meal: meal || defaultMeal(), date, q: '', tab: state.recents.length ? 'recent' : 'base', online: null, onlineMsg: '', food: null, grams: 100, entry: null };
  const title = () => (picking ? 'Ajouter un ingrédient' : mealName(ctx.meal));
  const sheet = openSheet({ title: title(), tall: true, html: '', onAction: (a, el) => action(a, el), onInput: (t) => input(t) });

  function resultsHTML() {
    if (ctx.q.trim()) {
      const loc = searchLocal(ctx.q);
      let h = loc.map(foodRow).join('') || '<p class="meal-empty">Rien dans tes aliments ni dans la base.</p>';
      h += `<p class="label">Open Food Facts</p>`;
      if (ctx.online === 'loading') h += '<p class="meal-empty">Recherche…</p>';
      else if (Array.isArray(ctx.online)) h += ctx.online.length ? ctx.online.map(foodRow).join('') : '<p class="meal-empty">Aucun produit trouvé.</p>';
      else h += `<button class="btn wide" data-act="online">${icon('search')}Chercher « ${esc(ctx.q.trim())} » en ligne</button>`;
      if (ctx.onlineMsg) h += `<p class="warn" style="margin-top:10px">${esc(ctx.onlineMsg)}</p>`;
      return h;
    }
    if (ctx.tab === 'dishes') {
      return `<div class="actions" style="margin-top:8px"><button class="btn" data-act="newdish">${icon('plus')}Créer un plat</button></div>${dishesListHTML()}`;
    }
    let list = [];
    if (ctx.tab === 'recent') list = state.recents;
    else if (ctx.tab === 'fav') list = state.favorites;
    else list = FOODS;
    if (!list.length) {
      return `<p class="meal-empty">${{ recent: 'Les aliments que tu ajoutes apparaîtront ici.', fav: 'Touche Favori sur un aliment pour le retrouver ici.' }[ctx.tab] || ''}</p>`;
    }
    if (ctx.tab === 'base') {
      const cats = {};
      if (state.customFoods.length) cats['Mes aliments'] = customFoods();
      list.forEach((f) => (cats[f.cat] ||= []).push(f));
      return Object.entries(cats).map(([c, l]) => `<details class="cat"><summary>${esc(c)}<span>${l.length}</span></summary>${l.map(foodRow).join('')}</details>`).join('');
    }
    return list.map(foodRow).join('');
  }

  function showList() {
    sheet.setTitle(title());
    sheet.setBody(`
      <div class="search">
        <div class="suffix"><span class="search-ic">${icon('search')}</span><input class="field" id="q" type="search" autocomplete="off" placeholder="Skyr, comté, riz…" value="${esc(ctx.q)}" aria-label="Rechercher un aliment"></div>
        <button class="btn square primary" data-act="scan" aria-label="Scanner un code-barres">${icon('scan')}</button>
      </div>
      <div class="seg ${ctx.q ? 'hidden' : ''}" id="tabs" style="margin-top:12px${ctx.q ? ';display:none' : ''}">
        ${[['recent', 'Récents'], ['fav', 'Favoris'], ...(picking ? [] : [['dishes', 'Mes plats']]), ['base', 'Base']].map(([k, l]) => `<button class="${ctx.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}
      </div>
      <div id="results" style="margin-top:6px">${resultsHTML()}</div>
      <div class="link-row" style="margin-top:20px"><button class="link" data-act="create">Créer un aliment</button>${picking ? '' : '<button class="link" data-act="quick">Ajout rapide en kcal</button>'}</div>`);
  }
  function updateResults() {
    const r = sheet.body.querySelector('#results');
    if (r) r.innerHTML = resultsHTML();
    const tabs = sheet.body.querySelector('#tabs');
    if (tabs) tabs.style.display = ctx.q ? 'none' : '';
  }

  function calcHTML() {
    const k = (num(ctx.grams) || 0) / 100, f = ctx.food;
    return `<div class="qty-macros">
      <div><span class="num">${fmt(f.kcal * k, 0)}</span><span>kcal</span></div>
      <div><span class="num">${fmt(f.p * k, 1)}</span><span>protéines</span></div>
      <div><span class="num">${fmt(f.c * k, 1)}</span><span>glucides</span></div>
      <div><span class="num">${fmt(f.f * k, 1)}</span><span>lipides</span></div></div>`;
  }
  function showQty() {
    const f = ctx.food;
    const chips = [];
    if (f.portion) chips.push([f.portion.g, f.portion.label]);
    for (const g of [50, 100, 150, 200]) if (!f.portion || f.portion.g !== g) chips.push([g, `${g} g`]);
    sheet.setTitle(ctx.entry ? 'Modifier' : title());
    sheet.setBody(`
      ${ctx.entry ? '' : `<button class="back-link" data-act="backlist">${icon('back')}Résultats</button>`}
      <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between">
        <div><h3 style="font-size:22px;font-weight:650;line-height:1.2">${esc(f.name)}</h3>
        ${[f.brand, f.qty].filter(Boolean).length ? `<p class="caption" style="margin-top:3px">${esc([f.brand, f.qty].filter(Boolean).join(', '))}</p>` : ''}</div>
        ${nsBadge(f.ns)}</div>
      <p class="per100">Pour 100 g : ${fmt(f.kcal, 0)} kcal, ${fmt(f.p, 1)} g de protéines, ${fmt(f.c, 1)} g de glucides, ${fmt(f.f, 1)} g de lipides${f.fib ? `, ${fmt(f.fib, 1)} g de fibres` : ''}.</p>
      ${f.incomplete ? '<p class="warn" style="margin-top:8px">Valeurs incomplètes sur Open Food Facts : vérifie l’étiquette.</p>' : ''}
      <label class="label" for="g">Quantité</label>
      <div class="suffix"><input class="field big" id="g" inputmode="decimal" value="${esc(String(ctx.grams).replace('.', ','))}"><span>g</span></div>
      <div class="chips">${chips.map(([g, l]) => `<button class="chip" data-act="grams" data-v="${g}">${esc(l)}</button>`).join('')}</div>
      <div id="calc">${calcHTML()}</div>
      ${picking ? '' : `<p class="label">Repas</p>
      <div class="seg" id="meal-seg">${MEALS.map(([m, l]) => `<button class="${m === ctx.meal ? 'on' : ''}" data-act="meal" data-v="${m}">${l === 'Petit-déjeuner' ? 'Matin' : l}</button>`).join('')}</div>`}
      <div class="actions">
        ${ctx.entry ? `<button class="btn square danger" data-act="delentry" aria-label="Supprimer">${icon('trash')}</button>` : ''}
        <button class="btn" data-act="fav">${isFav(f.key) ? 'Retirer des favoris' : 'Favori'}</button>
        <button class="btn primary" data-act="save">${ctx.entry ? 'Enregistrer' : picking ? 'Ajouter au plat' : 'Ajouter'}</button>
      </div>`);
  }

  function showCreate(code = '', msg = '') {
    sheet.setTitle('Nouvel aliment');
    sheet.setBody(`
      <button class="back-link" data-act="backlist">${icon('back')}Retour</button>
      ${msg ? `<p class="warn" style="margin-bottom:6px">${esc(msg)}</p>` : ''}
      <p class="note">Recopie l’étiquette. Toutes les valeurs sont pour 100 g.</p>
      <label class="label" for="c-name">Nom</label><input class="field" id="c-name" placeholder="Skyr vanille">
      <label class="label" for="c-brand">Marque</label><input class="field" id="c-brand" placeholder="Facultatif">
      <div class="grid2">
        <div><label class="label" for="c-kcal">Énergie (kcal)</label><input class="field" id="c-kcal" inputmode="decimal"></div>
        <div><label class="label" for="c-p">Protéines (g)</label><input class="field" id="c-p" inputmode="decimal"></div>
        <div><label class="label" for="c-c">Glucides (g)</label><input class="field" id="c-c" inputmode="decimal"></div>
        <div><label class="label" for="c-f">Lipides (g)</label><input class="field" id="c-f" inputmode="decimal"></div>
        <div><label class="label" for="c-fib">Fibres (g)</label><input class="field" id="c-fib" inputmode="decimal"></div>
        <div><label class="label" for="c-pg">Portion (g)</label><input class="field" id="c-pg" inputmode="decimal" placeholder="Facultatif"></div>
      </div>
      <label class="label" for="c-code">Code-barres</label><input class="field" id="c-code" inputmode="numeric" value="${esc(code)}">
      <div class="actions"><button class="btn primary" data-act="savecreate">Créer l’aliment</button></div>`);
  }
  function showQuick() {
    sheet.setTitle('Ajout rapide');
    sheet.setBody(`
      <button class="back-link" data-act="backlist">${icon('back')}Retour</button>
      <p class="note">Pour un repas dont tu connais seulement l’énergie, au restaurant par exemple.</p>
      <label class="label" for="k-name">Description</label><input class="field" id="k-name" placeholder="Restaurant le midi">
      <div class="grid2">
        <div><label class="label" for="k-kcal">Énergie (kcal)</label><input class="field" id="k-kcal" inputmode="decimal"></div>
        <div><label class="label" for="k-p">Protéines (g)</label><input class="field" id="k-p" inputmode="decimal"></div>
        <div><label class="label" for="k-c">Glucides (g)</label><input class="field" id="k-c" inputmode="decimal"></div>
        <div><label class="label" for="k-f">Lipides (g)</label><input class="field" id="k-f" inputmode="decimal"></div>
      </div>
      <div class="actions"><button class="btn primary" data-act="savequick">Ajouter</button></div>`);
  }

  async function doScan() {
    const code = await scanBarcode();
    if (!code) return;
    const local = customFoods().find((c) => c.code === code) || state.offCache[code];
    if (local) { pick(local); return; }
    sheet.setBody(`<p class="note" style="padding:30px 0">Recherche du produit ${esc(code)}…</p>`);
    try {
      const f = await fetchProduct(code);
      if (f) pick(f);
      else showCreate(code, 'Ce produit n’est pas sur Open Food Facts. Crée-le depuis l’étiquette : il sera reconnu au prochain scan.');
    } catch (e) {
      showCreate(code, 'Open Food Facts ne répond pas (connexion ?). Tu peux saisir l’étiquette à la main.');
    }
  }

  function findFood(key) {
    if (Array.isArray(ctx.online)) { const f = ctx.online.find((x) => x.key === key); if (f) return f; }
    return [...state.recents, ...state.favorites, ...localPool()].find((f) => (f.key || f.id) === key);
  }
  function pick(f) {
    ctx.food = snapshot({ ...f, key: f.key || f.id });
    Object.assign(ctx.food, { qty: f.qty, sugar: f.sugar ?? null, salt: f.salt ?? null, incomplete: f.incomplete });
    const last = Object.values(state.foodLog).flat().reverse().find((e) => !e.quick && e.food.key === ctx.food.key);
    ctx.grams = last ? last.g : f.portion ? f.portion.g : 100;
    showQty();
  }

  async function action(act, el) {
    const b = sheet.body;
    if (act === 'tab') { ctx.tab = el.dataset.v; showList(); }
    else if (act === 'pick') { const f = findFood(el.dataset.key); if (f) pick(f); }
    else if (act === 'backlist') showList();
    else if (act === 'scan') doScan();
    else if (act === 'create') showCreate();
    else if (act === 'quick') showQuick();
    else if (act === 'dish') { sheet.close(); openDishView(el.dataset.id, ctx.date, ctx.meal); }
    else if (act === 'newdish') { sheet.close(); openDishEditor(null, ctx.date); }
    else if (act === 'meal') { ctx.meal = el.dataset.v; b.querySelectorAll('#meal-seg button').forEach((x) => x.classList.toggle('on', x === el)); }
    else if (act === 'online') {
      ctx.online = 'loading'; ctx.onlineMsg = ''; updateResults();
      try { ctx.online = await searchOFF(ctx.q.trim()); }
      catch (e) { ctx.online = null; ctx.onlineMsg = 'Recherche en ligne impossible pour le moment (connexion ou serveur saturé). Réessaie dans une minute.'; }
      updateResults();
    } else if (act === 'grams') {
      ctx.grams = +el.dataset.v;
      b.querySelector('#g').value = String(ctx.grams).replace('.', ',');
      b.querySelector('#calc').innerHTML = calcHTML();
    } else if (act === 'fav') {
      const k = ctx.food.key;
      if (isFav(k)) state.favorites = state.favorites.filter((f) => f.key !== k);
      else state.favorites.unshift(snapshot(ctx.food));
      save();
      el.textContent = isFav(k) ? 'Retirer des favoris' : 'Favori';
    } else if (act === 'save') {
      const g = num(b.querySelector('#g').value);
      if (!(g > 0)) return toast('Indique une quantité');
      if (picking) { pushRecent(ctx.food); save(); sheet.close(); opts.onPick({ food: snapshot(ctx.food), g }); return; }
      if (ctx.entry) { ctx.entry.g = g; ctx.entry.meal = ctx.meal; }
      else (state.foodLog[ctx.date] ||= []).push({ id: uid(), meal: ctx.meal, g, food: snapshot(ctx.food) });
      pushRecent(ctx.food);
      save(); sheet.close(); refresh();
      toast(ctx.entry ? 'Modification enregistrée' : `Ajouté : ${ctx.food.name}`);
    } else if (act === 'delentry') {
      const entry = ctx.entry;
      state.foodLog[ctx.date] = (state.foodLog[ctx.date] || []).filter((x) => x !== entry);
      save(); sheet.close(); refresh();
      toast(`Supprimé : ${entry.food.name}`, { action: 'Annuler', onAction: () => { (state.foodLog[ctx.date] ||= []).push(entry); save(); refresh(); } });
    } else if (act === 'savecreate') {
      const v = (id) => b.querySelector(id).value.trim();
      const name = v('#c-name');
      const kcal = num(v('#c-kcal'));
      if (!name || isNaN(kcal)) return toast('Le nom et l’énergie sont obligatoires');
      const id = uid();
      const pg = num(v('#c-pg'));
      const food = { id, name, brand: v('#c-brand'), kcal, p: num(v('#c-p')) || 0, c: num(v('#c-c')) || 0, f: num(v('#c-f')) || 0, fib: num(v('#c-fib')) || 0, code: v('#c-code') || null, portion: pg > 0 ? { label: '1 portion', g: pg } : null };
      state.customFoods.push(food);
      save();
      pick({ ...food, key: 'c:' + id, src: 'custom' });
    } else if (act === 'savequick') {
      const v = (id) => num(b.querySelector(id).value);
      const kcal = v('#k-kcal');
      if (isNaN(kcal)) return toast('Indique l’énergie en kcal');
      (state.foodLog[ctx.date] ||= []).push({ id: uid(), meal: ctx.meal, quick: true, name: b.querySelector('#k-name').value.trim() || 'Ajout rapide', kcal, p: v('#k-p') || 0, c: v('#k-c') || 0, f: v('#k-f') || 0 });
      save(); sheet.close(); refresh();
    }
  }

  let qTimer;
  function input(t) {
    if (t.id === 'q') {
      ctx.q = t.value; ctx.online = null; ctx.onlineMsg = '';
      clearTimeout(qTimer);
      qTimer = setTimeout(updateResults, 120);
    } else if (t.id === 'g') {
      ctx.grams = num(t.value) || 0;
      sheet.body.querySelector('#calc').innerHTML = calcHTML();
    }
  }

  ctx.open = (entry) => { ctx.entry = entry; ctx.food = { ...entry.food }; ctx.grams = entry.g; ctx.meal = entry.meal; showQty(); };
  showList();
  if (scanFirst) doScan();
  return ctx;
}

function editEntry(date, id) {
  const e = (state.foodLog[date] || []).find((x) => x.id === id);
  if (!e) return;
  if (e.kind) { editPortionEntry(date, e); return; }
  if (!e.quick) { addFlow(e.meal, date).open(e); return; }
  openSheet({
    title: 'Ajout rapide',
    html: `<label class="label" for="k-name">Description</label><input class="field" id="k-name" value="${esc(e.name)}">
      <div class="grid2">
        <div><label class="label" for="k-kcal">Énergie (kcal)</label><input class="field" id="k-kcal" inputmode="decimal" value="${e.kcal}"></div>
        <div><label class="label" for="k-p">Protéines (g)</label><input class="field" id="k-p" inputmode="decimal" value="${e.p}"></div>
        <div><label class="label" for="k-c">Glucides (g)</label><input class="field" id="k-c" inputmode="decimal" value="${e.c}"></div>
        <div><label class="label" for="k-f">Lipides (g)</label><input class="field" id="k-f" inputmode="decimal" value="${e.f}"></div>
      </div>
      <div class="actions"><button class="btn square danger" data-act="del" aria-label="Supprimer">${icon('trash')}</button><button class="btn primary" data-act="ok">Enregistrer</button></div>`,
    onAction(act, el, ev, sheet) {
      const b = sheet.body;
      if (act === 'del') state.foodLog[date] = state.foodLog[date].filter((x) => x !== e);
      if (act === 'ok') Object.assign(e, { name: b.querySelector('#k-name').value, kcal: num(b.querySelector('#k-kcal').value) || 0, p: num(b.querySelector('#k-p').value) || 0, c: num(b.querySelector('#k-c').value) || 0, f: num(b.querySelector('#k-f').value) || 0 });
      if (act === 'del' || act === 'ok') { save(); sheet.close(); refresh(); }
    },
  });
}
