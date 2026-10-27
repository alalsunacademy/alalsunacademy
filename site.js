import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const setText = (id, val) => { const el = $(id); if (el && val) el.textContent = val; };
const show = (id) => { const el = $(id); if (el) el.classList.remove('hidden'); };

async function loadSite() {
  const [news, gallery, ann, programs, settings] = await Promise.all([
    sb.from('news').select('*').eq('published', true).order('created_at', { ascending: false }).limit(6),
    sb.from('gallery').select('*').order('image_order').order('created_at', { ascending: false }).limit(50),
    sb.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('programs').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);

  const S = {};
  (settings.data || []).forEach(s => { S[s.key] = s.value || ''; });

  if (S.brand_name) {
    setText('brandName', S.brand_name);
    setText('footerBrandName', S.brand_name);
    document.title = S.brand_name;
  }
  if (S.brand_logo_url) {
    const logo = $('brandLogo');
    const fb = $('brandLogoFallback');
    if (logo) {
      logo.src = S.brand_logo_url;
      logo.style.display = 'block';
      logo.onload = () => { if (fb) fb.style.display = 'none'; };
      logo.onerror = () => { logo.style.display = 'none'; if (fb) fb.style.display = 'flex'; };
    }
  }

  if (S.hero_title || S.hero_subtitle || S.hero_badge) {
    show('hero');
    if (S.hero_badge) { setText('heroBadge', S.hero_badge); $('heroBadge').classList.remove('hidden'); }
    if (S.hero_title) setText('heroTitle', S.hero_title);
    if (S.hero_subtitle) setText('heroSubtitle', S.hero_subtitle);
    if (S.hero_btn1_text) { const b = $('heroBtn1'); b.textContent = S.hero_btn1_text; b.classList.remove('hidden'); }
    if (S.hero_btn2_text) { const b = $('heroBtn2'); b.textContent = S.hero_btn2_text; b.classList.remove('hidden'); }
  }

  if (ann.data && ann.data.length > 0) {
    show('ticker');
    setText('tickerText', ann.data[0].text);
    if (ann.data[0].link) $('tickerLink').href = ann.data[0].link;
  }

  if (S.about_title || S.about_card1_title) {
    show('about');
    if (S.about_title) setText('aboutTitle', S.about_title);
    if (S.about_subtitle) setText('aboutSubtitle', S.about_subtitle);
    [1,2,3,4].forEach(i => {
      if (S[`about_card${i}_title`]) setText(`aboutC${i}Title`, S[`about_card${i}_title`]);
      if (S[`about_card${i}_desc`]) setText(`aboutC${i}Desc`, S[`about_card${i}_desc`]);
      if (!S[`about_card${i}_title`] && !S[`about_card${i}_desc`]) $(`aboutC${i}`)?.remove();
    });
  }

  if (programs.data && programs.data.length > 0) {
    show('programs');
    if (S.programs_title) setText('programsTitle', S.programs_title);
    if (S.programs_subtitle) setText('programsSubtitle', S.programs_subtitle);
    $('programsGrid').innerHTML = programs.data.map(p => `
      <a href="program.html?id=${esc(p.id)}" class="block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-surface-container group">
        <div class="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
          ${p.image_url ? `<img src="${esc(p.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="${esc(p.name)}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-5xl">📚</div>`}
          ${p.badge ? `<span class="absolute top-3 right-3 px-3 py-1 rounded-full bg-primary/80 text-white text-xs">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="p-4 sm:p-5">
          <div class="text-xs text-secondary font-bold mb-1">${esc(p.category || '')}</div>
          <h3 class="font-bold text-primary text-base sm:text-lg mb-2 line-clamp-2">${esc(p.name)}</h3>
          <p class="text-xs text-on-surface-variant mb-1">🏛 ${esc(p.university || '')}</p>
          <p class="text-xs text-on-surface-variant mb-2">📍 ${esc(p.location || '')}</p>
          ${p.description ? `<p class="text-sm text-on-surface-variant line-clamp-2 mb-3">${esc(p.description)}</p>` : ''}
          <div class="flex items-center justify-between">
            ${p.duration ? `<span class="text-xs bg-surface-container-low px-2 py-1 rounded">⏱ ${esc(p.duration)}</span>` : '<span></span>'}
            <span class="text-secondary font-bold text-sm">تفاصيل ←</span>
          </div>
        </div>
      </a>
    `).join('');
  }

  if (news.data && news.data.length > 0) {
    show('news');
    if (S.news_title) setText('newsTitle', S.news_title);
    if (S.news_subtitle) setText('newsSubtitle', S.news_subtitle);
    const [first, ...rest] = news.data;
    $('newsGrid').innerHTML = `
      <a href="news.html?id=${esc(first.id)}" class="lg:col-span-7 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-surface-container block group">
        <div class="relative aspect-[16/9] overflow-hidden bg-surface-container-low">
          ${first.image_url ? `<img src="${esc(first.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-6xl">📰</div>`}
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-secondary text-white text-xs">خبر رئيسي</span>
        </div>
        <div class="p-4 sm:p-5">
          <div class="text-xs text-on-surface-variant mb-2">📅 ${new Date(first.created_at).toLocaleDateString('ar-EG')} • <span class="text-secondary font-bold">${esc(first.category || 'عام')}</span></div>
          <h3 class="font-bold text-primary text-lg sm:text-xl mb-2 group-hover:text-secondary leading-snug">${esc(first.title)}</h3>
          <p class="text-sm text-on-surface-variant line-clamp-3">${esc(first.summary || '')}</p>
          <div class="mt-3 text-secondary font-bold text-sm">قراءة الخبر كاملاً ←</div>
        </div>
      </a>
      <div class="lg:col-span-5 space-y-3 sm:space-y-4">
        ${rest.slice(0, 3).map(n => `
          <a href="news.html?id=${esc(n.id)}" class="bg-white rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all border border-surface-container flex gap-3 group">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-low">
              ${n.image_url ? `<img src="${esc(n.image_url)}" class="w-full h-full object-cover group-hover:scale-105" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-2xl">📰</div>`}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs text-secondary font-bold mb-1">${esc(n.category || 'عام')}</div>
              <h4 class="font-bold text-primary text-sm sm:text-base group-hover:text-secondary leading-snug line-clamp-2 mb-2">${esc(n.title)}</h4>
              <div class="text-xs text-on-surface-variant">${new Date(n.created_at).toLocaleDateString('ar-EG')}</div>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  if (gallery.data && gallery.data.length > 0) {
    show('gallery-preview');
    if (S.gallery_title) setText('galleryTitle', S.gallery_title);
    if (S.gallery_subtitle) setText('gallerySubtitle', S.gallery_subtitle);
    const albumMap = {};
    gallery.data.forEach(g => {
      const key = g.album_id || ('solo_' + g.id);
      if (!albumMap[key]) albumMap[key] = [];
      albumMap[key].push(g);
    });
    const albums = Object.values(albumMap).map(imgs => ({ cover: imgs[0].image_url, title: imgs[0].title, count: imgs.length }));
    $('galleryGrid').innerHTML = albums.map(g => `
      <div class="carousel-card" onclick="window.location.href='gallery.html'">
        <div class="carousel-img-wrap">
          ${g.cover ? `<img src="${esc(g.cover)}" class="carousel-img" loading="lazy">` : `<div class="carousel-fallback">🖼</div>`}
          <div class="carousel-overlay"></div>
          ${g.count > 1 ? `<div class="carousel-badge">📚 ${g.count}</div>` : ''}
          <div class="carousel-title-wrap"><h3 class="carousel-title">${esc(g.title)}</h3></div>
        </div>
      </div>
    `).join('');
  }

  const hasContact = S.contact_phone || S.contact_email || S.contact_address;
  if (hasContact || S.contact_title) {
    show('contact');
    if (S.contact_title) setText('contactTitle', S.contact_title);
    if (S.contact_subtitle) setText('contactSubtitle', S.contact_subtitle);
    if (S.contact_phone) setText('cPhone', S.contact_phone); else $('contactPhoneWrap')?.remove();
    if (S.contact_email) { const el = $('cEmail'); if (el) { el.textContent = S.contact_email; el.href = 'mailto:' + S.contact_email; } } else $('contactEmailWrap')?.remove();
    if (S.contact_address) setText('cAddress', S.contact_address); else $('contactAddressWrap')?.remove();
  }

  if (S.brand_name || S.footer_text) {
    show('footer');
    if (S.footer_description) setText('footerDescription', S.footer_description);
    if (S.footer_text) setText('footerCopyright', S.footer_text);

    const icons = {
      social_facebook: 'f',
      social_twitter: 'X',
      social_instagram: '📷',
      social_youtube: '▶',
      social_whatsapp: '💬'
    };
    const names = {
      social_facebook: 'فيسبوك',
      social_twitter: 'تويتر',
      social_instagram: 'إنستجرام',
      social_youtube: 'يوتيوب',
      social_whatsapp: 'واتساب'
    };
    const socialEl = $('socialLinks');
    if (socialEl) {
      const links = Object.keys(icons)
        .filter(k => S[k] && S[k].trim())
        .map(k => `<a href="${esc(S[k])}" target="_blank" rel="noopener" title="${names[k]}" class="w-10 h-10 rounded-full bg-white/10 hover:bg-secondary flex items-center justify-center text-lg transition">${icons[k]}</a>`)
        .join('');
      socialEl.innerHTML = links || '<span class="text-sm text-gray-400">لا توجد روابط</span>';
    }
  }

  const hasAny = (programs.data?.length > 0) || (news.data?.length > 0) || (gallery.data?.length > 0) || (ann.data?.length > 0) || hasContact || S.hero_title || S.about_title;
  if (!hasAny) show('emptyState');
}

loadSite().catch(e => { console.error(e); show('emptyState'); });