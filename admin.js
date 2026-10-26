import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

let currentTab = 'news';
let DATA = { news: [], gallery: [], announcements: [], universities: [], majors: [], settings: [] };

/* ============================================
   LOGIN
   ============================================ */
async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: isAdmin, error } = await sb.rpc('is_admin');
    if (error) {
      console.error('is_admin error:', error);
      return showLogin('خطأ في فحص الصلاحيات: ' + error.message);
    }
    if (!isAdmin) {
      await sb.auth.signOut();
      return showLogin('هذا الحساب ليس أدمن. تأكد من إضافة إيميلك في admin_emails()');
    }
    await enterApp();
  } catch (e) {
    console.error('init error:', e);
    showLogin('خطأ: ' + e.message);
  }
}

function showLogin(msg = '') {
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('loginErr').textContent = msg;
  $('go').onclick = doLogin;
  $('pw').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
}

async function doLogin() {
  const em = $('em').value.trim();
  const pw = $('pw').value;
  if (!em || !pw) {
    $('loginErr').textContent = 'اكتب الإيميل والباسورد';
    return;
  }
  $('go').disabled = true;
  $('go').textContent = '⏳ جاري الدخول...';
  $('loginErr').textContent = '';

  const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });

  $('go').disabled = false;
  $('go').textContent = 'دخول';

  if (error) {
    $('loginErr').textContent = 'خطأ: ' + error.message;
    return;
  }
  await init();
}

/* ============================================
   APP ENTRY
   ============================================ */
async function enterApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');

  $('logout').onclick = async () => {
    await sb.auth.signOut();
    DATA = { news: [], gallery: [], announcements: [], universities: [], majors: [], settings: [] };
    showLogin();
  };

  document.querySelectorAll('#nav button[data-tab]').forEach(b => {
    b.onclick = () => switchTab(b.dataset.tab);
  });

  await loadAll();
  switchTab('news');
}

