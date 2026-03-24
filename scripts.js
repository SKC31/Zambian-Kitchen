'use strict';

// ── DOM refs ──────────────────────────────────────────────────
const recipesEl     = document.getElementById('recipes');
const searchEl      = document.getElementById('search');
const categoryEl    = document.getElementById('category');
const sortEl        = document.getElementById('sort');
const emptyEl       = document.getElementById('empty-state');
const countEl       = document.getElementById('results-count');

const modal         = document.getElementById('recipe-modal');
const modalKicker   = document.getElementById('modal-kicker');
const modalTitle    = document.getElementById('modal-title');
const modalMeta     = document.getElementById('modal-meta');
const modalIngrs    = document.getElementById('modal-ingredients');
const modalSteps    = document.getElementById('modal-steps');
const favBtn        = document.getElementById('fav-btn');
const closeModalBtn = document.getElementById('close-modal');

const menuToggle    = document.getElementById('menu-toggle');
const mainNav       = document.getElementById('main-nav');
const searchToggle  = document.getElementById('search-toggle');
const searchWrap    = document.getElementById('search-bar-wrap');

const viewTabs      = document.querySelectorAll('.view-tab');
const submitForm    = document.getElementById('submit-recipe');
const toastEl       = document.getElementById('toast');
const footerYear    = document.getElementById('footer-year');

// ── State ─────────────────────────────────────────────────────
let recipes       = [];
let currentRecipe = null;
let viewMode      = 'all';
let toastTimer    = null;

// ── Init ──────────────────────────────────────────────────────
if (footerYear) footerYear.textContent = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────
const FAV_KEY = 'zambia-favs';

function getFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch { return []; }
}

function toggleFav(id) {
  const arr = getFavs();
  const idx = arr.indexOf(id);
  idx === -1 ? arr.push(id) : arr.splice(idx, 1);
  localStorage.setItem(FAV_KEY, JSON.stringify(arr));
  showToast(idx === -1 ? '★ Recipe saved!' : 'Removed from saved');
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const q    = (searchEl.value || '').trim().toLowerCase();
  const cat  = categoryEl.value;
  const sort = sortEl.value;
  const favs = getFavs();

  let out = recipes.filter(r => {
    if (viewMode === 'favs' && !favs.includes(r.id)) return false;
    if (cat && r.category !== cat) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q) ||
      (Array.isArray(r.ingredients) && r.ingredients.join(' ').toLowerCase().includes(q));
  });

  if (sort === 'alpha')  out.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'newest') out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const label = viewMode === 'favs' ? 'saved' : 'recipe';
  countEl.textContent = out.length ? `${out.length} ${label}${out.length === 1 ? '' : 's'}` : '';

  emptyEl.hidden = out.length > 0;
  recipesEl.innerHTML = out.map((r, i) => cardHtml(r, i)).join('');

  recipesEl.querySelectorAll('.btn-view').forEach(btn =>
    btn.addEventListener('click', () => openModal(recipes.find(r => r.id === btn.dataset.id)))
  );
  recipesEl.querySelectorAll('.btn-card-fav').forEach(btn =>
    btn.addEventListener('click', () => { toggleFav(btn.dataset.id); render(); })
  );
}

