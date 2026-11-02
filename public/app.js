// ====== Settings ======
const FLAVORDB_LIVE = true;   // false = sample data only, 0 credits

// ====== Sample data (compound lists are illustrative, not measured) ======
// n = name, r = role (only same-role swaps are suggested), a = allergens, s = compounds
const mk = (n, r, a, c) => ({ n, r, a, s: new Set(c.split('|')) });
const I = {
  cream:   mk('Cream', 'creamy', ['dairy'], 'diacetyl|delta-decalactone|delta-dodecalactone|butyric acid|hexanoic acid|acetoin|lactic acid|2-nonanone|2-heptanone'),
  butter:  mk('Butter or ghee', 'creamy', ['dairy'], 'diacetyl|delta-decalactone|delta-dodecalactone|butyric acid|hexanoic acid|acetoin|2-heptanone'),
  yogurt:  mk('Full-fat yogurt', 'creamy', ['dairy'], 'diacetyl|acetoin|lactic acid|butyric acid|hexanoic acid|2-nonanone|2-heptanone|delta-decalactone'),
  coconut: mk('Coconut milk', 'creamy', [], 'delta-decalactone|delta-dodecalactone|hexanoic acid|2-nonanone|nonanal|lactic acid|furfural'),
  cashew:  mk('Cashew paste', 'creamy', ['nut'], 'delta-decalactone|hexanal|benzaldehyde|furfural|pyrazine|nonanal|acetoin|maltol|hexanoic acid'),
  melon:   mk('Melon seed paste', 'creamy', [], 'hexanal|nonanal|delta-decalactone|pyrazine|furfural|acetoin|hexanoic acid|lactic acid'),
  tofu:    mk('Silken tofu', 'creamy', ['soy'], 'hexanal|nonanal|benzaldehyde|1-octen-3-ol|furfural|lactic acid'),

  tomato:  mk('Tomato', 'sour', [], 'hexanal|cis-3-hexenal|beta-damascenone|linalool|geranylacetone|furfural|limonene'),
  tamarind:mk('Tamarind pulp', 'sour', [], 'furfural|limonene|geraniol|hexanal|linalool|maltol|lactic acid'),
  lemon:   mk('Lemon juice', 'sour', [], 'limonene|citral|linalool|geraniol|pinene'),
  lime:    mk('Lime juice', 'sour', [], 'limonene|citral|linalool|pinene|geraniol'),

  curry:   mk('Curry leaves', 'aromatic', [], 'linalool|limonene|pinene|pyrazine|hexanal|sotolon'),
  ginger:  mk('Ginger', 'aromatic', [], 'zingiberene|citral|linalool|geraniol|limonene|pinene'),
  cumin:   mk('Cumin', 'aromatic', [], 'cuminaldehyde|pinene|limonene|linalool|furfural'),
  cilantro:mk('Cilantro', 'aromatic', [], 'decanal|linalool|pinene|limonene|geraniol|hexanal'),
  garlic:  mk('Garlic', 'aromatic', [], 'diallyl disulfide|methional|dipropyl disulfide|hexanal|allicin'),
  onion:   mk('Onion', 'aromatic', [], 'dipropyl disulfide|methional|furfural|hexanal|limonene'),
  chives:  mk('Chives', 'aromatic', [], 'dipropyl disulfide|methional|hexanal|limonene|linalool'),

  soy:     mk('Soy sauce', 'umami', ['soy'], 'furfural|maltol|methional|pyrazine|benzaldehyde|lactic acid|sotolon'),
  aminos:  mk('Coconut aminos', 'umami', [], 'maltol|furfural|pyrazine|lactic acid|methional|sotolon'),
  mushroom:mk('Dried shiitake', 'umami', [], '1-octen-3-ol|furfural|methional|lenthionine|pyrazine|maltol')
};

// Dish names match RecipeDB titles. i = swappable ingredients, o = other ingredients (text only)
const D = {
  'Tomato Rice':      { i: ['tomato', 'curry', 'ginger'],  o: 'rice, onion, oil, spices' },
  'Mexican Rice':     { i: ['tomato', 'cumin', 'garlic'],  o: 'rice, onion, stock' },
  'Chicken Curry':    { i: ['coconut', 'curry', 'ginger'], o: 'chicken, onion, spices' },
  'Potato Soup':      { i: ['cream', 'butter', 'chives'],  o: 'potatoes, onion, stock' },
  'Fried Rice':       { i: ['soy', 'garlic', 'ginger'],    o: 'rice, egg, vegetables, oil' },
  'Wiener Schnitzel': { i: ['lemon', 'butter'],            o: 'veal, breadcrumbs, egg, flour' }
};

const $ = id => document.getElementById(id);
const fill = (el, items) => el.innerHTML = items.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

// ====== RecipeDB (live) ======
async function showRealRecipe() {
  const title = $('dish').value;
  try {
    const r = await fetch('/api/recipe2-api/recipe-bytitle/recipeByTitle?title=' + encodeURIComponent(title));
    if (!r.ok) throw new Error('API ' + r.status);
    const json = await r.json();
    const list = json.data || [];
    const x = list.find(v => (v.Recipe_title || '').toLowerCase() === title.toLowerCase()) || list[0];
    $('recipe').innerHTML = x
      ? `<div class="card live"><b>Live from RecipeDB:</b> ${x.Recipe_title}<br>
         <span class="muted">${x.Region} · ${x.Calories} kcal · prep ${x.prep_time} min · cook ${x.cook_time} min · serves ${x.servings}</span></div>`
      : '';
  } catch (e) {
    $('recipe').innerHTML = '';
    console.warn('RecipeDB call failed:', e.message);
  }
}