async function loadAll() {
  const results = await Promise.all([
    sb.from('news').select('*').order('created_at', { ascending: false }),
    sb.from('gallery').select('*').order('created_at', { ascending: false }),
    sb.from('announcements').select('*').order('created_at', { ascending: false }),
    sb.from('universities').select('*').order('sort_order'),
    sb.from('majors').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);

  const keys = ['news', 'gallery', 'announcements', 'universities', 'majors', 'settings'];
  results.forEach((r, i) => {
    if (r.error) console.error('load ' + keys[i] + ':', r.error);
    DATA[keys[i]] = r.data || [];
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#nav button[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const titles = {
    news: '📰 إدارة الأخبار',
    gallery: '🖼️ معرض الصور',
    announcements: '📢 الإعلانات والتنبيهات',
    universities: '🏛️ الجامعات والشركاء',
    majors: '🎓 التخصصات',
    settings: '⚙️ إعدادات الموقع'
  };
  $('pageTitle').textContent = titles[tab];
  renderTab();
}

/* ============================================
   HELPERS
   ============================================ */
function flash(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
  $('panel').prepend(el);
  setTimeout(() => el.remove(), 4000);
}

async function uploadImage(file) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const { error } = await sb.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) {
    flash('فشل رفع الصورة: ' + error.message, false);
    console.error('upload error:', error);
    return null;
  }
  const { data } = sb.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================
   RENDER ROUTER
   ============================================ */
function renderTab() {
  switch(currentTab) {
    case 'news': renderNews(); break;
    case 'gallery': renderGallery(); break;
    case 'announcements': renderAnnouncements(); break;
    case 'universities': renderUniversities(); break;
    case 'majors': renderMajors(); break;
    case 'settings': renderSettings(); break;
  }
}

/* ============================================
   NEWS
   ============================================ */
function renderNews() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة خبر جديد</h2>
      <label>العنوان *</label>
      <input id="n_title" placeholder="عنوان الخبر">
      <label>الوصف المختصر</label>
      <textarea id="n_summary" placeholder="سطر أو سطرين للعرض في القائمة"></textarea>
      <label>المحتوى الكامل (اختياري)</label>
      <textarea id="n_content" placeholder="تفاصيل الخبر..."></textarea>
      <div class="grid2">
        <div>
          <label>التصنيف</label>
          <input id="n_category" value="عام">
        </div>
        <div>
          <label>صورة الخبر</label>
          <input type="file" id="n_image" accept="image/*">
        </div>
      </div>
      <img id="n_preview" class="preview">
      <div class="row">
        <button id="n_save">💾 حفظ الخبر</button>
      </div>
    </div>

    <div class="card">
      <h2>📰 الأخبار المنشورة (${DATA.news.length})</h2>
      ${DATA.news.length === 0 ? '<div class="empty">لا توجد أخبار بعد</div>' :
        DATA.news.map(n => `
          <div class="item">
            ${n.image_url
              ? `<img src="${esc(n.image_url)}" class="thumb" onerror="this.style.display='none'">`
              : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:#ccc">📰</div>'}
            <div class="item-info">
              <b>${esc(n.title)}</b>
              <span>${esc(n.summary || '—')}</span>
              <span class="pill">${esc(n.category || 'عام')}</span>
            </div>
            <button class="d" data-del-news="${esc(n.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('n_image').onchange = e => previewImage(e, 'n_preview');

  $('n_save').onclick = async () => {
    const title = $('n_title').value.trim();
    if (!title) return flash('العنوان مطلوب', false);

    $('n_save').disabled = true;
    $('n_save').textContent = '⏳ جاري الحفظ...';

    const img = await uploadImage($('n_image').files[0]);

    const { error } = await sb.from('news').insert({
      id: newId(),
      title,
      summary: $('n_summary').value.trim(),
      content: $('n_content').value.trim(),
      category: $('n_category').value.trim() || 'عام',
      image_url: img,
      published: true,
    });

    $('n_save').disabled = false;
    $('n_save').textContent = '💾 حفظ الخبر';

    if (error) return flash('فشل: ' + error.message, false);

    await loadAll();
    renderNews();
    flash('✅ تم حفظ الخبر');
  };

  document.querySelectorAll('[data-del-news]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الخبر؟')) return;
      await sb.from('news').delete().eq('id', b.dataset.delNews);
      await loadAll();
      renderNews();
      flash('🗑️ تم الحذف');
    };
  });
}

/* ============================================
   GALLERY
   ============================================ */
function renderGallery() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة صورة جديدة</h2>
      <label>العنوان *</label>
      <input id="g_title" placeholder="عنوان الصورة">
      <label>الوصف</label>
      <textarea id="g_desc" placeholder="وصف مختصر"></textarea>
      <div class="grid3">
        <div>
          <label>التصنيف</label>
          <input id="g_category" value="عام">
        </div>
        <div>
          <label>السنة</label>
          <input id="g_year" type="number" value="${new Date().getFullYear()}">
        </div>
        <div>
          <label>الصورة *</label>
          <input type="file" id="g_image" accept="image/*">
        </div>
      </div>
      <img id="g_preview" class="preview">
      <div class="row">
        <button id="g_save">💾 حفظ الصورة</button>
      </div>
    </div>

    <div class="card">
      <h2>🖼️ الصور (${DATA.gallery.length})</h2>
      ${DATA.gallery.length === 0 ? '<div class="empty">لا توجد صور بعد</div>' :
        DATA.gallery.map(g => `
          <div class="item">
            <img src="${esc(g.image_url)}" class="thumb" onerror="this.style.background='#eee'">
            <div class="item-info">
              <b>${esc(g.title)}</b>
              <span>${esc(g.description || '—')}</span>
              <span class="pill">${esc(g.category || 'عام')} • ${g.year || ''}</span>
            </div>
            <button class="d" data-del-gal="${esc(g.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('g_image').onchange = e => previewImage(e, 'g_preview');

  $('g_save').onclick = async () => {
    const title = $('g_title').value.trim();
    const file = $('g_image').files[0];
    if (!title) return flash('العنوان مطلوب', false);
    if (!file) return flash('الصورة مطلوبة', false);

    $('g_save').disabled = true;
    $('g_save').textContent = '⏳ جاري الرفع...';

    const url = await uploadImage(file);
    if (!url) {
      $('g_save').disabled = false;
      $('g_save').textContent = '💾 حفظ الصورة';
      return;
    }

    const { error } = await sb.from('gallery').insert({
      id: newId(),
      title,
      description: $('g_desc').value.trim(),
      category: $('g_category').value.trim() || 'عام',
      year: parseInt($('g_year').value) || new Date().getFullYear(),
      image_url: url,
    });

    $('g_save').disabled = false;
    $('g_save').textContent = '💾 حفظ الصورة';

    if (error) return flash('فشل: ' + error.message, false);

    await loadAll();
    renderGallery();
    flash('✅ تم حفظ الصورة');
  };

  document.querySelectorAll('[data-del-gal]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الصورة؟')) return;
      await sb.from('gallery').delete().eq('id', b.dataset.delGal);
      await loadAll();
      renderGallery();
      flash('🗑️ تم الحذف');
    };
  });
}

