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

async function loadGallery() {
  const { data, error } = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (error) return;

  ALL = data || [];
  if (ALL.length === 0) return;

  $('statPhotos').textContent = ALL.length + '+';
  const categories = new Set(ALL.map(g => g.category || 'عام'));
  $('statCategories').textContent = categories.size;

  buildCategoryFilter(categories);
  buildYearFilter();
  applyFilters();

  // تشغيل الحركة التلقائية (Auto-scroll Carousel)
  setInterval(() => {
    const grid = $('grid');
    if (grid && !grid.classList.contains('dragging')) {
      if (grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 10) {
        grid.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        grid.scrollBy({ left: 350, behavior: 'smooth' });
      }
    }
  }, 3500);
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
      applyFilters();
    };
  });
}

function buildYearFilter() {
  const wrap = $('yearFilter');
  if (!wrap) return;
  const years = [...new Set(ALL.map(g => g.year).filter(Boolean))].sort((a, b) => b - a);
  if (years.length === 0) return;
  wrap.innerHTML = `
    <button data-year="all" class="year-btn px-3 py-1 rounded-full text-xs bg-primary text-white">الكل</button>
    ${years.map(y => `<button data-year="${y}" class="year-btn px-3 py-1 rounded-full text-xs text-on-surface-variant hover:text-primary">${y}</button>`).join('')}
  `;
}

function applyFilters() {
  filtered = ALL.filter(g => {
    if (currentFilter !== 'all' && (g.category || 'عام') !== currentFilter) return false;
    if (currentYear !== 'all' && String(g.year) !== String(currentYear)) return false;
    if (currentSearch) {
      const text = ((g.title || '') + ' ' + (g.description || '')).toLowerCase();
      if (!text.includes(currentSearch.toLowerCase())) return false;
    }
    return true;
  });
  renderGrid();
}

function renderGrid() {
  const grid = $('grid');
  if (!grid) return;

  grid.className = 'carousel-track';
  grid.innerHTML = filtered.map((g, i) => `
    <article data-idx="${i}" class="carousel-card">
      <div class="carousel-img-wrap">
        <img src="${esc(g.image_url)}" class="carousel-img" alt="${esc(g.title)}" loading="lazy">
        <div class="carousel-overlay"></div>
        <div class="carousel-badge-top-left">${esc(g.category || 'عام')}</div>
        <div class="carousel-title-wrap">
          <span class="carousel-year">${g.year || ''}</span>
          <h3 class="carousel-title">${esc(g.title)}</h3>
        </div>
      </div>
      <div class="carousel-body">
        <p class="carousel-desc">${esc(g.description || '')}</p>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.carousel-card').forEach(el => {
    el.onclick = () => openLightbox(parseInt(el.dataset.idx));
  });
}

function openLightbox(idx) {
  currentIndex = idx;
  const g = filtered[currentIndex];
  if (!g) return;

  $('lbImage').src = g.image_url || '';
  $('lbTitle').textContent = g.title || '';
  $('lbDesc').textContent = g.description || '';

  $('lightbox').classList.remove('hidden');
  $('lightbox').classList.add('flex');
}

$('lbClose').onclick = () => $('lightbox').classList.add('hidden');

loadGallery();