// ── Card HTML ─────────────────────────────────────────────────
function cardHtml(r, idx) {
  const isFav = getFavs().includes(r.id);
  const delay = Math.min(idx * 0.05, 0.4);
  return `
    <article class="card" aria-labelledby="t-${esc(r.id)}" style="animation-delay:${delay}s">
      <div class="card-header" data-cat="${esc(r.category)}">
        <p class="card-cat-label">${esc(r.category)}</p>
        <h3 id="t-${esc(r.id)}">${esc(r.title)}</h3>
      </div>
      <div class="card-body">
        <p class="card-desc">${esc(r.description || 'A traditional Zambian dish.')}</p>
        <p class="card-meta">
          ${esc(r.author || 'Community')}${r.prep_time ? ' · ' + esc(r.prep_time) : ''}
        </p>
      </div>
      <div class="card-actions">
        <button class="btn-view" data-id="${esc(r.id)}" aria-label="View ${esc(r.title)}">View Recipe</button>
        <button class="btn-card-fav ${isFav ? 'is-fav' : ''}" data-id="${esc(r.id)}"
          aria-label="${isFav ? 'Remove from' : 'Add to'} saved" aria-pressed="${isFav}">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
    </article>`;
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(r) {
  if (!r) return;
  currentRecipe = r;
  const isFav = getFavs().includes(r.id);

  modalKicker.textContent = r.category || '';
  modalTitle.textContent  = r.title;
  modalMeta.textContent   = [
    r.author ? `By ${r.author}` : 'Community recipe',
    r.prep_time,
    r.servings ? `Serves ${r.servings}` : ''
  ].filter(Boolean).join(' · ');

  modalIngrs.innerHTML = (r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join('');
  modalSteps.innerHTML = (r.steps || []).map(s => `<li>${esc(s)}</li>`).join('');

  syncFavBtn(isFav);
  modal.showModal();
  modal.scrollTop = 0;
}

function syncFavBtn(isFav) {
  favBtn.textContent = isFav ? '★ Saved' : '☆ Save Recipe';
  favBtn.classList.toggle('is-fav', isFav);
}

favBtn.addEventListener('click', () => {
  if (!currentRecipe) return;
  toggleFav(currentRecipe.id);
  syncFavBtn(getFavs().includes(currentRecipe.id));
  render();
});

closeModalBtn.addEventListener('click', () => modal.close());
modal.addEventListener('click', e => {
  const rect = modal.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom) modal.close();
});
modal.addEventListener('close', () => { currentRecipe = null; });

// ── View tabs ─────────────────────────────────────────────────
viewTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    viewMode = tab.dataset.view;
    viewTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.view === viewMode);
      t.setAttribute('aria-pressed', t.dataset.view === viewMode);
    });
    render();
  });
});

// ── Mobile nav ────────────────────────────────────────────────
menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', open);
});
mainNav.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

// ── Search toggle ─────────────────────────────────────────────
searchToggle.addEventListener('click', () => {
  const open = searchWrap.classList.toggle('open');
  searchToggle.setAttribute('aria-expanded', open);
  searchWrap.setAttribute('aria-hidden', !open);
  if (open) setTimeout(() => searchEl.focus(), 280);
  else { searchEl.value = ''; render(); }
});

// ── Filter events ─────────────────────────────────────────────
searchEl.addEventListener('input', debounce(render, 220));
categoryEl.addEventListener('change', render);
sortEl.addEventListener('change', render);

// ── Submit form ───────────────────────────────────────────────
submitForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd    = new FormData(e.target);
  const title = fd.get('title')?.trim();
  const ingr  = fd.get('ingredients')?.trim();
  const steps = fd.get('steps')?.trim();
  if (!title || !ingr || !steps) { showToast('Please fill in all required fields.'); return; }

  const newRecipe = {
    id:          'sub-' + Date.now(),
    title,
    author:      fd.get('author')?.trim() || 'Anonymous',
    category:    fd.get('category') || 'Relish',
    ingredients: ingr.split(',').map(s => s.trim()).filter(Boolean),
    steps:       steps.split('\n').map(s => s.trim()).filter(Boolean),
    created_at:  new Date().toISOString(),
    description: `${title} — shared by ${fd.get('author')?.trim() || 'the community'}.`,
  };

  const pending = (() => {
    try { return JSON.parse(localStorage.getItem('zambia-submissions') || '[]'); }
    catch { return []; }
  })();
  pending.push(newRecipe);
  localStorage.setItem('zambia-submissions', JSON.stringify(pending));

  recipes = [newRecipe, ...recipes];
  render();
  showToast('Recipe shared! ✦');
  e.target.reset();
  document.getElementById('recipes').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ── Data loading ──────────────────────────────────────────────
function mergeSubmissions() {
  try {
    const pending = JSON.parse(localStorage.getItem('zambia-submissions') || '[]');
    if (!pending.length) return;
    const ids = new Set(recipes.map(r => r.id));
    recipes = [...pending.filter(r => !ids.has(r.id)), ...recipes];
  } catch { /* ignore */ }
}

