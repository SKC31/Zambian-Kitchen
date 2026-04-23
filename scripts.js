'use strict';

/* ══════════════════════════════════════════════════
   ZAMBIA KITCHEN — scripts.js
   Features:
   - Nav scroll fix
   - Community favourites (10+ threshold)
   - Separate ★ Fav (community) + 🔖 Save (personal)
   - Nav Share panel (WhatsApp, Instagram, FB, TikTok, X)
   - Per-recipe share with branded message
   - Gibberish detection + delete flow
   ══════════════════════════════════════════════════ */

// ── DOM ───────────────────────────────────────────
const recipesEl       = document.getElementById('recipes');
const searchEl        = document.getElementById('search');
const categoryEl      = document.getElementById('category');
const sortEl          = document.getElementById('sort');
const emptyEl         = document.getElementById('empty-state');
const countEl         = document.getElementById('results-count');

const modal           = document.getElementById('recipe-modal');
const modalKicker     = document.getElementById('modal-kicker');
const modalTitle      = document.getElementById('modal-title');
const modalMeta       = document.getElementById('modal-meta');
const modalIngrs      = document.getElementById('modal-ingredients');
const modalSteps      = document.getElementById('modal-steps');
const modalFavBtn     = document.getElementById('modal-fav-btn');
const modalSaveBtn    = document.getElementById('modal-save-btn');
const modalShareBtn   = document.getElementById('modal-share-btn');
const closeModalBtn   = document.getElementById('close-modal');

const shareRecipeModal   = document.getElementById('share-recipe-modal');
const shareRecipeTitle   = document.getElementById('share-recipe-title');
const shareRecipeUrl     = document.getElementById('share-recipe-url');
const shareAppsRecipe    = document.getElementById('share-apps-recipe');
const shareCopyRecipe    = document.getElementById('share-copy-recipe');
const closeShareModal    = document.getElementById('close-share-modal');

const gibberishModal     = document.getElementById('gibberish-modal');
const gibberishModalMsg  = document.getElementById('gibberish-modal-msg');
const gibberishPreview   = document.getElementById('gibberish-preview');
const gibberishKeepBtn   = document.getElementById('gibberish-keep-btn');
const gibberishDeleteBtn = document.getElementById('gibberish-delete-btn');
const gibberishWarning   = document.getElementById('gibberish-warning');
const gibberishWarnMsg   = document.getElementById('gibberish-warning-msg');

const menuToggle      = document.getElementById('menu-toggle');
const mainNav         = document.getElementById('main-nav');
const searchToggle    = document.getElementById('search-toggle');
const searchWrap      = document.getElementById('search-bar-wrap');

const navShareBtn     = document.getElementById('nav-share-btn');
const sharePanel      = document.getElementById('share-panel');
const sharePanelBack  = document.getElementById('share-panel-backdrop');
const shareCopyNav    = document.getElementById('share-copy-nav');

const cfGrid          = document.getElementById('community-favs-grid');
const cfEmpty         = document.getElementById('cf-empty');

const viewTabs        = document.querySelectorAll('.view-tab');
const submitForm      = document.getElementById('submit-recipe');
const toastEl         = document.getElementById('toast');
const footerYear      = document.getElementById('footer-year');

// ── State ─────────────────────────────────────────
let recipes       = [];
let currentRecipe = null;
let viewMode      = 'all';   // 'all' | 'saved'
let toastTimer    = null;
let pendingGibberishRecipe = null;
let pendingGibberishCallback = null;

if (footerYear) footerYear.textContent = new Date().getFullYear();

// ── Storage keys ──────────────────────────────────
const SAVE_KEY    = 'zk-saved';        // personal saves
const FAV_KEY     = 'zk-favs';         // community favourite counts  { id: count }
const MYFAV_KEY   = 'zk-my-favs';      // which ids this user has fav'd (to prevent double-count)
const SUB_KEY     = 'zk-submissions';

const FAV_THRESHOLD = 10; // min community favs to appear in Favourites section

// ── Helpers ───────────────────────────────────────
function getSaved()   { try { return JSON.parse(localStorage.getItem(SAVE_KEY)   || '[]'); } catch { return []; } }
function getMyFavs()  { try { return JSON.parse(localStorage.getItem(MYFAV_KEY)  || '[]'); } catch { return []; } }
function getFavCounts(){ try { return JSON.parse(localStorage.getItem(FAV_KEY)   || '{}'); } catch { return {}; } }

