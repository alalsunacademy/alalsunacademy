import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));

let ALL = [];
let filtered = [];
let currentFilter = 'all';
let currentYear = 'all';
let currentSearch = '';
let currentIndex = 0;
let currentAlbumImages = [];
let currentAlbumIdx = 0;

async function loadBrand() {
  try {
    const { data } = await sb.from('settings').select('*').in('key', ['brand_name', 'brand_logo_url']);
    const S = {};
    (data || []).forEach(s => { if (s.value) S[s.key] = s.value; });
    if (S.brand_name) {
      document.title = 'معرض الصور — ' + S.brand_name;
      const bn = $('brandName'); if (bn) bn.textContent = S.brand_name;
    }
    if (S.brand_logo_url) {
      const logo = $('brandLogo');
      const fallback = $('brandLogoFallback');
      if (logo) {
        logo.src = S.brand_logo_url;
        logo.style.display = 'block';
        logo.onload = () => { if (fallback) fallback.style.display = 'none'; };
        logo.onerror = () => { logo.style.display = 'none'; if (fallback) fallback.style.display = 'flex'; };
      }
    }
  } catch (e) { console.error('brand load:', e); }
}

async function loadGallery() {
  const { data, error } = await sb
    .from('gallery')
    .select('*')
    .order('image_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) { showError('خطأ: ' + error.message); return; }

  const albumMap = {};
  (data || []).forEach(g => {
    const key = g.album_id || ('solo_' + g.id);
    if (!albumMap[key]) albumMap[key] = [];
    albumMap[key].push(g);
  });

  ALL = Object.entries(albumMap).map(([key, imgs]) => ({
    key, title: imgs[0].title, description: imgs[0].description,
    category: imgs[0].category || 'عام', year: imgs[0].year,
    created_at: imgs[0].created_at, cover: imgs[0].image_url,
    images: imgs.map(x => x.image_url), count: imgs.length,
    is_album: imgs.length > 1,
  }));

  if (ALL.length === 0) {
    $('statPhotos').textContent = '0';
    $('statCategories').textContent = '0';
    showEmpty();
    return;
  }

  $('statPhotos').textContent = ALL.reduce((s, a) => s + a.count, 0);
  const categories = new Set(ALL.map(g => g.category || 'عام'));
  $('statCategories').textContent = categories.size;

  buildCategoryFilter(categories);
  buildYearFilter();
  applyFilters();
}

function showEmpty() {
  const empty = $('empty');
  if (!empty) return;
  empty.classList.remove('hidden');
  empty.innerHTML = `
    <div class="text-5xl sm:text-6xl mb-4">🖼</div>
    <p class="font-bold text-primary text-base sm:text-lg">لا توجد صور بعد</p>
    <p class="text-sm text-on-surface-variant mt-1">أضف صور من لوحة التحكم</p>
  `;
}

function showError(msg) {
  const empty = $('empty');
  if (!empty) return;
  empty.classList.remove('hidden');
  empty.innerHTML = `<div class="text-5xl mb-4">⚠️</div><p class="font-bold text-red-600">${esc(msg)}</p>`;
}

function buildCategoryFilter(categories) {
  const wrap = $('categoryFilter');
  if (!wrap) return;
  const items = [['all', 'الكل'], ...Array.from(categories).map(c => [c, c])];
  wrap.innerHTML = items.map(([val, label]) => `
    <button data-cat="${esc(val)}" class="cat-btn px-3 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all ${val === 'all' ? 'bg-secondary text-white shadow-sm' : 'bg-white text-on-surface-variant hover:bg-surface-container-high'}">
      ${esc(label)}
    </button>
  `).join('');
  wrap.querySelectorAll('.cat-btn').forEach(b => {
    b.onclick = () => {
      currentFilter = b.dataset.cat;
      wrap.querySelectorAll('.cat-btn').forEach(x => {
        x.className = 'cat-btn px-3 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all ' +
          (x === b ? 'bg-secondary text-white shadow-sm' : 'bg-white text-on-surface-variant hover:bg-surface-container-high');
      });
      applyFilters();
    };
  });
}

function buildYearFilter() {
  const wrap = $('yearFilter');
  if (!wrap) return;
  const years = [...new Set(ALL.map(g => g.year).filter(Boolean))].sort((a, b) => b - a);
  if (years.length === 0) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <button data-year="all" class="year-btn px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs bg-primary text-white">الكل</button>
    ${years.map(y => `<button data-year="${y}" class="year-btn px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs text-on-surface-variant hover:text-primary">${y}</button>`).join('')}
  `;
  wrap.querySelectorAll('.year-btn').forEach(b => {
    b.onclick = () => {
      currentYear = b.dataset.year;
      wrap.querySelectorAll('.year-btn').forEach(x => {
        x.className = 'year-btn px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs ' +
          (x === b ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary');
      });
      applyFilters();
    };
  });
}

function applyFilters() {
  filtered = ALL.filter(g => {
    if (currentFilter !== 'all' && (g.category || 'عام') !== currentFilter) return false;
    if (currentYear !== 'all' && String(g.year) !== String(currentYear)) return false;
    if (currentSearch) {
      const text = ((g.title || '') + ' ' + (g.description || '') + ' ' + (g.category || '')).toLowerCase();
      if (!text.includes(currentSearch.toLowerCase())) return false;
    }
    return true;
  });
  renderGrid();
}

function renderGrid() {
  const grid = $('grid');
  const empty = $('empty');
  if (!grid) return;
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) {
      empty.classList.remove('hidden');
      empty.innerHTML = `<div class="text-5xl sm:text-6xl mb-4">🔍</div><p class="font-bold text-primary">لا توجد نتائج</p>`;
    }
    return;
  }
  if (empty) empty.classList.add('hidden');
  grid.innerHTML = filtered.map((g, i) => `
    <article data-idx="${i}" class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group border border-surface-container">
      <div class="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        ${g.cover ? `<img src="${esc(g.cover)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(g.title)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-5xl">🖼</div>`}
        ${g.is_album ? `<div class="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary/85 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"><span class="material-symbols-outlined text-[12px] sm:text-[14px]">collections</span><span>${g.count}</span></div>` : ''}
        <div class="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/90 backdrop-blur-sm text-primary text-[10px] sm:text-xs px-2 py-1 rounded-full">${esc(g.category)}</div>
      </div>
      <div class="p-3 sm:p-4">
        <h3 class="font-bold text-primary mb-1 line-clamp-1 text-sm sm:text-base">${esc(g.title)}</h3>
        <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2">${esc(g.description || '')}</p>
        <div class="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-xs text-on-surface-variant">
          <span>${g.year || ''}</span>
          <span class="text-secondary font-bold">عرض ←</span>
        </div>
      </div>
    </article>
  `).join('');
  grid.querySelectorAll('article[data-idx]').forEach(el => {
    el.onclick = () => openLightbox(parseInt(el.dataset.idx));
  });
}

function openLightbox(idx) {
  if (idx < 0) idx = filtered.length - 1;
  if (idx >= filtered.length) idx = 0;
  currentIndex = idx;
  const g = filtered[currentIndex];
  if (!g) return;
  currentAlbumImages = g.images || [g.cover];
  currentAlbumIdx = 0;
  showLightboxImage();
  $('lbTitle').textContent = g.title || '';
  $('lbDesc').textContent = g.description || '';
  $('lbCategory').textContent = g.category || 'عام';
  $('lbYear').textContent = g.year || '';
  $('lightbox').classList.remove('hidden');
  $('lightbox').classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function showLightboxImage() {
  const url = currentAlbumImages[currentAlbumIdx];
  $('lbImage').src = url || '';
  $('lbCounter').textContent = (currentAlbumIdx + 1) + ' / ' + currentAlbumImages.length;
  $('lbDownload').href = url || '#';
}

function closeLightbox() {
  $('lightbox').classList.add('hidden');
  $('lightbox').classList.remove('flex');
  document.body.style.overflow = '';
}

$('lbClose').onclick = closeLightbox;
$('lightbox').onclick = e => { if (e.target === $('lightbox')) closeLightbox(); };
$('lbPrev').onclick = e => { e.stopPropagation(); if (currentAlbumImages.length === 0) return; currentAlbumIdx = (currentAlbumIdx + 1) % currentAlbumImages.length; showLightboxImage(); };
$('lbNext').onclick = e => { e.stopPropagation(); if (currentAlbumImages.length === 0) return; currentAlbumIdx = (currentAlbumIdx - 1 + currentAlbumImages.length) % currentAlbumImages.length; showLightboxImage(); };

document.addEventListener('keydown', e => {
  if ($('lightbox').classList.contains('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') { currentAlbumIdx = (currentAlbumIdx - 1 + currentAlbumImages.length) % currentAlbumImages.length; showLightboxImage(); }
  if (e.key === 'ArrowRight') { currentAlbumIdx = (currentAlbumIdx + 1) % currentAlbumImages.length; showLightboxImage(); }
});

let searchTimer;
$('searchInput')?.addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = e.target.value.trim();
    applyFilters();
  }, 250);
});

Promise.all([loadBrand(), loadGallery()]).catch(e => {
  console.error('[gallery] fatal:', e);
  showError('خطأ: ' + e.message);
});