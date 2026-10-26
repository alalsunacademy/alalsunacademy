import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));

const setText = (id, val) => { const el = $(id); if (el && val) el.textContent = val; };

async function loadSite() {
  const [news, gallery, ann, uni, settings] = await Promise.all([
    sb.from('news').select('*').eq('published', true).order('created_at', { ascending: false }).limit(6),
    sb.from('gallery').select('*').order('image_order', { ascending: true }).order('created_at', { ascending: false }).limit(50),
    sb.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('universities').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);

  const S = {};
  (settings.data || []).forEach(s => { if (s.value !== null && s.value !== '') S[s.key] = s.value; });

  if (S.brand_name) {
    setText('brandName', S.brand_name);
    document.title = S.brand_name;
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

  if (ann.data && ann.data.length > 0) {
    const a = ann.data[0];
    $('ticker').classList.remove('hidden');
    $('tickerText').textContent = a.text;
    if (a.link) $('tickerLink').href = a.link;
    else $('tickerLink').style.display = 'none';
  }

  if (uni.data && uni.data.length > 0) {
    $('universities').classList.remove('hidden');
    if (S.universities_title) setText('universitiesTitle', S.universities_title);
    if (S.universities_subtitle) setText('universitiesSubtitle', S.universities_subtitle);
    $('universitiesGrid').innerHTML = uni.data.map(u => `
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group border border-surface-container">
        <div class="relative w-full aspect-[16/10] overflow-hidden bg-surface-container-low">
          ${u.image_url ? `<img src="${esc(u.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(u.name)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-6xl">🏛</div>`}
          ${u.badge ? `<span class="absolute top-2 sm:top-3 right-2 sm:right-3 px-2 sm:px-3 py-1 rounded-full bg-primary/80 backdrop-blur-md text-white text-[10px] sm:text-xs">${esc(u.badge)}</span>` : ''}
          ${u.price_from ? `<div class="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 bg-white px-2 sm:px-3 py-1 rounded-lg shadow text-secondary font-bold text-[10px] sm:text-xs">${esc(u.price_from)}</div>` : ''}
        </div>
        <div class="p-3 sm:p-6 flex flex-col flex-1 gap-2 sm:gap-3">
          <div class="flex items-center justify-between text-xs sm:text-sm text-on-surface-variant gap-2 flex-wrap">
            <span>📍 ${esc(u.location || '')}</span>
            ${u.category ? `<span class="text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full text-[10px] sm:text-xs">${esc(u.category)}</span>` : ''}
          </div>
          <h3 class="font-bold text-primary text-sm sm:text-lg">${esc(u.name)}</h3>
          <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2">${esc(u.description || '')}</p>
          ${u.majors && u.majors.length ? `<div class="flex flex-wrap gap-1">${u.majors.map(m => `<span class="px-1.5 sm:px-2 py-0.5 rounded-md bg-surface-container text-[10px] sm:text-xs text-on-surface-variant">${esc(m)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  if (news.data && news.data.length > 0) {
    $('news').classList.remove('hidden');
    if (S.news_title) setText('newsTitle', S.news_title);
    if (S.news_subtitle) setText('newsSubtitle', S.news_subtitle);
    const [first, ...rest] = news.data;
    $('newsGrid').innerHTML = `
      <article class="lg:col-span-7 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group border border-surface-container">
        <div class="relative w-full aspect-[16/10] lg:aspect-[16/9] overflow-hidden bg-surface-container-low">
          ${first.image_url ? `<img src="${esc(first.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(first.title)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-6xl">📰</div>`}
          <span class="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-3 py-1 rounded-full bg-secondary text-white text-[10px] sm:text-xs">خبر رئيسي</span>
        </div>
        <div class="p-3 sm:p-6 flex flex-col gap-2 sm:gap-3 flex-1">
          <div class="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-sm text-on-surface-variant flex-wrap">
            <span>📅 ${new Date(first.created_at).toLocaleDateString('ar-EG')}</span>
            <span>•</span>
            <span class="text-secondary font-bold">${esc(first.category || 'عام')}</span>
          </div>
          <h3 class="text-primary font-bold text-lg sm:text-2xl group-hover:text-secondary leading-snug">${esc(first.title)}</h3>
          <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed">${esc(first.summary || '')}</p>
        </div>
      </article>
      <div class="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
        ${rest.slice(0, 3).map(n => `
          <article class="bg-white rounded-2xl p-2.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex gap-2.5 sm:gap-4 group border border-surface-container">
            <div class="w-16 h-16 sm:w-28 sm:h-28 rounded-lg sm:rounded-xl overflow-hidden shrink-0 bg-surface-container-low">
              ${n.image_url ? `<img src="${esc(n.image_url)}" class="w-full h-full object-cover group-hover:scale-105" alt="${esc(n.title)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-2xl sm:text-3xl">📰</div>`}
            </div>
            <div class="flex flex-col justify-between min-w-0 flex-1">
              <div>
                <div class="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-on-surface-variant mb-1 flex-wrap">
                  <span class="text-secondary font-bold">${esc(n.category || 'عام')}</span>
                  <span>•</span>
                  <span>${new Date(n.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                <h4 class="text-primary font-bold text-xs sm:text-base group-hover:text-secondary leading-snug line-clamp-2">${esc(n.title)}</h4>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  if (gallery.data && gallery.data.length > 0) {
    $('gallery-preview').classList.remove('hidden');
    if (S.gallery_title) setText('galleryTitle', S.gallery_title);
    if (S.gallery_subtitle) setText('gallerySubtitle', S.gallery_subtitle);
    const albumMap = {};
    gallery.data.forEach(g => {
      const key = g.album_id || ('solo_' + g.id);
      if (!albumMap[key]) albumMap[key] = [];
      albumMap[key].push(g);
    });
    const albums = Object.values(albumMap).map(imgs => ({
      cover: imgs[0].image_url, title: imgs[0].title,
      category: imgs[0].category || 'عام', year: imgs[0].year, count: imgs.length,
    }));
    $('galleryGrid').innerHTML = albums.map(g => `
      <div class="carousel-card" onclick="window.location.href='gallery.html'">
        <div class="carousel-img-wrap">
          ${g.cover ? `<img src="${esc(g.cover)}" class="carousel-img" alt="${esc(g.title)}" loading="lazy">` : `<div class="carousel-fallback">🖼</div>`}
          <div class="carousel-overlay"></div>
          ${g.count > 1 ? `<div class="carousel-badge-top-left">📚 ${g.count}</div>` : `<div class="carousel-badge-top-left">${esc(g.category)}</div>`}
          <div class="carousel-title-wrap">
            <span class="carousel-year">${g.year || ''}</span>
            <h3 class="carousel-title">${esc(g.title)}</h3>
          </div>
        </div>
      </div>
    `).join('');
  }

  const hasContact = S.contact_phone || S.contact_email || S.contact_address;
  if (hasContact) {
    $('contact').classList.remove('hidden');
    if (S.contact_title) setText('contactTitle', S.contact_title);
    if (S.contact_subtitle) setText('contactSubtitle', S.contact_subtitle);
    if (S.contact_phone) setText('cPhone', S.contact_phone);
    if (S.contact_email) {
      const el = $('cEmail');
      if (el) { el.textContent = S.contact_email; el.href = 'mailto:' + S.contact_email; }
    }
    if (S.contact_address) setText('cAddress', S.contact_address);
  }

  const hasAny = (uni.data?.length > 0) || (news.data?.length > 0) || (gallery.data?.length > 0) || (ann.data?.length > 0) || hasContact;
  if (!hasAny) $('emptyState').classList.remove('hidden');
}

loadSite().catch(e => {
  console.error('Site load error:', e);
  $('emptyState')?.classList.remove('hidden');
});