function getFavCount(id) { return getFavCounts()[id] || 0; }

function toggleSave(id) {
  const arr = getSaved(), idx = arr.indexOf(id);
  idx === -1 ? arr.push(id) : arr.splice(idx, 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(arr));
  showToast(idx === -1 ? '🔖 Recipe saved!' : 'Removed from saved');
}

function toggleFav(id) {
  const myFavs = getMyFavs();
  const counts  = getFavCounts();
  const already = myFavs.includes(id);
  if (already) {
    myFavs.splice(myFavs.indexOf(id), 1);
    counts[id] = Math.max(0, (counts[id] || 1) - 1);
    showToast('★ Unfavourited');
  } else {
    myFavs.push(id);
    counts[id] = (counts[id] || 0) + 1;
    showToast('★ Added to community favourites!');
  }
  localStorage.setItem(MYFAV_KEY, JSON.stringify(myFavs));
  localStorage.setItem(FAV_KEY,   JSON.stringify(counts));
  renderCommunityFavs();
}

function isSaved(id)  { return getSaved().includes(id); }
function isMyFav(id)  { return getMyFavs().includes(id); }

function esc(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ── Gibberish detection ───────────────────────────
// Score a string 0–1 (higher = more likely gibberish)
function gibberishScore(text) {
  if (!text || text.length < 4) return 0;
  const t = text.toLowerCase().replace(/[^a-z\s]/g, '');
  if (!t.trim()) return 0;

  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;

  let badWords = 0;

  for (const word of words) {
    if (word.length < 2) continue;

    // No vowels in a word ≥4 chars
    const vowels = (word.match(/[aeiou]/g) || []).length;
    if (word.length >= 4 && vowels === 0) { badWords += 2; continue; }

    // Vowel ratio too low
    if (word.length >= 5 && vowels / word.length < 0.1) { badWords += 1.5; continue; }

    // Excessive consonant clusters (4+ consecutive consonants)
    if (/[^aeiou]{5,}/.test(word)) { badWords += 1.5; continue; }

    // Repeating same character ≥4 times
    if (/(.)\1{3,}/.test(word)) { badWords += 1; continue; }

    // Very high character entropy check (random-looking)
    if (word.length >= 6) {
      const charFreq = {};
      for (const c of word) charFreq[c] = (charFreq[c] || 0) + 1;
      const uniqueRatio = Object.keys(charFreq).length / word.length;
      // if almost every char is different in a long word, probably random
      if (uniqueRatio > 0.9 && word.length > 7) { badWords += 1; }
    }
  }

  return Math.min(1, badWords / Math.max(words.length, 1));
}

function isGibberish(recipe) {
  const titleScore = gibberishScore(recipe.title) * 2; // title weighted more
  const ingrScore  = gibberishScore((recipe.ingredients || []).join(' '));
  const stepScore  = gibberishScore((recipe.steps || []).join(' '));
  const total = (titleScore + ingrScore + stepScore) / 4;
  return { score: total, isGibberish: total > 0.55 };
}

// Show inline warning on form as user types
function checkFormGibberish() {
  const title = document.getElementById('f-title').value;
  const ingr  = document.getElementById('f-ingredients').value;
  const steps = document.getElementById('f-steps').value;
  if (!title && !ingr && !steps) { gibberishWarning.hidden = true; return; }
  const { score, isGibberish: bad } = isGibberish({
    title, ingredients: ingr.split(','), steps: steps.split('\n')
  });
  gibberishWarning.hidden = !bad;
  if (bad) gibberishWarnMsg.textContent = `This looks like it might contain random/invalid text (score: ${Math.round(score*100)}%). Please use real recipe names and instructions.`;
}

['f-title','f-ingredients','f-steps'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', debounce(checkFormGibberish, 400));
});

// ── Share helpers ─────────────────────────────────
const SITE_URL  = 'https://zambiakitchen.com';
const SITE_NAME = 'Zambia Kitchen 🍲';

