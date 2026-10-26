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
let debugMode = true; // ← غيّرها لـ false بعد ما نتأكد إن كل حاجة شغالة

async function loadGallery() {
  console.log('[gallery] starting load...');

  const { data, error } = await sb.from('gallery').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('[gallery] Supabase error:', error);
    showError('خطأ في تحميل الصور: ' + error.message);
    return;
  }

  console.log('[gallery] loaded rows:', data?.length || 0);
  if (data && data[0]) console.log('[gallery] sample row:', data[0]);

  ALL = data || [];

  if (ALL.length === 0) {
    showEmpty('لا توجد صور', 'لم يقم الأدمن بإضافة أي صور بعد');
    return;
  }

  $('statPhotos').textContent = ALL.length + '+';
  const categories = new Set(ALL.map(g => g.category || 'عام'));
  $('statCategories').textContent = categories.size;

  try {
    buildCategoryFilter(categories);
    buildYearFilter();
    applyFilters();
  } catch (e) {
    console.error('[gallery] render error:', e);
    showError('خطأ في عرض الصور: ' + e.message);
  }
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
    <p class="font-body-md mt-1 text-on-surface-variant">افتح Console (F12) لمعرفة التفاصيل</p>
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

  // ✅ Carousel أفقي بدل grid رأسي
  grid.className = 'carousel-track';
  grid.innerHTML = filtered.map((g, i) => `
    <article data-idx="${i}" class="carousel-card">
      <div class="carousel-img-wrap">
        ${g.image_url
          ? `<img src="${esc(g.image_url)}" class="carousel-img" alt="${esc(g.title)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'carousel-fallback\\'>🖼</div>'">`
          : `<div class="carousel-fallback">🖼</div>`}
        <div class="carousel-overlay"></div>
        <div class="carousel-badge-top-right">
          <span>📷 صورة</span>
        </div>
        <div class="carousel-badge-top-left">${esc(g.category || 'عام')}</div>
        <div class="carousel-title-wrap">
          <span class="carousel-year">${g.year || ''}</span>
          <h3 class="carousel-title">${esc(g.title)}</h3>
        </div>
      </div>
      <div class="carousel-body">
        <p class="carousel-desc">${esc(g.description || '')}</p>
        <div class="carousel-footer">
          <span class="carousel-date">📅 ${new Date(g.created_at).toLocaleDateString('ar-EG')}</span>
          <span class="carousel-cta">تصفح ←</span>
        </div>
      </div>
    </article>
  `).join('');

  // ✅ إضافة أزرار التمرير
  const section = grid.parentNode;
  const oldNav = section.querySelector('.carousel-nav');
  if (oldNav) oldNav.remove();

  const nav = document.createElement('div');
  nav.className = 'carousel-nav';
  nav.innerHTML = `
    <button class="carousel-btn" id="carouselPrev" aria-label="السابق">‹</button>
    <button class="carousel-btn" id="carouselNext" aria-label="التالي">›</button>
  `;
  section.appendChild(nav);

  $('carouselPrev').onclick = () => {
    grid.scrollBy({ left: 350, behavior: 'smooth' });
  };
  $('carouselNext').onclick = () => {
    grid.scrollBy({ left: -350, behavior: 'smooth' });
  };

  // سحب بالماوس
  let isDown = false, startX = 0, scrollLeft = 0;
  grid.addEventListener('mousedown', e => {
    isDown = true;
    grid.classList.add('dragging');
    startX = e.pageX - grid.offsetLeft;
    scrollLeft = grid.scrollLeft;
  });
  grid.addEventListener('mouseleave', () => { isDown = false; grid.classList.remove('dragging'); });
  grid.addEventListener('mouseup', () => { isDown = false; grid.classList.remove('dragging'); });
  grid.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - grid.offsetLeft;
    grid.scrollLeft = scrollLeft - (x - startX);
  });

  // فتح الـ lightbox
  grid.querySelectorAll('.carousel-card').forEach(el => {
    el.onclick = () => openLightbox(parseInt(el.dataset.idx));
  });
}

function openLightbox(idx) {
  if (idx < 0) idx = filtered.length - 1;
  if (idx >= filtered.length) idx = 0;
  currentIndex = idx;
  const g = filtered[currentIndex];
  if (!g) return;

  $('lbImage').src = g.image_url || '';
  $('lbImage').alt = g.title || '';
  $('lbTitle').textContent = g.title || '';
  $('lbDesc').textContent = g.description || '';
  $('lbCategory').textContent = g.category || 'عام';
  $('lbYear').textContent = g.year || '';
  $('lbCounter').textContent = (currentIndex + 1) + ' / ' + filtered.length;
  $('lbDownload').href = g.image_url || '#';

  $('lightbox').classList.remove('hidden');
  $('lightbox').classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('lightbox').classList.add('hidden');
  $('lightbox').classList.remove('flex');
  document.body.style.overflow = '';
}

$('lbClose').onclick = closeLightbox;
$('lightbox').onclick = e => { if (e.target === $('lightbox')) closeLightbox(); };
$('lbPrev').onclick = e => { e.stopPropagation(); openLightbox(currentIndex + 1); };
$('lbNext').onclick = e => { e.stopPropagation(); openLightbox(currentIndex - 1); };

document.addEventListener('keydown', e => {
  if ($('lightbox').classList.contains('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') openLightbox(currentIndex - 1);
  if (e.key === 'ArrowRight') openLightbox(currentIndex + 1);
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