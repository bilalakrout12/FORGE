// Écran « Nutrition » : journal alimentaire, scan code-barres, calories et macros du jour.
import { state, save, uid, today, addDays, fmtDate, fmt, num, esc, norm } from '../store.js';
import { FOODS } from '../data/foods.js';
import { dayTotals, entryValues, targets, GOALS } from '../calc.js';
import { fetchProduct, searchOFF } from '../off.js';
import { scanBarcode } from '../scanner.js';
import { ring, macroBar } from '../charts.js';
import { openSheet, refresh, go, toast, icon } from '../ui.js';

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
      const score = (norm(f.name).startsWith(toks[0]) ? 0 : 1) + (f.src === 'custom' ? -0.5 : 0) + f.name.length / 200;
      res.push({ f, score });
    }
  }
  return res.sort((a, b) => a.score - b.score).slice(0, 40).map((r) => r.f);
}
const isFav = (key) => state.favorites.some((f) => f.key === key);
const nsBadge = (ns) => (ns ? `<span class="ns ns-${ns}">${ns.toUpperCase()}</span>` : '');

function foodRow(f) {
  const k = f.key || f.id;
  return `<button class="food-row" data-act="pick" data-key="${esc(k)}">
    <span class="fr-main"><b>${esc(f.name)}</b>${f.brand ? `<span class="muted small"> · ${esc(f.brand)}</span>` : ''}
      <span class="muted small block">${fmt(f.kcal, 0)} kcal · P ${fmt(f.p, 1)} · G ${fmt(f.c, 1)} · L ${fmt(f.f, 1)} <span class="faint">/100 g</span></span></span>
    ${nsBadge(f.ns)}${isFav(k) ? '<span class="star on">★</span>' : ''}
  </button>`;
}