function buildShareLinks(text, url) {
  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp:  `https://wa.me/?text=${encoded}%20${encodedUrl}`,
    instagram: `https://www.instagram.com/`,   // IG has no direct web share; opens app
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
    tiktok:    `https://www.tiktok.com/`,       // TikTok has no direct link share
    twitter:   `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
  };
}

function renderShareApps(container, shareText, shareUrl, onCopy) {
  const links = buildShareLinks(shareText, shareUrl);
  const apps = [
    { key: 'whatsapp',  label: 'WhatsApp',  href: links.whatsapp,  icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.855L.057 23.882l6.154-1.513A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.213-3.654.898.934-3.544-.234-.374A9.775 9.775 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>` },
    { key: 'instagram', label: 'Instagram', href: links.instagram, icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>` },
    { key: 'facebook',  label: 'Facebook',  href: links.facebook,  icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>` },
    { key: 'tiktok',    label: 'TikTok',    href: links.tiktok,    icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/></svg>` },
    { key: 'twitter',   label: 'X',         href: links.twitter,   icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  ];

  container.innerHTML = apps.map(a => `
    <a class="share-app" href="${a.href}" target="_blank" rel="noopener noreferrer" aria-label="Share on ${a.label}" data-app="${a.key}">
      <span class="share-app-icon">${a.icon}</span>
      <span>${a.label}</span>
    </a>
  `).join('');

  // Instagram & TikTok: copy instead of open link
  container.querySelectorAll('[data-app="instagram"],[data-app="tiktok"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      copyToClipboard(shareUrl);
      showToast(`Link copied! Paste it in ${a.dataset.app === 'instagram' ? 'Instagram' : 'TikTok'} 📋`);
    });
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Link copied to clipboard! 📋');
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Link copied! 📋');
  }
}

// ── Open share recipe modal ───────────────────────
function openShareRecipeModal(recipe) {
  const url      = `${SITE_URL}/recipe/${recipe.id}`;
  const shareText = `Check out "${recipe.title}" on ${SITE_NAME}!`;

  shareRecipeTitle.textContent = recipe.title;
  shareRecipeUrl.textContent   = url;

  renderShareApps(shareAppsRecipe, shareText, url);

  shareCopyRecipe.onclick = () => copyToClipboard(`${shareText} ${url}`);

  shareRecipeModal.showModal();
}

closeShareModal.addEventListener('click', () => shareRecipeModal.close());
shareRecipeModal.addEventListener('click', e => {
  const r = shareRecipeModal.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) shareRecipeModal.close();
});

// ── Nav share panel ───────────────────────────────
function openNavShare() {
  const url  = SITE_URL;
  const text = `Discover authentic Zambian recipes on ${SITE_NAME}`;
  renderShareApps(document.getElementById('share-apps-nav'), text, url);
  sharePanel.classList.add('open');
  sharePanelBack.classList.add('open');
  navShareBtn.setAttribute('aria-expanded', 'true');
}
function closeNavShare() {
  sharePanel.classList.remove('open');
  sharePanelBack.classList.remove('open');
  navShareBtn.setAttribute('aria-expanded', 'false');
}

navShareBtn.addEventListener('click', e => {
  e.stopPropagation();
  sharePanel.classList.contains('open') ? closeNavShare() : openNavShare();
});
sharePanelBack.addEventListener('click', closeNavShare);
shareCopyNav.addEventListener('click', () => {
  copyToClipboard(`${SITE_URL} — Discover authentic Zambian recipes on ${SITE_NAME}`);
  closeNavShare();
});

// ── Render ────────────────────────────────────────
function render() {
  const q    = (searchEl.value || '').trim().toLowerCase();
  const cat  = categoryEl.value;
  const sort = sortEl.value;
  const saved = getSaved();

  let out = recipes.filter(r => {
    if (viewMode === 'saved' && !saved.includes(r.id)) return false;
    if (cat && r.category !== cat) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q) ||
      (Array.isArray(r.ingredients) && r.ingredients.join(' ').toLowerCase().includes(q));
  });

  if (sort === 'alpha')  out.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'newest') out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'popular') out.sort((a, b) => getFavCount(b.id) - getFavCount(a.id));

  const label = viewMode === 'saved' ? 'saved' : 'recipe';
  countEl.textContent = out.length ? `${out.length} ${label}${out.length === 1 ? '' : 's'}` : '';

  emptyEl.hidden = out.length > 0;
  recipesEl.innerHTML = out.map((r, i) => cardHtml(r, i)).join('');
  bindCardButtons(recipesEl);
}

function renderCommunityFavs() {
  const counts   = getFavCounts();
  const topRecipes = recipes
    .filter(r => (counts[r.id] || 0) >= FAV_THRESHOLD)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));

  cfEmpty.hidden = topRecipes.length > 0;
  cfGrid.innerHTML = topRecipes.map((r, i) => cardHtml(r, i, true)).join('');
  bindCardButtons(cfGrid);
}

// ── Card HTML ─────────────────────────────────────
function cardHtml(r, idx, isCommunity = false) {
  const favCount  = getFavCount(r.id);
  const myFav     = isMyFav(r.id);
  const saved     = isSaved(r.id);
  const delay     = Math.min(idx * 0.05, 0.4);

  return `
    <article class="card" aria-labelledby="t-${esc(r.id)}" style="animation-delay:${delay}s" data-id="${esc(r.id)}">
      <div class="card-header" data-cat="${esc(r.category)}">
        <p class="card-cat-label">${esc(r.category)}</p>
        <h3 id="t-${esc(r.id)}">${esc(r.title)}</h3>
      </div>
      <div class="card-body">
        <p class="card-desc">${esc(r.description || 'A traditional Zambian dish.')}</p>
        <p class="card-meta">
          ${esc(r.author || 'Community')}${r.prep_time ? ' · ' + esc(r.prep_time) : ''}
          ${favCount > 0 ? `<span class="card-fav-count">★ ${favCount}</span>` : ''}
        </p>
      </div>
      <div class="card-actions">
        <button class="btn-view" data-id="${esc(r.id)}" aria-label="View ${esc(r.title)}">View</button>
        <button class="btn-card-fav ${myFav ? 'is-fav' : ''}" data-id="${esc(r.id)}"
          aria-label="${myFav ? 'Unfavourite' : 'Favourite'}" aria-pressed="${myFav}"
          title="Community favourite (${favCount})">★ ${favCount > 0 ? favCount : 'Fav'}</button>
        <button class="btn-card-save ${saved ? 'is-saved' : ''}" data-id="${esc(r.id)}"
          aria-label="${saved ? 'Unsave' : 'Save'}" aria-pressed="${saved}">
          🔖 ${saved ? 'Saved' : 'Save'}
        </button>
        <button class="btn-card-share" data-id="${esc(r.id)}" aria-label="Share ${esc(r.title)}">↗</button>
      </div>
    </article>`;
}

function bindCardButtons(container) {
  container.querySelectorAll('.btn-view').forEach(btn =>
    btn.addEventListener('click', () => openModal(recipes.find(r => r.id === btn.dataset.id)))
  );
  container.querySelectorAll('.btn-card-fav').forEach(btn =>
    btn.addEventListener('click', () => { toggleFav(btn.dataset.id); render(); })
  );
  container.querySelectorAll('.btn-card-save').forEach(btn =>
    btn.addEventListener('click', () => { toggleSave(btn.dataset.id); render(); })
  );
  container.querySelectorAll('.btn-card-share').forEach(btn =>
    btn.addEventListener('click', () => {
      const r = recipes.find(x => x.id === btn.dataset.id);
      if (r) openShareRecipeModal(r);
    })
  );
}

// ── Modal ─────────────────────────────────────────
function openModal(r) {
  if (!r) return;
  currentRecipe = r;

  modalKicker.textContent = r.category || '';
  modalTitle.textContent  = r.title;
  modalMeta.textContent   = [
    r.author ? `By ${r.author}` : 'Community recipe',
    r.prep_time,
    r.servings ? `Serves ${r.servings}` : ''
  ].filter(Boolean).join(' · ');

  modalIngrs.innerHTML = (r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join('');
  modalSteps.innerHTML = (r.steps || []).map(s => `<li>${esc(s)}</li>`).join('');

  syncModalBtns();
  modal.showModal();
  modal.scrollTop = 0;
}

function syncModalBtns() {
  if (!currentRecipe) return;
  const fav   = isMyFav(currentRecipe.id);
  const saved = isSaved(currentRecipe.id);
  const cnt   = getFavCount(currentRecipe.id);
  modalFavBtn.textContent = fav ? `★ Favourited (${cnt})` : `★ Favourite (${cnt})`;
  modalFavBtn.classList.toggle('is-fav', fav);
  modalSaveBtn.textContent = saved ? '🔖 Saved' : '🔖 Save';
  modalSaveBtn.classList.toggle('is-saved', saved);
}

modalFavBtn.addEventListener('click', () => {
  if (!currentRecipe) return;
  toggleFav(currentRecipe.id); syncModalBtns(); render();
});
modalSaveBtn.addEventListener('click', () => {
  if (!currentRecipe) return;
  toggleSave(currentRecipe.id); syncModalBtns(); render();
});
modalShareBtn.addEventListener('click', () => {
  if (!currentRecipe) return;
  openShareRecipeModal(currentRecipe);
});

closeModalBtn.addEventListener('click', () => modal.close());
modal.addEventListener('click', e => {
  const r = modal.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close();
});
modal.addEventListener('close', () => { currentRecipe = null; });

// ── View tabs ─────────────────────────────────────
viewTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    viewMode = tab.dataset.view;
    viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === viewMode));
    render();
  });
});

// ── Mobile nav ────────────────────────────────────
menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', open);
});
mainNav.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  closeNavShare();
}));

// ── Search toggle ─────────────────────────────────
searchToggle.addEventListener('click', () => {
  const open = searchWrap.classList.toggle('open');
  searchToggle.setAttribute('aria-expanded', open);
  searchWrap.setAttribute('aria-hidden', !open);
  if (open) setTimeout(() => searchEl.focus(), 280);
  else { searchEl.value = ''; render(); }
});

// ── Filter events ─────────────────────────────────
searchEl.addEventListener('input', debounce(render, 220));
categoryEl.addEventListener('change', render);
sortEl.addEventListener('change', render);

// ── Nav scroll fix ────────────────────────────────
// Smooth scroll to #recipes-anchor accounting for sticky header
document.querySelectorAll('a[href="#recipes-anchor"], a[href="#community-favs-section"]').forEach(link => {
  link.addEventListener('click', e => {
    const targetId = link.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;
    e.preventDefault();
    const headerH = document.querySelector('.site-header')?.offsetHeight || 64;
    const top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── Gibberish modal ───────────────────────────────
function showGibberishModal(recipe, onKeep, onDelete) {
  gibberishModalMsg.textContent = `"${recipe.title}" appears to contain random or invalid text. Would you like to keep it or delete it?`;
  gibberishPreview.textContent  = [
    'Title: ' + recipe.title,
    'Ingredients: ' + (recipe.ingredients || []).join(', '),
    'Steps: ' + (recipe.steps || []).join(' | '),
  ].join('\n');
  gibberishKeepBtn.onclick   = () => { gibberishModal.close(); onKeep(); };
  gibberishDeleteBtn.onclick = () => { gibberishModal.close(); onDelete(); };
  gibberishModal.showModal();
}

// Allow admin to delete suspected gibberish from saved submissions
function auditSavedRecipes() {
  const counts = getFavCounts();
  const suspicious = recipes.filter(r => {
    if (!r.id.startsWith('sub-')) return false; // only user submissions
    const { isGibberish: bad } = isGibberish(r);
    return bad;
  });
  if (!suspicious.length) { showToast('No gibberish found ✓'); return; }
  let i = 0;
  function next() {
    if (i >= suspicious.length) { render(); renderCommunityFavs(); return; }
    const r = suspicious[i++];
    showGibberishModal(r,
      () => next(),   // keep
      () => {         // delete
        recipes = recipes.filter(x => x.id !== r.id);
        const pending = (() => { try { return JSON.parse(localStorage.getItem(SUB_KEY)||'[]'); } catch { return []; } })();
        localStorage.setItem(SUB_KEY, JSON.stringify(pending.filter(x => x.id !== r.id)));
        showToast('🗑 Recipe deleted');
        next();
      }
    );
  }
  next();
}

// ── Submit form ───────────────────────────────────
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

  const { isGibberish: bad, score } = isGibberish(newRecipe);

  const doSave = () => {
    const pending = (() => { try { return JSON.parse(localStorage.getItem(SUB_KEY)||'[]'); } catch { return []; } })();
    pending.push(newRecipe);
    localStorage.setItem(SUB_KEY, JSON.stringify(pending));
    recipes = [newRecipe, ...recipes];
    render(); renderCommunityFavs();
    showToast('Recipe shared! ✦');
    e.target.reset();
    gibberishWarning.hidden = true;
    document.getElementById('recipes-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (bad) {
    // Auto-flag and show gibberish modal before saving
    showGibberishModal(newRecipe,
      () => doSave(),   // user insists — keep it
      () => {
        showToast('Recipe discarded.');
        e.target.reset();
        gibberishWarning.hidden = true;
      }
    );
  } else {
    doSave();
  }
});

// ── Data loading ──────────────────────────────────
function mergeSubmissions() {
  try {
    const pending = JSON.parse(localStorage.getItem(SUB_KEY) || '[]');
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
    recipes = [
      { id:'demo-1', title:'Nshima', category:'Staple', description:'The beloved staple of Zambia — thick, smooth maize porridge served with any relish.', author:'Zambia Kitchen', prep_time:'20 min', servings:4, ingredients:['4 cups mealie meal','8 cups water','Salt to taste'], steps:['Bring water to a boil.','Add mealie meal gradually, stirring to avoid lumps.','Reduce heat and stir for 15–20 min until thick.','Serve with your favourite relish.'], created_at:'2024-01-10' },
      { id:'demo-2', title:'Ifisashi', category:'Relish', description:'Leafy greens simmered in a rich groundnut sauce — a Zambian classic full of flavour.', author:'Mama Bupe', prep_time:'35 min', servings:4, ingredients:['2 bunches rape or cabbage','1 cup groundnut powder','1 onion','2 tomatoes','Salt, oil'], steps:['Wash and chop the greens.','Sauté onion and tomatoes in oil until soft.','Add groundnut powder and water; stir into a paste.','Add greens and simmer 10–15 min.','Serve with nshima.'], created_at:'2024-02-14' },
      { id:'demo-3', title:'Vitumbuwa', category:'Snack', description:'Golden Zambian doughnuts — crispy outside, fluffy inside. A favourite street food.', author:'Community', prep_time:'25 min', servings:6, ingredients:['2 cups flour','2 tsp yeast','1 egg','½ cup sugar','Pinch of salt','Oil for frying'], steps:['Mix flour, yeast, sugar, and salt.','Beat in egg and enough warm water to form a soft batter.','Rest 15 min until slightly risen.','Drop spoonfuls into hot oil; fry until golden.','Drain and serve warm.'], created_at:'2024-03-05' },
      { id:'demo-4', title:'Ifinkubala', category:'Relish', description:'Dried caterpillars stir-fried with onion and tomato — a protein-rich Zambian delicacy.', author:'Zambia Kitchen', prep_time:'20 min', servings:3, ingredients:['200g dried caterpillars','1 onion','2 tomatoes','Oil','Salt'], steps:['Rinse caterpillars in warm water and drain.','Fry in a dry pan for 2 min to crisp up.','Add oil, onion, and tomatoes; stir-fry 5 min.','Season and serve with nshima.'], created_at:'2024-01-20' },
      { id:'demo-5', title:'Chibwabwa', category:'Relish', description:'Pumpkin leaves cooked with groundnuts — simple, nutritious, deeply Zambian.', author:'Gogo Namukolo', prep_time:'30 min', servings:4, ingredients:['3 cups pumpkin leaves','½ cup groundnut flour','1 onion','Salt','Oil'], steps:['Wash and chop pumpkin leaves.','Boil in salted water for 5 min; drain.','Sauté onion in oil; add leaves and groundnut flour.','Stir and cook on low heat for 10 min.'], created_at:'2024-04-01' },
      { id:'demo-6', title:'Mutakura', category:'Snack', description:'A hearty mix of boiled maize and cowpeas — eaten as a snack or light meal.', author:'Community', prep_time:'45 min', servings:4, ingredients:['1 cup dried maize','1 cup cowpeas','Salt','Water'], steps:['Soak maize and cowpeas overnight.','Boil together in salted water until soft, ~40 min.','Drain and serve warm as a snack.'], created_at:'2024-05-10' },
    ];
  }
  mergeSubmissions();
  render();
  renderCommunityFavs();
}

loadRecipes();

// Expose audit function globally for devs/admins
window.auditGibberish = auditSavedRecipes;
