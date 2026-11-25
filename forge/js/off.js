// Open Food Facts : base collaborative et gratuite (celle que Yuka a utilisée à ses débuts).
// Yuka n'a pas d'API publique, Open Food Facts si.
import { state, save } from './store.js';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,serving_size,nutriscore_grade,nova_group,quantity';

async function getJSON(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function n(v) {
  const x = parseFloat(v);
  return isNaN(x) ? null : x;
}

export function toFood(p) {
  const nu = p.nutriments || {};
  let kcal = n(nu['energy-kcal_100g']);
  if (kcal === null && n(nu['energy_100g']) !== null) kcal = n(nu['energy_100g']) / 4.184;
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim() || 'Produit sans nom';
  const sq = n(p.serving_quantity);
  return {
    key: 'off:' + p.code,
    code: p.code,
    name,
    brand: (p.brands || '').split(',')[0].trim(),
    kcal: kcal ?? 0,
    p: n(nu.proteins_100g) ?? 0,
    c: n(nu.carbohydrates_100g) ?? 0,
    f: n(nu.fat_100g) ?? 0,
    fib: n(nu.fiber_100g) ?? 0,
    sugar: n(nu.sugars_100g),
    salt: n(nu.salt_100g),
    ns: p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null,
    nova: p.nova_group || null,
    qty: p.quantity || '',
    portion: sq && sq > 0 ? { label: '1 portion' + (p.serving_size ? ` (${p.serving_size})` : ''), g: sq } : null,
    incomplete: kcal === null,
    src: 'off',
  };
}

export async function fetchProduct(code) {
  if (state.offCache[code]) return state.offCache[code];
  const j = await getJSON(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!j || j.status !== 1 || !j.product) return null;
  const food = toFood({ ...j.product, code });
  cacheFood(food);
  return food;
}

export async function searchOFF(q) {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&lc=fr&cc=fr&fields=${FIELDS}`;
  const j = await getJSON(url, 15000);
  return (j.products || [])
    .filter((p) => p.code && p.nutriments && (p.nutriments['energy-kcal_100g'] !== undefined || p.nutriments['energy_100g'] !== undefined))
    .map(toFood);
}

export function cacheFood(food) {
  state.offCache[food.code] = food;
  const keys = Object.keys(state.offCache);
  if (keys.length > 300) delete state.offCache[keys[0]];
  save();
}
