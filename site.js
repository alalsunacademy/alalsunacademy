import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));

// helper: يملأ عنصر لو موجود + لو القيمة فاضية ما يغيّرش
const setText = (id, val) => { const el = $(id); if (el && val) el.textContent = val; };
const setHTML = (id, val) => { const el = $(id); if (el && val) el.innerHTML = val; };
const setAttr = (id, attr, val) => { const el = $(id); if (el && val) el.setAttribute(attr, val); };

async function loadSite() {
  const [news, gallery, ann, uni, settings] = await Promise.all([
    sb.from('news').select('*').eq('published', true).order('created_at', { ascending: false }).limit(6),
    sb.from('gallery').select('*').order('created_at', { ascending: false }).limit(10),
    sb.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('universities').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);

  const S = {};
  (settings.data || []).forEach(s => { if (s.value !== null && s.value !== '') S[s.key] = s.value; });

  // ===== الهوية =====
  setText('brandName', S.brand_name);
  setText('brandTagline', S.brand_tagline);
  setText('brandNameFooter', S.brand_name);
  setText('brandDescFooter', S.brand_description);
  setText('footerCopyright', S.footer_text);
  if (S.brand_logo_url) {
    const logo = $('brandLogo');
    if (logo) { logo.src = S.brand_logo_url; logo.style.display = 'block'; }
  }

  // ===== Hero =====
  setText('heroBadge', S.hero_badge);
  setText('heroTitle', S.hero_title);
  setText('heroSubtitle', S.hero_subtitle);
  setText('heroBtn1', S.hero_btn1_text);
  setText('heroBtn2', S.hero_btn2_text);

  // ===== About =====
  setText('aboutTitle', S.about_title);
  setText('aboutSubtitle', S.about_subtitle);
  setText('aboutC1Title', S.about_card1_title);
  setText('aboutC1Desc', S.about_card1_desc);
  setText('aboutC2Title', S.about_card2_title);
  setText('aboutC2Desc', S.about_card2_desc);
  setText('aboutC3Title', S.about_card3_title);
  setText('aboutC3Desc', S.about_card3_desc);
  setText('aboutC4Title', S.about_card4_title);
  setText('aboutC4Desc', S.about_card4_desc);

  // ===== Sections titles =====
  setText('universitiesTitle', S.universities_title);
  setText('universitiesSubtitle', S.universities_subtitle);
  setText('newsTitle', S.news_title);
  setText('newsSubtitle', S.news_subtitle);
  setText('galleryTitle', S.gallery_title);
  setText('gallerySubtitle', S.gallery_subtitle);
  setText('contactTitle', S.contact_title);
  setText('contactSubtitle', S.contact_subtitle);

  // ===== Contact =====
  setText('cPhone', S.contact_phone || '—');
  setText('cEmail', S.contact_email || '—');
  setText('cAddress', S.contact_address || '—');
  setText('fPhone', S.contact_phone || '—');
  setText('fEmail', S.contact_email || '—');
  setText('fAddress', S.contact_address || '—');

  // ===== Social =====
  const socials = [
    ['social_facebook', '📘'], ['social_twitter', '🐦'],
    ['social_instagram', '📷'], ['social_youtube', '▶'],
    ['social_whatsapp', '💬']
  ];
  const socialEl = $('socialLinks');
  if (socialEl) {
    socialEl.innerHTML = socials
      .filter(([k]) => S[k] && S[k] !== '#')
      .map(([k, ic]) => `<a href="${esc(S[k])}" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-surface-container-low hover:bg-secondary hover:text-on-secondary flex items-center justify-center text-lg transition">${ic}</a>`)
      .join('');
  }

  // ===== Ticker =====
  if (ann.data && ann.data.length > 0) {
    const a = ann.data[0];
    $('ticker').classList.remove('hidden');
    $('tickerText').textContent = a.text;
    if (a.link) $('tickerLink').href = a.link;
    else $('tickerLink').style.display = 'none';
  }

  // ===== Universities =====
  if (uni.data && uni.data.length > 0) {
    $('universitiesGrid').innerHTML = uni.data.map(u => `
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group">
        <div class="relative w-full aspect-[16/10] overflow-hidden bg-surface-container-low">
          ${u.image_url
            ? `<img src="${esc(u.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(u.name)}" loading="lazy">`
            : `<div class="w-full h-full flex items-center justify-center text-6xl">🏛</div>`}
          ${u.badge ? `<span class="absolute top-3 right-3 px-3 py-1 rounded-full bg-primary/80 backdrop-blur-md text-white text-xs">${esc(u.badge)}</span>` : ''}
          ${u.price_from ? `<div class="absolute bottom-3 left-3 bg-white px-3 py-1 rounded-lg shadow text-secondary font-bold text-xs">${esc(u.price_from)}</div>` : ''}
        </div>
        <div class="p-4 sm:p-6 flex flex-col flex-1 gap-2 sm:gap-3">
          <div class="flex items-center justify-between text-xs sm:text-sm text-on-surface-variant gap-2 flex-wrap">
            <span>📍 ${esc(u.location || '')}</span>
            ${u.category ? `<span class="text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full text-xs">${esc(u.category)}</span>` : ''}
          </div>
          <h3 class="font-bold text-primary text-base sm:text-lg">${esc(u.name)}</h3>
          <p class="text-sm text-on-surface-variant line-clamp-2">${esc(u.description || '')}</p>
          ${u.majors && u.majors.length ? `
            <div class="flex flex-wrap gap-1.5">
              ${u.majors.map(m => `<span class="px-2 py-0.5 rounded-md bg-surface-container text-xs text-on-surface-variant">${esc(m)}</span>`).join('')}
            </div>` : ''}
          <a href="#contact" class="mt-auto py-2.5 rounded-xl bg-primary text-white hover:bg-secondary text-center text-sm font-semibold transition">عرض التفاصيل ←</a>
        </div>
      </div>
    `).join('');
    $('universitiesEmpty')?.classList.add('hidden');
  } else {
    $('universitiesEmpty')?.classList.remove('hidden');
  }

  // ===== News =====
  if (news.data && news.data.length > 0) {
    const [first, ...rest] = news.data;
    $('newsGrid').innerHTML = `
      <article class="lg:col-span-7 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group">
        <div class="relative w-full aspect-[16/10] lg:aspect-[16/9] overflow-hidden bg-surface-container-low">
          ${first.image_url
            ? `<img src="${esc(first.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(first.title)}" loading="lazy">`
            : `<div class="w-full h-full flex items-center justify-center text-6xl">📰</div>`}
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-secondary text-white text-xs">خبر رئيسي</span>
        </div>
        <div class="p-4 sm:p-6 flex flex-col gap-3 flex-1">
          <div class="flex items-center gap-3 text-xs sm:text-sm text-on-surface-variant flex-wrap">
            <span>📅 ${new Date(first.created_at).toLocaleDateString('ar-EG')}</span>
            <span>•</span>
            <span class="text-secondary font-bold">${esc(first.category || 'عام')}</span>
          </div>
          <h3 class="text-primary font-bold text-xl sm:text-2xl group-hover:text-secondary leading-snug">${esc(first.title)}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed">${esc(first.summary || '')}</p>
        </div>
      </article>
      <div class="lg:col-span-5 flex flex-col gap-4">
        ${rest.slice(0, 3).map(n => `
          <article class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all flex gap-3 sm:gap-4 group">
            <div class="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-surface-container-low">
              ${n.image_url
                ? `<img src="${esc(n.image_url)}" class="w-full h-full object-cover group-hover:scale-105" alt="${esc(n.title)}" loading="lazy">`
                : `<div class="w-full h-full flex items-center justify-center text-3xl">📰</div>`}
            </div>
            <div class="flex flex-col justify-between min-w-0 flex-1">
              <div>
                <div class="flex items-center gap-2 text-xs text-on-surface-variant mb-1 flex-wrap">
                  <span class="text-secondary font-bold">${esc(n.category || 'عام')}</span>
                  <span>•</span>
                  <span>${new Date(n.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                <h4 class="text-primary font-bold text-sm sm:text-base group-hover:text-secondary leading-snug line-clamp-2">${esc(n.title)}</h4>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
    $('newsEmpty')?.classList.add('hidden');
  } else {
    $('newsEmpty')?.classList.remove('hidden');
  }

  // ===== Gallery preview =====
  if (gallery.data && gallery.data.length > 0) {
    const grid = $('galleryGrid');
    grid.className = 'carousel-track';
    grid.innerHTML = gallery.data.map((g, i) => `
      <div class="carousel-card" onclick="window.location.href='gallery.html'">
        <div class="carousel-img-wrap">
          ${g.image_url
            ? `<img src="${esc(g.image_url)}" class="carousel-img" alt="${esc(g.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : `<div class="carousel-fallback">🖼</div>`}
          <div class="carousel-overlay"></div>
          <div class="carousel-badge-top-left">${esc(g.category || 'عام')}</div>
          <div class="carousel-title-wrap">
            <span class="carousel-year">${g.year || ''}</span>
            <h3 class="carousel-title">${esc(g.title)}</h3>
          </div>
        </div>
      </div>
    `).join('');
    $('galleryEmpty')?.classList.add('hidden');
  } else {
    $('galleryEmpty')?.classList.remove('hidden');
  }
}

loadSite().catch(e => console.error('Site load error:', e));