// ====== FlavorDB (live) ======
// Only these ingredients go live (saves credits). The rest use sample data.
const LIVE_NAME = {
  cream: 'cream', butter: 'butter', yogurt: 'yogurt', coconut: 'coconut',
  lemon: 'lemon', lime: 'lime', tomato: 'tomato',
  ginger: 'ginger', garlic: 'garlic', cumin: 'cumin', onion: 'onion'
};
const CACHE_KEY = 'compoundCache_v2';
const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
let liveFailed = false;   // after one failure, stop live calls to save credits

// Drops bare chemical IDs like "6753-98-6" and empty names
const cleanNames = arr => arr
  .map(x => (x || '').toLowerCase().trim())
  .filter(x => x && !/^\d+-\d+-\d+$/.test(x));

async function fetchLive(key) {
  const name = LIVE_NAME[key];
  if (!name) return null;

  // Step 1: name -> entity_id (exact match, avoids "Lemon Grass" for "lemon")
  const r1 = await fetch('/api/flavordb/entities/by-entity-alias-readable?entity_alias_readable=' + encodeURIComponent(name));
  if (!r1.ok) throw new Error('entity API ' + r1.status);
  const j1 = await r1.json();
  const hit = (j1.content || []).find(x => (x.entity_alias_readable || '').toLowerCase() === name);
  if (!hit) { console.warn('No exact "' + name + '" in FlavorDB, using sample data'); return null; }

  // Step 2: entity_id -> molecules
  const r2 = await fetch('/api/flavordb/entities/by-id/' + hit.entity_id + '/molecules-compact');
  if (!r2.ok) throw new Error('molecules API ' + r2.status);
  const j2 = await r2.json();
  console.log('FlavorDB live:', name, '-> entity', hit.entity_id, '->', j2.length, 'molecules');
  const names = cleanNames((Array.isArray(j2) ? j2 : []).map(m => m.common_name));
  return names.length ? new Set(names) : null;
}

async function liveOrNull(key) {
  if (!FLAVORDB_LIVE || liveFailed || !LIVE_NAME[key]) return null;
  if (cache[key]) return new Set(cleanNames(cache[key]));   // cached: 0 credits
  try {
    const s = await fetchLive(key);
    if (s) { cache[key] = [...s]; localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
    return s;
  } catch (e) {
    liveFailed = true;
    console.warn('Live FlavorDB stopped, falling back to sample data:', e.message);
    return null;
  }
}

// ====== Scoring + UI ======
fill($('dish'), Object.keys(D).map(k => [k, k]));

function setMiss() {
  fill($('miss'), D[$('dish').value].i.map(k => [k, I[k].n]));
  showRealRecipe();
  run();
}

function chips(arr, n = 12) {
  const shown = arr.slice(0, n).map(c => `<span class="chip">${c}</span>`).join('');
  return shown + (arr.length > n ? `<span class="muted"> +${arr.length - n} more</span>` : '');
}

async function run() {
  const dish = D[$('dish').value], miss = $('miss').value;
  const ban = ['nut', 'dairy', 'soy'].filter(x => $(x).checked);
  $('status').textContent = 'Loading...';

  const liveA = await liveOrNull(miss);
  const useLive = !!liveA;
  const A = useLive ? liveA : I[miss].s;

  const cands = Object.keys(I).filter(k =>
    k !== miss && I[k].r === I[miss].r && !dish.i.includes(k) && !I[k].a.some(a => ban.includes(a)));

  const scored = [];
  let skipped = 0;
  for (const k of cands) {
    let B;
    if (useLive) {
      B = await liveOrNull(k);
      if (!B) { skipped++; continue; }     // never mix live and sample data
    } else {
      B = I[k].s;
    }
    const shared = [...A].filter(x => B.has(x));
    const union = new Set([...A, ...B]).size;
    scored.push({ k, shared, lost: [...A].filter(x => !B.has(x)), p: Math.round(shared.length / union * 100) });
  }
  const top = scored.filter(x => x.shared.length > 1).sort((a, b) => b.p - a.p).slice(0, 3);

  $('status').textContent = useLive
    ? `Flavor data: live FlavorDB (${A.size} molecules in ${I[miss].n.toLowerCase()}). ${skipped ? skipped + ' option(s) without live data skipped. ' : ''}Other ingredients: ${dish.o}.`
    : `Flavor data: sample dataset (no live FlavorDB data for this ingredient). Other ingredients: ${dish.o}.`;

  $('res').innerHTML = top.length ? top.map((x, i) => `
    <div class="card ${i ? '' : 'top'}">
      <b>${I[x.k].n}</b> ${i ? '' : '(closest match)'}
      <div class="score">${x.p}%</div>
      <div>${x.shared.length} / ${A.size} flavor compounds shared with ${I[miss].n.toLowerCase()}:</div>
      <div>${chips(x.shared)}</div>
      <div class="lost">Lost: ${x.lost.slice(0, 4).join(', ') || 'nothing significant'}</div>
    </div>`).join('') : '<p>No safe swap found. Try turning off a restriction.</p>';
}

$('dish').onchange = setMiss;
$('miss').onchange = run;
['nut', 'dairy', 'soy'].forEach(id => $(id).onchange = run);
setMiss();