/* ============================================
   ANNOUNCEMENTS
   ============================================ */
function renderAnnouncements() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة إعلان / تنبيه</h2>
      <label>النص *</label>
      <textarea id="a_text" placeholder="نص الإعلان اللي هيظهر في الشريط العلوي"></textarea>
      <label>رابط (اختياري)</label>
      <input id="a_link" placeholder="#contact">
      <div class="row">
        <button id="a_save">💾 حفظ الإعلان</button>
      </div>
    </div>

    <div class="card">
      <h2>📢 الإعلانات (${DATA.announcements.length})</h2>
      ${DATA.announcements.length === 0 ? '<div class="empty">لا توجد إعلانات</div>' :
        DATA.announcements.map(a => `
          <div class="item">
            <div class="item-info">
              <b>${esc(a.text)}</b>
              <span>${esc(a.link || '—')}</span>
              <span class="pill" style="background:${a.active ? '#d1fae5' : '#fee2e2'};color:${a.active ? '#0a7a3f' : '#ba1a1a'}">${a.active ? 'نشط' : 'موقوف'}</span>
            </div>
            <button class="s" data-tog-ann="${esc(a.id)}">${a.active ? '⏸️ إيقاف' : '▶️ تفعيل'}</button>
            <button class="d" data-del-ann="${esc(a.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('a_save').onclick = async () => {
    const text = $('a_text').value.trim();
    if (!text) return flash('النص مطلوب', false);

    $('a_save').disabled = true;

    const { error } = await sb.from('announcements').insert({
      id: newId(),
      text,
      link: $('a_link').value.trim() || null,
      active: true,
    });

    $('a_save').disabled = false;

    if (error) return flash('فشل: ' + error.message, false);

    await loadAll();
    renderAnnouncements();
    flash('✅ تم الحفظ');
  };

  document.querySelectorAll('[data-del-ann]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الإعلان؟')) return;
      await sb.from('announcements').delete().eq('id', b.dataset.delAnn);
      await loadAll();
      renderAnnouncements();
      flash('🗑️ تم الحذف');
    };
  });

  document.querySelectorAll('[data-tog-ann]').forEach(b => {
    b.onclick = async () => {
      const a = DATA.announcements.find(x => x.id === b.dataset.togAnn);
      if (!a) return;
      await sb.from('announcements').update({ active: !a.active }).eq('id', a.id);
      await loadAll();
      renderAnnouncements();
    };
  });
}

/* ============================================
   UNIVERSITIES
   ============================================ */
function renderUniversities() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة جامعة / شريك</h2>
      <div class="grid2">
        <div>
          <label>الاسم *</label>
          <input id="u_name" placeholder="اسم الجامعة">
        </div>
        <div>
          <label>الموقع</label>
          <input id="u_loc" placeholder="القاهرة، مصر">
        </div>
      </div>
      <label>الوصف</label>
      <textarea id="u_desc" placeholder="نبذة عن الجامعة"></textarea>
      <div class="grid2">
        <div>
          <label>شارة (اختياري)</label>
          <input id="u_badge" placeholder="معتمدة دولياً">
        </div>
        <div>
          <label>السعر يبدأ من</label>
          <input id="u_price" placeholder="$3,200 / سنوي">
        </div>
      </div>
      <div class="grid2">
        <div>
          <label>التصنيف (بلد)</label>
          <input id="u_cat" placeholder="مصر">
        </div>
        <div>
          <label>التخصصات (مفصولة بفاصلة)</label>
          <input id="u_majors" placeholder="الهندسة, الطب, إدارة الأعمال">
        </div>
      </div>
      <label>صورة الجامعة</label>
      <input type="file" id="u_image" accept="image/*">
      <img id="u_preview" class="preview">
      <div class="row">
        <button id="u_save">💾 حفظ</button>
      </div>
    </div>

    <div class="card">
      <h2>🏛️ الجامعات (${DATA.universities.length})</h2>
      ${DATA.universities.length === 0 ? '<div class="empty">لا توجد جامعات بعد</div>' :
        DATA.universities.map(u => `
          <div class="item">
            ${u.image_url
              ? `<img src="${esc(u.image_url)}" class="thumb" onerror="this.style.display='none'">`
              : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:#ccc">🏛</div>'}
            <div class="item-info">
              <b>${esc(u.name)}</b>
              <span>${esc(u.location || '')} — ${esc(u.description || '')}</span>
            </div>
            <button class="d" data-del-uni="${esc(u.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('u_image').onchange = e => previewImage(e, 'u_preview');

  $('u_save').onclick = async () => {
    const name = $('u_name').value.trim();
    if (!name) return flash('الاسم مطلوب', false);

    $('u_save').disabled = true;
    $('u_save').textContent = '⏳ جاري الحفظ...';

    const img = await uploadImage($('u_image').files[0]);
    const majors = $('u_majors').value.split(',').map(x => x.trim()).filter(Boolean);

    const { error } = await sb.from('universities').insert({
      id: newId(),
      name,
      location: $('u_loc').value.trim(),
      description: $('u_desc').value.trim(),
      badge: $('u_badge').value.trim(),
      price_from: $('u_price').value.trim(),
      category: $('u_cat').value.trim(),
      majors,
      image_url: img,
      sort_order: DATA.universities.length,
    });

    $('u_save').disabled = false;
    $('u_save').textContent = '💾 حفظ';

    if (error) return flash('فشل: ' + error.message, false);

    await loadAll();
    renderUniversities();
    flash('✅ تم الحفظ');
  };

  document.querySelectorAll('[data-del-uni]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الجامعة؟')) return;
      await sb.from('universities').delete().eq('id', b.dataset.delUni);
      await loadAll();
      renderUniversities();
      flash('🗑️ تم الحذف');
    };
  });
}