// ---------- Rendu de la page ----------
export function render(root, dateParam) {
  if (dateParam) viewDate = dateParam;
  if (!viewDate) viewDate = today();
  const d = viewDate;
  const tg = targets();
  const tot = dayTotals(d);
  const log = state.foodLog[d] || [];
  const water = state.water[d] || 0;
  const yest = state.foodLog[addDays(d, -1)] || [];

  const left = tg ? tg.kcal - tot.kcal : 0;
  const head = `
    <header class="page-head">
      <button class="icon-btn" data-act="prev" aria-label="Jour précédent">${icon('back')}</button>
      <div class="ph-center"><div class="ph-title">Nutrition</div>
        <div class="ph-sub">${d === today() ? 'Aujourd’hui · ' : ''}${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button class="icon-btn" data-act="next" aria-label="Jour suivant">${icon('next')}</button>
    </header>
    ${d !== today() ? `<button class="link-btn center" data-act="today">Revenir à aujourd’hui</button>` : ''}`;

  const summary = tg ? `
    <section class="card nutri-sum">
      <div class="ns-ring">${ring(tot.kcal, tg.kcal, fmt(tot.kcal, 0), `/ ${fmt(tg.kcal, 0)} kcal`)}</div>
      <div class="ns-macros">
        <div class="left-kcal ${left < 0 ? 'bad' : ''}">${left >= 0 ? `Reste <b>${fmt(left, 0)}</b> kcal` : `Dépassement <b>${fmt(-left, 0)}</b> kcal`}</div>
        ${macroBar('Protéines', tot.p, tg.p, 'var(--blue)')}
        ${macroBar('Glucides', tot.c, tg.c, 'var(--yellow)')}
        ${macroBar('Lipides', tot.f, tg.f, 'var(--accent)')}
        <div class="muted small">Fibres ${fmt(tot.fib, 0)} / ${tg.fib} g · ${GOALS[state.profile.goal].label}</div>
      </div>
    </section>` : '';

  const waterBlock = tg ? `
    <section class="card water">
      <span class="water-ic">${icon('drop')}</span>
      <div class="water-main"><b>${fmt(water / 1000, 2)} L</b> <span class="muted">/ ${fmt(tg.water / 1000, 1)} L</span>
        <div class="macro-track"><span style="width:${Math.min(100, (water / tg.water) * 100)}%;background:var(--blue)"></span></div></div>
      <button class="icon-btn sm" data-act="water" data-v="-250" aria-label="Retirer un verre">${icon('minus')}</button>
      <button class="icon-btn sm accent" data-act="water" data-v="250" aria-label="Ajouter un verre">${icon('plus')}</button>
    </section>` : '';

  const meals = MEALS.map(([m, label]) => {
    const items = log.filter((e) => e.meal === m);
    const sub = items.reduce((s, e) => s + entryValues(e).kcal, 0);
    const ycount = yest.filter((e) => e.meal === m).length;
    return `<section class="card meal">
      <div class="meal-head">
        <div><b>${label}</b> <span class="muted small">${sub ? fmt(sub, 0) + ' kcal' : ''}</span></div>
        <div class="meal-btns">
          ${!items.length && ycount ? `<button class="mini" data-act="copy" data-meal="${m}">${icon('copy')} Hier</button>` : ''}
          <button class="icon-btn sm accent" data-act="add" data-meal="${m}" aria-label="Ajouter">${icon('plus')}</button>
        </div>
      </div>
      ${items.map((e) => {
        const v = entryValues(e);
        return `<div class="entry" data-act="edit" data-id="${e.id}">
          <span class="en-main">${esc(e.quick ? e.name || 'Ajout rapide' : e.food.name)}<span class="muted small block">${e.quick ? 'ajout rapide' : fmt(e.g, 0) + ' g'} · P ${fmt(v.p, 0)} · G ${fmt(v.c, 0)} · L ${fmt(v.f, 0)}</span></span>
          <span class="en-kcal">${fmt(v.kcal, 0)}</span></div>`;
      }).join('')}
    </section>`;
  }).join('');

  root.innerHTML = `${head}${summary}
    <div class="quick-actions">
      <button class="btn primary" data-act="scan">${icon('scan')} Scanner</button>
      <button class="btn ghost" data-act="add" data-meal="${defaultMeal()}">${icon('search')} Rechercher</button>
    </div>
    ${meals}${waterBlock}
    ${!log.length && yest.length ? `<button class="btn ghost wide" data-act="copyday">${icon('copy')} Copier toute la journée d’hier</button>` : ''}
    <p class="muted small center">Les valeurs des aliments de base sont des moyennes. Pour un produit précis, scanne-le.</p>`;

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'prev') { viewDate = addDays(viewDate, -1); refresh(); }
    else if (a === 'next') { viewDate = addDays(viewDate, 1); refresh(); }
    else if (a === 'today') { viewDate = today(); refresh(); }
    else if (a === 'add') addFlow(t.dataset.meal, d);
    else if (a === 'scan') addFlow(defaultMeal(), d, true);
    else if (a === 'edit') editEntry(d, t.dataset.id);
    else if (a === 'water') {
      state.water[d] = Math.max(0, (state.water[d] || 0) + +t.dataset.v);
      save(); refresh();
    } else if (a === 'copy' || a === 'copyday') {
      const src = yest.filter((x) => a === 'copyday' || x.meal === t.dataset.meal);
      state.foodLog[d] = [...(state.foodLog[d] || []), ...src.map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: uid() }))];
      save(); refresh(); toast(`${src.length} aliment(s) copiés`);
    }
  });
}

function pushRecent(food) {
  const s = snapshot(food);
  state.recents = [s, ...state.recents.filter((r) => r.key !== s.key)].slice(0, 40);
}