async function loadRecipes() {
  try {
    const res = await fetch('data/recipes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    recipes = await res.json();
  } catch {
    // Demo data so UI is never blank
    recipes = [
      {
        id: 'demo-1', title: 'Nshima', category: 'Staple',
        description: 'The beloved staple of Zambia — thick, smooth maize porridge served with any relish.',
        author: 'Zambia Kitchen', prep_time: '20 min', servings: 4,
        ingredients: ['4 cups mealie meal', '8 cups water', 'Salt to taste'],
        steps: ['Bring water to a boil.', 'Add mealie meal gradually, stirring to avoid lumps.', 'Reduce heat and stir for 15–20 min until thick.', 'Serve with your favourite relish.'],
        created_at: '2024-01-10'
      },
      {
        id: 'demo-2', title: 'Ifisashi', category: 'Relish',
        description: 'Leafy greens simmered in a rich groundnut sauce — a Zambian classic full of flavour.',
        author: 'Mama Bupe', prep_time: '35 min', servings: 4,
        ingredients: ['2 bunches rape or cabbage', '1 cup groundnut powder', '1 onion', '2 tomatoes', 'Salt, oil'],
        steps: ['Wash and chop the greens.', 'Sauté onion and tomatoes in oil until soft.', 'Add groundnut powder and a splash of water; stir into a paste.', 'Add greens and simmer 10–15 min.', 'Serve with nshima.'],
        created_at: '2024-02-14'
      },
      {
        id: 'demo-3', title: 'Vitumbuwa', category: 'Snack',
        description: 'Golden Zambian doughnuts — crispy outside, fluffy inside. A favourite street food.',
        author: 'Community', prep_time: '25 min', servings: 6,
        ingredients: ['2 cups flour', '2 tsp yeast', '1 egg', '½ cup sugar', 'Pinch of salt', 'Oil for frying'],
        steps: ['Mix flour, yeast, sugar, and salt.', 'Beat in egg and enough warm water to form a soft batter.', 'Rest 15 min until slightly risen.', 'Drop spoonfuls into hot oil; fry until golden.', 'Drain and serve warm.'],
        created_at: '2024-03-05'
      },
      {
        id: 'demo-4', title: 'Ifinkubala', category: 'Relish',
        description: 'Dried caterpillars stir-fried with onion and tomato — a protein-rich Zambian delicacy.',
        author: 'Zambia Kitchen', prep_time: '20 min', servings: 3,
        ingredients: ['200g dried caterpillars', '1 onion', '2 tomatoes', 'Oil', 'Salt'],
        steps: ['Rinse caterpillars in warm water and drain.', 'Fry in a dry pan for 2 min to crisp up.', 'Add oil, onion, and tomatoes; stir-fry 5 min.', 'Season and serve with nshima.'],
        created_at: '2024-01-20'
      },
      {
        id: 'demo-5', title: 'Chibwabwa', category: 'Relish',
        description: 'Pumpkin leaves cooked with groundnuts — simple, nutritious, deeply Zambian.',
        author: 'Gogo Namukolo', prep_time: '30 min', servings: 4,
        ingredients: ['3 cups pumpkin leaves', '½ cup groundnut flour', '1 onion', 'Salt', 'Oil'],
        steps: ['Wash and chop pumpkin leaves.', 'Boil in salted water for 5 min; drain.', 'Sauté onion in oil; add leaves and groundnut flour.', 'Stir and cook on low heat for 10 min.'],
        created_at: '2024-04-01'
      },
      {
        id: 'demo-6', title: 'Mutakura', category: 'Snack',
        description: 'A hearty mix of boiled maize and cowpeas — eaten as a snack or light meal.',
        author: 'Community', prep_time: '45 min', servings: 4,
        ingredients: ['1 cup dried maize', '1 cup cowpeas', 'Salt', 'Water'],
        steps: ['Soak maize and cowpeas overnight.', 'Boil together in salted water until soft, ~40 min.', 'Drain and serve warm as a snack.'],
        created_at: '2024-05-10'
      }
    ];
  }
  mergeSubmissions();
  render();
}

loadRecipes();