/* ============================================
   MAJORS
   ============================================ */
function renderMajors() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة تخصص</h2>
      <label>اسم التخصص</label>
      <input id="m_name" placeholder="مثال: الطب البشري">
      <div class="row">
        <button id="m_save">➕ إضافة</button>
      </div>
    </div>

    <div class="card">
      <h2>🎓 التخصصات (${DATA.majors.length})</h2>
      ${DATA.majors.length === 0 ? '<div class="empty">لا توجد تخصصات</div>' :
        DATA.majors.map(m => `
          <div class="item">
            <div class="item-info"><b>${esc(m.name)}</b></div>
            <button class="d" data-del-maj="${esc(m.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('m_save').onclick = async () => {
    const name = $('m_name').value.trim();
    if (!name) return flash('الاسم مطلوب', false);

    const { error } = await sb.from('majors').insert({
      id: newId(),
      name,
      sort_order: DATA.majors.length
    });

    if (error) return flash('فشل: ' + error.message, false);

    await loadAll();
    renderMajors();
    flash('✅ تمت الإضافة');
  };

  document.querySelectorAll('[data-del-maj]').forEach(b => {
    b.onclick = async () => {
      await sb.from('majors').delete().eq('id', b.dataset.delMaj);
      await loadAll();
      renderMajors();
    };
  });
}

/* ============================================
   SETTINGS (كل النصوص)
   ============================================ */
function renderSettings() {
  const get = k => (DATA.settings.find(s => s.key === k) || {}).value || '';

  const groups = [
    {
      title: '🏷️ الهوية والشعار',
      fields: [
        ['brand_name', 'اسم الأكاديمية'],
        ['brand_tagline', 'الوصف القصير'],
        ['brand_logo_url', 'رابط الشعار (URL)'],
        ['brand_description', 'وصف الفوتر'],
      ]
    },
    {
      title: '🎯 القسم الرئيسي (Hero)',
      fields: [
        ['hero_badge', 'الشارة الصغيرة'],
        ['hero_title', 'العنوان الرئيسي'],
        ['hero_subtitle', 'الوصف'],
        ['hero_btn1_text', 'نص الزر الأول'],
        ['hero_btn2_text', 'نص الزر الثاني'],
      ]
    },
    {
      title: '📖 قسم "من نحن"',
      fields: [
        ['about_title', 'العنوان'],
        ['about_subtitle', 'الوصف'],
        ['about_card1_title', 'كارت 1 — العنوان'],
        ['about_card1_desc', 'كارت 1 — الوصف'],
        ['about_card2_title', 'كارت 2 — العنوان'],
        ['about_card2_desc', 'كارت 2 — الوصف'],
        ['about_card3_title', 'كارت 3 — العنوان'],
        ['about_card3_desc', 'كارت 3 — الوصف'],
        ['about_card4_title', 'كارت 4 — العنوان'],
        ['about_card4_desc', 'كارت 4 — الوصف'],
      ]
    },
    {
      title: '🏛️ قسم الجامعات',
      fields: [
        ['universities_title', 'العنوان'],
        ['universities_subtitle', 'الوصف'],
      ]
    },
    {
      title: '📰 قسم الأخبار',
      fields: [
        ['news_title', 'العنوان'],
        ['news_subtitle', 'الوصف'],
      ]
    },
    {
      title: '🖼️ قسم معرض الصور',
      fields: [
        ['gallery_title', 'العنوان'],
        ['gallery_subtitle', 'الوصف'],
      ]
    },
    {
      title: '📞 قسم التواصل',
      fields: [
        ['contact_title', 'العنوان'],
        ['contact_subtitle', 'الوصف'],
        ['contact_phone', 'الهاتف'],
        ['contact_email', 'الإيميل'],
        ['contact_address', 'العنوان'],
      ]
    },
    {
      title: '🔗 السوشيال ميديا',
      fields: [
        ['social_facebook', 'فيسبوك'],
        ['social_twitter', 'تويتر / X'],
        ['social_instagram', 'إنستجرام'],
        ['social_youtube', 'يوتيوب'],
        ['social_whatsapp', 'واتساب'],
      ]
    },
    {
      title: '📄 الفوتر',
      fields: [
        ['footer_text', 'نص الحقوق'],
      ]
    },
  ];

  $('panel').innerHTML = `
    <div class="card">
      <h2>⚙️ إعدادات الموقع</h2>
      <p style="color:#45474c;font-size:13px;margin-bottom:20px">
        كل حاجة تكتبها هنا هتظهر في الموقع مباشرة.
      </p>
      ${groups.map(g => `
        <div class="settings-group">
          <h3>${g.title}</h3>
          ${g.fields.map(([k, l]) => `
            <label>${l}</label>
            <input id="set_${k}" value="${esc(get(k))}">
          `).join('')}
        </div>
      `).join('')}
      <div class="row" style="position:sticky;bottom:0;background:#fff;padding:16px;margin:0 -24px -24px;border-top:1px solid #e0e3e5">
        <button id="set_save" style="width:100%">💾 حفظ كل الإعدادات</button>
      </div>
    </div>
  `;

  $('set_save').onclick = async () => {
    $('set_save').disabled = true;
    $('set_save').textContent = '⏳ جاري الحفظ...';
    const allFields = groups.flatMap(g => g.fields);
    let failed = 0;
    for (const [k] of allFields) {
      const v = $('set_' + k).value;
      const { error } = await sb.from('settings').upsert({
        key: k,
        value: v,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('fail ' + k, error);
        failed++;
      }
    }
    $('set_save').disabled = false;
    $('set_save').textContent = '💾 حفظ كل الإعدادات';
    if (failed) flash(`فشل حفظ ${failed} حقل`, false);
    else {
      await loadAll();
      flash('✅ تم حفظ الإعدادات');
    }
  };
}

/* ============================================
   HELPERS
   ============================================ */
function previewImage(event, previewId) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = $(previewId);
    if (img) {
      img.src = e.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

/* ============================================
   START
   ============================================ */
init().catch(e => {
  console.error('Fatal:', e);
  document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ba1a1a;font-family:sans-serif">' +
    '<h1>خطأ في التحميل</h1>' +
    '<p style="margin-top:16px">' + esc(e.message || e) + '</p>' +
    '<p style="margin-top:16px;font-size:14px;color:#666">افتح Console (F12) لمعرفة التفاصيل</p>' +
    '</div>';
});