// ---------- Ajout d'un aliment (feuille multi-étapes) ----------
function addFlow(meal, date, scanFirst = false) {
  const ctx = { meal, date, q: '', tab: state.recents.length ? 'recent' : 'base', online: null, onlineMsg: '', food: null, grams: 100, view: 'list', entry: null };
  const sheet = openSheet({
    title: 'Ajouter · ' + mealName(meal),
    tall: true,
    html: '',
    onAction: (act, el) => action(act, el),
    onInput: (t, e) => input(t, e),
  });

  function resultsHTML() {
    if (ctx.q.trim()) {
      const loc = searchLocal(ctx.q);
      let html = loc.map(foodRow).join('') || '<p class="muted">Rien dans la base locale.</p>';
      html += `<div class="section-label">En ligne (Open Food Facts)</div>`;
      if (ctx.online === 'loading') html += '<p class="muted">Recherche en cours…</p>';
      else if (Array.isArray(ctx.online)) html += ctx.online.length ? ctx.online.map(foodRow).join('') : '<p class="muted">Aucun produit trouvé.</p>';
      else html += `<button class="btn ghost wide" data-act="online">${icon('search')} Chercher « ${esc(ctx.q.trim())} » en ligne</button>`;
      if (ctx.onlineMsg) html += `<p class="warn">${esc(ctx.onlineMsg)}</p>`;
      return html;
    }
    let list = [];
    if (ctx.tab === 'recent') list = state.recents;
    else if (ctx.tab === 'fav') list = state.favorites;
    else if (ctx.tab === 'mine') list = customFoods();
    else list = FOODS;
    if (!list.length) return `<p class="muted">${ctx.tab === 'fav' ? 'Aucun favori : touche ★ sur un aliment pour l’ajouter.' : ctx.tab === 'mine' ? 'Aucun aliment créé.' : 'Rien pour l’instant.'}</p>`;
    if (ctx.tab === 'base') {
      const cats = {};
      list.forEach((f) => (cats[f.cat] ||= []).push(f));
      return Object.entries(cats).map(([c, l]) => `<details><summary>${esc(c)} (${l.length})</summary>${l.map(foodRow).join('')}</details>`).join('');
    }
    return list.map(foodRow).join('');
  }

  function showList() {
    ctx.view = 'list';
    sheet.setTitle('Ajouter · ' + mealName(ctx.meal));
    sheet.setBody(`
      <div class="search-row">
        <input class="in" id="q" type="search" autocomplete="off" placeholder="Rechercher : skyr, comté, riz…" value="${esc(ctx.q)}">
        <button class="btn primary sq" data-act="scan" aria-label="Scanner">${icon('scan')}</button>
      </div>
      <div class="seg tabs4 ${ctx.q ? 'hidden' : ''}" id="tabs">
        ${[['recent', 'Récents'], ['fav', 'Favoris'], ['mine', 'Mes aliments'], ['base', 'Base']].map(([k, l]) => `<button class="${ctx.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}
      </div>
      <div id="results">${resultsHTML()}</div>
      <div class="sheet-actions">
        <button class="btn ghost" data-act="create">${icon('plus')} Créer un aliment</button>
        <button class="btn ghost" data-act="quick">Ajout rapide</button>
      </div>`);
  }
  function updateResults() {
    const r = sheet.body.querySelector('#results');
    if (r) r.innerHTML = resultsHTML();
    sheet.body.querySelector('#tabs')?.classList.toggle('hidden', !!ctx.q);
  }

  function calcHTML() {
    const g = num(ctx.grams) || 0;
    const f = ctx.food, k = g / 100;
    return `<div class="calc-box"><div><b>${fmt(f.kcal * k, 0)}</b><span>kcal</span></div><div><b>${fmt(f.p * k, 1)}</b><span>prot.</span></div><div><b>${fmt(f.c * k, 1)}</b><span>gluc.</span></div><div><b>${fmt(f.f * k, 1)}</b><span>lip.</span></div></div>`;
  }
  function showQty() {
    ctx.view = 'qty';
    const f = ctx.food;
    const chips = [];
    if (f.portion) chips.push([f.portion.g, f.portion.label]);
    for (const g of [50, 100, 150, 200]) if (!f.portion || f.portion.g !== g) chips.push([g, g + ' g']);
    sheet.setTitle(ctx.entry ? 'Modifier' : 'Quantité');
    sheet.setBody(`
      ${ctx.entry ? '' : `<button class="link-btn" data-act="backlist">${icon('back')} Retour</button>`}
      <div class="food-head"><div><h3>${esc(f.name)}</h3><div class="muted small">${esc([f.brand, f.qty].filter(Boolean).join(' · '))}${f.code ? ` · ${esc(f.code)}` : ''}</div></div>${nsBadge(f.ns)}</div>
      <div class="per100">Pour 100 g : <b>${fmt(f.kcal, 0)} kcal</b> · P ${fmt(f.p, 1)} · G ${fmt(f.c, 1)} · L ${fmt(f.f, 1)} · fibres ${fmt(f.fib, 1)}${f.sugar != null ? ` · sucres ${fmt(f.sugar, 1)}` : ''}${f.salt != null ? ` · sel ${fmt(f.salt, 2)}` : ''}</div>
      ${f.incomplete ? '<p class="warn">Valeurs nutritionnelles incomplètes sur Open Food Facts : vérifie l’étiquette.</p>' : ''}
      <label class="full">Quantité (g ou ml)<input class="in big" id="g" inputmode="decimal" value="${esc(String(ctx.grams).replace('.', ','))}"></label>
      <div class="chips">${chips.map(([g, l]) => `<button class="chip" data-act="grams" data-v="${g}">${esc(l)}</button>`).join('')}</div>
      <div id="calc">${calcHTML()}</div>
      <label class="full">Repas<select class="in" id="meal">${MEALS.map(([m, l]) => `<option value="${m}" ${m === ctx.meal ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="sheet-actions">
        ${ctx.entry ? `<button class="btn danger ghost" data-act="delentry">${icon('trash')}</button>` : ''}
        <button class="btn ghost" data-act="fav"><span class="star ${isFav(f.key) ? 'on' : ''}">★</span> Favori</button>
        <button class="btn primary" data-act="save">${ctx.entry ? 'Enregistrer' : 'Ajouter'}</button>
      </div>`);
    setTimeout(() => { const g = sheet.body.querySelector('#g'); if (g && !ctx.entry) { g.focus(); g.select(); } }, 250);
  }

  function showCreate(code = '', msg = '') {
    ctx.view = 'create';
    sheet.setTitle('Nouvel aliment');
    sheet.setBody(`
      <button class="link-btn" data-act="backlist">${icon('back')} Retour</button>
      ${msg ? `<p class="warn">${esc(msg)}</p>` : ''}
      <p class="muted small">Recopie l’étiquette, valeurs <b>pour 100 g</b>.</p>
      <label class="full">Nom<input class="in" id="c-name" placeholder="ex : Skyr vanille Marque X"></label>
      <label class="full">Marque (facultatif)<input class="in" id="c-brand"></label>
      <div class="form-grid">
        <label>kcal<input class="in" id="c-kcal" inputmode="decimal"></label>
        <label>Protéines<input class="in" id="c-p" inputmode="decimal"></label>
        <label>Glucides<input class="in" id="c-c" inputmode="decimal"></label>
        <label>Lipides<input class="in" id="c-f" inputmode="decimal"></label>
        <label>Fibres<input class="in" id="c-fib" inputmode="decimal"></label>
        <label>Portion (g)<input class="in" id="c-pg" inputmode="decimal" placeholder="facultatif"></label>
      </div>
      <label class="full">Code-barres<input class="in" id="c-code" inputmode="numeric" value="${esc(code)}"></label>
      <div class="sheet-actions"><button class="btn primary wide" data-act="savecreate">Créer et continuer</button></div>`);
  }

  function showQuick() {
    ctx.view = 'quick';
    sheet.setTitle('Ajout rapide');
    sheet.setBody(`
      <button class="link-btn" data-act="backlist">${icon('back')} Retour</button>
      <p class="muted small">Pour un repas dont tu connais seulement les calories (restaurant, plat estimé).</p>
      <label class="full">Description<input class="in" id="k-name" placeholder="ex : Resto midi"></label>
      <div class="form-grid">
        <label>kcal<input class="in" id="k-kcal" inputmode="decimal"></label>
        <label>Protéines (g)<input class="in" id="k-p" inputmode="decimal"></label>
        <label>Glucides (g)<input class="in" id="k-c" inputmode="decimal"></label>
        <label>Lipides (g)<input class="in" id="k-f" inputmode="decimal"></label>
      </div>
      <div class="sheet-actions"><button class="btn primary wide" data-act="savequick">Ajouter</button></div>`);
  }

  async function doScan() {
    const code = await scanBarcode();
    if (!code) return;
    const local = customFoods().find((c) => c.code === code) || state.offCache[code];
    if (local) { pick(local); return; }
    sheet.setBody(`<p class="center muted">Recherche du produit ${esc(code)}…</p>`);
    try {
      const f = await fetchProduct(code);
      if (f) pick(f);
      else showCreate(code, 'Produit inconnu sur Open Food Facts. Crée-le à partir de l’étiquette : il sera reconnu au prochain scan.');
    } catch (e) {
      showCreate(code, 'Pas de connexion ou Open Food Facts indisponible. Tu peux saisir l’étiquette à la main.');
    }
  }

  function findFood(key) {
    if (Array.isArray(ctx.online)) { const f = ctx.online.find((x) => x.key === key); if (f) return f; }
    return [...state.recents, ...state.favorites, ...localPool()].find((f) => (f.key || f.id) === key);
  }
  function pick(f) {
    ctx.food = snapshot({ ...f, key: f.key || f.id, qty: f.qty, sugar: f.sugar, salt: f.salt });
    ctx.food.qty = f.qty; ctx.food.sugar = f.sugar ?? null; ctx.food.salt = f.salt ?? null; ctx.food.incomplete = f.incomplete;
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
    else if (act === 'online') {
      ctx.online = 'loading'; ctx.onlineMsg = ''; updateResults();
      try { ctx.online = await searchOFF(ctx.q.trim()); }
      catch (e) { ctx.online = null; ctx.onlineMsg = 'Recherche en ligne impossible (connexion ou serveur saturé). Réessaie dans un instant.'; }
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
      el.querySelector('.star').classList.toggle('on', isFav(k));
    } else if (act === 'save') {
      const g = num(b.querySelector('#g').value);
      if (!(g > 0)) return toast('Indique une quantité');
      const meal = b.querySelector('#meal').value;
      if (ctx.entry) { ctx.entry.g = g; ctx.entry.meal = meal; }
      else (state.foodLog[ctx.date] ||= []).push({ id: uid(), meal, g, food: snapshot(ctx.food) });
      pushRecent(ctx.food);
      save(); sheet.close(); refresh();
      toast(ctx.entry ? 'Modifié' : `Ajouté : ${ctx.food.name}`);
    } else if (act === 'delentry') {
      state.foodLog[ctx.date] = (state.foodLog[ctx.date] || []).filter((x) => x !== ctx.entry);
      save(); sheet.close(); refresh();
    } else if (act === 'savecreate') {
      const v = (id) => b.querySelector(id).value.trim();
      const name = v('#c-name');
      const kcal = num(v('#c-kcal'));
      if (!name || isNaN(kcal)) return toast('Nom et kcal obligatoires');
      const id = uid();
      const pg = num(v('#c-pg'));
      const food = { id, name, brand: v('#c-brand'), kcal, p: num(v('#c-p')) || 0, c: num(v('#c-c')) || 0, f: num(v('#c-f')) || 0, fib: num(v('#c-fib')) || 0, code: v('#c-code') || null, portion: pg > 0 ? { label: '1 portion', g: pg } : null };
      state.customFoods.push(food);
      save();
      pick({ ...food, key: 'c:' + id, src: 'custom' });
    } else if (act === 'savequick') {
      const v = (id) => num(b.querySelector(id).value);
      const kcal = v('#k-kcal');
      if (isNaN(kcal)) return toast('Indique les calories');
      (state.foodLog[ctx.date] ||= []).push({ id: uid(), meal: ctx.meal, quick: true, name: b.querySelector('#k-name').value.trim() || 'Ajout rapide', kcal, p: v('#k-p') || 0, c: v('#k-c') || 0, f: v('#k-f') || 0 });
      save(); sheet.close(); refresh();
    }
  }

  let qTimer;
  function input(t) {
    if (t.id === 'q') {
      ctx.q = t.value;
      ctx.online = null; ctx.onlineMsg = '';
      clearTimeout(qTimer);
      qTimer = setTimeout(updateResults, 120);
    } else if (t.id === 'g') {
      ctx.grams = num(t.value) || 0;
      sheet.body.querySelector('#calc').innerHTML = calcHTML();
    } else if (t.id === 'meal') {
      ctx.meal = t.value;
    }
  }

  // ouverture
  ctx.open = (entry) => { ctx.entry = entry; ctx.food = { ...entry.food }; ctx.grams = entry.g; ctx.meal = entry.meal; showQty(); };
  if (scanFirst) { showList(); doScan(); } else showList();
  return ctx;
}

function editEntry(date, id) {
  const e = (state.foodLog[date] || []).find((x) => x.id === id);
  if (!e) return;
  if (e.quick) {
    openSheet({
      title: 'Ajout rapide',
      html: `<label class="full">Description<input class="in" id="k-name" value="${esc(e.name)}"></label>
        <div class="form-grid">
          <label>kcal<input class="in" id="k-kcal" inputmode="decimal" value="${e.kcal}"></label>
          <label>Protéines<input class="in" id="k-p" inputmode="decimal" value="${e.p}"></label>
          <label>Glucides<input class="in" id="k-c" inputmode="decimal" value="${e.c}"></label>
          <label>Lipides<input class="in" id="k-f" inputmode="decimal" value="${e.f}"></label>
        </div>
        <div class="sheet-actions"><button class="btn danger ghost" data-act="del">${icon('trash')}</button><button class="btn primary" data-act="ok">Enregistrer</button></div>`,
      onAction(act, el, ev, sheet) {
        const b = sheet.body;
        if (act === 'del') state.foodLog[date] = state.foodLog[date].filter((x) => x !== e);
        if (act === 'ok') Object.assign(e, { name: b.querySelector('#k-name').value, kcal: num(b.querySelector('#k-kcal').value) || 0, p: num(b.querySelector('#k-p').value) || 0, c: num(b.querySelector('#k-c').value) || 0, f: num(b.querySelector('#k-f').value) || 0 });
        if (act === 'del' || act === 'ok') { save(); sheet.close(); refresh(); }
      },
    });
    return;
  }
  const ctx = addFlow(e.meal, date);
  ctx.open(e);
}
