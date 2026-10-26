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

async function loadGallery() {
  console.log('[gallery] loading...');

  const { data, error } = await sb
    .from('gallery')
    .select('*')
    .order('image_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[gallery] error:', error);
    showError('خطأ في تحميل الصور: ' + error.message);
    return;
  }

  console.log('[gallery] rows:', data?.length || 0);

  // تجميع في ألبومات
  const albumMap = {};
  (data || []).forEach(g => {
    const key = g.album_id || ('solo_' + g.id);
    if (!albumMap[key]) albumMap[key] = [];
    albumMap[key].push(g);
  });

  ALL = Object.entries(albumMap).map(([key, imgs]) => ({
    key,
    title: imgs[0].title,
    description: imgs[0].description,
    category: imgs[0].category || 'عام',
    year: imgs[0].year,
    created_at: imgs[0].created_at,
    cover: imgs[0].image_url,
    images: imgs.map(x => x.image_url),
    count: imgs.length,
    is_album: imgs.length > 1,
  }));

  console.log('[gallery] albums:', ALL.length);

  if (ALL.length === 0) {
    showEmpty('لا توجد صور', 'لم يقم الأدمن بإضافة أي صور بعد');
    return;
  }

  $('statPhotos').textContent = ALL.reduce((s, a) => s + a.count, 0) + '+';
  const categories = new Set(ALL.map(g => g.category || 'عام'));
  $('statCategories').textContent = categories.size;

  buildCategoryFilter(categories);
  buildYearFilter();
  applyFilters();
}

function showEmpty(title, desc) {
  const empty = $('empty');
  if (!empty) return;
  empty.classList.remove('hidden');
  empty.innerHTML = `
    <div class="text-6xl mb-4">🖼</div>
    <p class="font-headline-sm">${esc(title)}</p>
    <p class="font-body-md mt-1">${esc(desc)}</p>
  `;
}

function showError(msg) {
  const empty = $('empty');
  if (!empty) return;
  empty.classList.remove('hidden');
  empty.innerHTML = `
    <div class="text-6xl mb-4">⚠️</div>
    <p class="font-headline-sm text-red-600">${esc(msg)}</p>
    <p class="font-body-md mt-1 text-on-surface-variant">افتح Console (F12) للتفاصيل</p>
  `;
}

function buildCategoryFilter(categories) {
  const wrap = $('categoryFilter');
  if (!wrap) return;
  const items = [['all', 'جميع الألبومات'], ...Array.from(categories).map(c => [c, c])];
  wrap.innerHTML = items.map(([val, label]) => `
    <button data-cat="${esc(val)}" class="cat-btn px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${val === 'all' ? 'bg-secondary text-white shadow-sm' : 'bg-white text-on-surface-variant hover:bg-surface-container-high'}">
      ${esc(label)}
    </button>
  `).join('');
  wrap.querySelectorAll('.cat-btn').forEach(b => {
    b.onclick = () => {
      currentFilter = b.dataset.cat;
      wrap.querySelectorAll('.cat-btn').forEach(x => {
        x.className = 'cat-btn px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ' +
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
    <button data-year="all" class="year-btn px-3 py-1 rounded-full text-xs bg-primary text-white">الكل</button>
    ${years.map(y => `<button data-year="${y}" class="year-btn px-3 py-1 rounded-full text-xs text-on-surface-variant hover:text-primary">${y}</button>`).join('')}
  `;
  wrap.querySelectorAll('.year-btn').forEach(b => {
    b.onclick = () => {
      currentYear = b.dataset.year;
      wrap.querySelectorAll('.year-btn').forEach(x => {
        x.className = 'year-btn px-3 py-1 rounded-full text-xs ' +
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
      empty.innerHTML = `
        <div class="text-6xl mb-4">🔍</div>
        <p class="font-headline-sm">لا توجد نتائج مطابقة</p>
        <p class="font-body-md mt-1 text-on-surface-variant">جرّب تغيير الفلتر أو البحث</p>
      `;
    }
    return;
  }

  if (empty) empty.classList.add('hidden');

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  grid.innerHTML = filtered.map((g, i) => `
    <article data-idx="${i}" class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group">
      <div class="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        ${g.cover
          ? `<img src="${esc(g.cover)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(g.title)}" loading="lazy">`
          : `<div class="w-full h-full flex items-center justify-center text-5xl">🖼</div>`}
        ${g.is_album ? `
          <div class="absolute top-3 left-3 bg-primary/85 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">collections</span>
            <span>${g.count} صور</span>
          </div>` : ''}
        <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-primary text-xs px-2 py-1 rounded-full">${esc(g.category)}</div>
      </div>
      <div class="p-4">
        <h3 class="font-bold text-primary mb-1 line-clamp-1">${esc(g.title)}</h3>
        <p class="text-sm text-on-surface-variant line-clamp-2">${esc(g.description || '')}</p>
        <div class="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
          <span>${g.year || ''}</span>
          <span class="text-secondary font-bold">${g.is_album ? 'عرض الألبوم ←' : 'عرض ←'}</span>
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

$('lbPrev').onclick = e => {
  e.stopPropagation();
  if (currentAlbumImages.length === 0) return;
  currentAlbumIdx = (currentAlbumIdx + 1) % currentAlbumImages.length;
  showLightboxImage();
};

$('lbNext').onclick = e => {
  e.stopPropagation();
  if (currentAlbumImages.length === 0) return;
  currentAlbumIdx = (currentAlbumIdx - 1 + currentAlbumImages.length) % currentAlbumImages.length;
  showLightboxImage();
};

document.addEventListener('keydown', e => {
  if ($('lightbox').classList.contains('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') { currentAlbumIdx = (currentAlbumIdx - 1 + currentAlbumImages.length) % currentAlbumImages.length; showLightboxImage(); }
  if (e.key === 'ArrowRight') { currentAlbumIdx = (currentAlbumIdx + 1) % currentAlbumImages.length; showLightboxImage(); }
});

let searchTimer;
const searchInput = $('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      applyFilters();
    }, 250);
  });
}

loadGallery().catch(e => {
  console.error('[gallery] fatal:', e);
  showError('خطأ: ' + e.message);
});