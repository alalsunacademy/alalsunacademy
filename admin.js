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

async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: isAdmin, error } = await sb.rpc('is_admin');
    if (error || !isAdmin) {
      if (session) await sb.auth.signOut();
      return showLogin('هذا الحساب ليس أدمن أو حدث خطأ في الصلاحيات');
    }
    await enterApp();
  } catch (e) {
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
  if (!em || !pw) return $('loginErr').textContent = 'اكتب الإيميل والباسورد';
  
  $('go').disabled = true;
  $('go').textContent = '⏳ جاري الدخول...';
  const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
  $('go').disabled = false;
  $('go').textContent = 'دخول';

  if (error) return $('loginErr').textContent = 'خطأ: ' + error.message;
  await init();
}

async function enterApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');

  $('logout').onclick = async () => {
    await sb.auth.signOut();
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
    sb.from('gallery').select('*').order('image_order', { ascending: true }).order('created_at', { ascending: false }),
    sb.from('announcements').select('*').order('created_at', { ascending: false }),
    sb.from('universities').select('*').order('sort_order'),
    sb.from('majors').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);

  const keys = ['news', 'gallery', 'announcements', 'universities', 'majors', 'settings'];
  results.forEach((r, i) => { DATA[keys[i]] = r.data || []; });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#nav button[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const titles = {
    news: '📰 إدارة الأخبار',
    gallery: '🖼️ معرض الصور والألبومات',
    announcements: '📢 الإعلانات والتنبيهات',
    universities: '🏛️ الجامعات والشركاء',
    majors: '🎓 التخصصات',
    settings: '⚙️ إعدادات وسقشنات الموقع'
  };
  $('pageTitle').textContent = titles[tab];
  renderTab();
}

function flash(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.style.cssText = `padding:10px 14px;border-radius:8px;margin-top:10px;font-size:13px;background:${ok?'#d1fae5':'#fee2e2'};color:${ok?'#0a7a3f':'#ba1a1a'}`;
  el.textContent = msg;
  $('panel').prepend(el);
  setTimeout(() => el.remove(), 4000);
}

async function uploadImage(file) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) { flash('فشل رفع الصورة: ' + error.message, false); return null; }
  const { data } = sb.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

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

function renderNews() {
  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;margin-bottom:16px;">
      <h2>➕ إضافة خبر جديد</h2>
      <label>العنوان *</label><input id="n_title" placeholder="عنوان الخبر">
      <label>الوصف المختصر</label><textarea id="n_summary" placeholder="سطر أو سطرين"></textarea>
      <label>صورة الخبر</label><input type="file" id="n_image" accept="image/*">
      <div style="margin-top:12px;"><button id="n_save">💾 حفظ الخبر</button></div>
    </div>
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;">
      <h2>📰 الأخبار المنشورة (${DATA.news.length})</h2>
      ${DATA.news.map(n => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #eee"><b>${esc(n.title)}</b><button style="background:#ba1a1a;color:#fff;padding:4px 10px;border-radius:6px;" data-del-news="${n.id}">حذف</button></div>`).join('')}
    </div>
  `;

  $('n_save').onclick = async () => {
    const title = $('n_title').value.trim();
    if (!title) return flash('العنوان مطلوب', false);
    const img = await uploadImage($('n_image').files[0]);
    await sb.from('news').insert({ id: newId(), title, summary: $('n_summary').value.trim(), image_url: img, published: true });
    await loadAll(); renderNews(); flash('✅ تم حفظ الخبر');
  };

  document.querySelectorAll('[data-del-news]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الخبر؟')) return;
      await sb.from('news').delete().eq('id', b.dataset.delNews);
      await loadAll(); renderNews(); flash('🗑️ تم الحذف');
    };
  });
}

function renderGallery() {
  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;margin-bottom:16px;">
      <h2>➕ إضافة صور أو ألبوم</h2>
      <label>نوع الإضافة</label>
      <select id="g_mode" style="margin-bottom:10px;"><option value="single">صورة واحدة</option><option value="album">ألبوم صور متعددة</option></select>
      <label>العنوان *</label><input id="g_title" placeholder="عنوان الألبوم أو الصورة">
      <label>الوصف</label><textarea id="g_desc" placeholder="وصف تفصيلي"></textarea>
      <label>الملف / الصور *</label><input type="file" id="g_file" accept="image/*" multiple>
      <div style="margin-top:12px;"><button id="g_save">💾 حفظ في المعرض</button></div>
    </div>
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;">
      <h2>🖼️ الصور والألبومات الحالية</h2>
      ${DATA.gallery.length === 0 ? '<div style="color:#666;">لا توجد صور</div>' : DATA.gallery.map(g => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #eee"><span><b>${esc(g.title)}</b> (${esc(g.category || 'عام')})</span><button style="background:#ba1a1a;color:#fff;padding:4px 10px;border-radius:6px;" data-del-gal="${g.id}">حذف</button></div>`).join('')}
    </div>
  `;

  $('g_save').onclick = async () => {
    const title = $('g_title').value.trim();
    const files = $('g_file').files;
    if (!title || files.length === 0) return flash('العنوان والصورة مطلوبان', false);

    $('g_save').disabled = true;
    $('g_save').textContent = '⏳ جاري الرفع...';

    const albumId = files.length > 1 ? newId() : null;
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i]);
      if (url) {
        await sb.from('gallery').insert({
          id: newId(),
          title,
          description: $('g_desc').value.trim(),
          image_url: url,
          album_id: albumId,
          image_order: i
        });
      }
    }

    $('g_save').disabled = false;
    $('g_save').textContent = '💾 حفظ في المعرض';
    await loadAll(); renderGallery(); flash('✅ تمت الإضافة بنجاح');
  };

  document.querySelectorAll('[data-del-gal]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف هذه الصورة؟')) return;
      await sb.from('gallery').delete().eq('id', b.dataset.delGal);
      await loadAll(); renderGallery(); flash('🗑️ تم الحذف');
    };
  });
}

function renderAnnouncements() {
  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;margin-bottom:16px;">
      <h2>➕ إضافة إعلان شريطي</h2>
      <label>نص الإعلان *</label><textarea id="a_text" placeholder="النص المتحرك..."></textarea>
      <label>رابط الإعلان (اختياري)</label><input id="a_link" placeholder="#contact">
      <div style="margin-top:12px;"><button id="a_save">💾 حفظ الإعلان</button></div>
    </div>
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;">
      <h2>📢 الإعلانات الحالية</h2>
      ${DATA.announcements.map(a => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #eee"><span><b>${esc(a.text)}</b></span><button style="background:#ba1a1a;color:#fff;padding:4px 10px;border-radius:6px;" data-del-ann="${a.id}">حذف</button></div>`).join('')}
    </div>
  `;
  $('a_save').onclick = async () => {
    const text = $('a_text').value.trim();
    if (!text) return flash('النص مطلوب', false);
    await sb.from('announcements').insert({ id: newId(), text, link: $('a_link').value.trim(), active: true });
    await loadAll(); renderAnnouncements(); flash('✅ تم الحفظ');
  };
  document.querySelectorAll('[data-del-ann]').forEach(b => {
    b.onclick = async () => {
      await sb.from('announcements').delete().eq('id', b.dataset.delAnn);
      await loadAll(); renderAnnouncements(); flash('🗑️ تم الحذف');
    };
  });
}

function renderUniversities() {
  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;margin-bottom:16px;">
      <h2>➕ إضافة جامعة</h2>
      <label>اسم الجامعة *</label><input id="u_name" placeholder="اسم الجامعة">
      <label>الموقع / الدولة</label><input id="u_loc" placeholder="مصر، الرياض...">
      <label>وصف الجامعة</label><textarea id="u_desc" placeholder="تفاصيل..."></textarea>
      <label>صورة الجامعة</label><input type="file" id="u_img" accept="image/*">
      <div style="margin-top:12px;"><button id="u_save">💾 حفظ الجامعة</button></div>
    </div>
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;">
      <h2>🏛️ الجامعات المسجلة</h2>
      ${DATA.universities.map(u => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #eee"><b>${esc(u.name)}</b><button style="background:#ba1a1a;color:#fff;padding:4px 10px;border-radius:6px;" data-del-uni="${u.id}">حذف</button></div>`).join('')}
    </div>
  `;
  $('u_save').onclick = async () => {
    const name = $('u_name').value.trim();
    if (!name) return flash('الاسم مطلوب', false);
    const img = await uploadImage($('u_img').files[0]);
    await sb.from('universities').insert({ id: newId(), name, location: $('u_loc').value.trim(), description: $('u_desc').value.trim(), image_url: img });
    await loadAll(); renderUniversities(); flash('✅ تم حفظ الجامعة');
  };
  document.querySelectorAll('[data-del-uni]').forEach(b => {
    b.onclick = async () => {
      await sb.from('universities').delete().eq('id', b.dataset.delUni);
      await loadAll(); renderUniversities(); flash('🗑️ تم الحذف');
    };
  });
}

function renderMajors() {
  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;margin-bottom:16px;">
      <h2>➕ إضافة تخصص دراسي</h2>
      <label>اسم التخصص *</label><input id="m_name" placeholder="مثال: هندسة البرمجيات">
      <div style="margin-top:12px;"><button id="m_save">💾 إضافة التخصص</button></div>
    </div>
    <div class="card" style="background:#fff;padding:18px;border-radius:12px;">
      <h2>🎓 التخصصات الحالية</h2>
      ${DATA.majors.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #eee"><b>${esc(m.name)}</b><button style="background:#ba1a1a;color:#fff;padding:4px 10px;border-radius:6px;" data-del-maj="${m.id}">حذف</button></div>`).join('')}
    </div>
  `;
  $('m_save').onclick = async () => {
    const name = $('m_name').value.trim();
    if (!name) return flash('اسم التخصص مطلوب', false);
    await sb.from('majors').insert({ id: newId(), name });
    await loadAll(); renderMajors(); flash('✅ تمت الإضافة');
  };
  document.querySelectorAll('[data-del-maj]').forEach(b => {
    b.onclick = async () => {
      await sb.from('majors').delete().eq('id', b.dataset.delMaj);
      await loadAll(); renderMajors(); flash('🗑️ تم الحذف');
    };
  });
}

function renderSettings() {
  const get = k => (DATA.settings.find(s => s.key === k) || {}).value || '';
  const fields = [
    ['brand_name', 'اسم الأكاديمية'],
    ['hero_title', 'عنوان الـ Hero الرئيسي'],
    ['hero_subtitle', 'وصف الـ Hero الفرعي'],
    ['about_title', 'عنوان سكشن من نحن'],
    ['universities_title', 'عنوان سكشن الجامعات'],
    ['news_title', 'عنوان سكشن الأخبار'],
    ['gallery_title', 'عنوان سكشن المعرض'],
    ['contact_phone', 'رقم الهاتف للتواصل'],
    ['contact_email', 'البريد الإلكتروني'],
    ['contact_address', 'العنوان الكامل']
  ];

  $('panel').innerHTML = `
    <div class="card" style="background:#fff;padding:24px;border-radius:12px;">
      <h2>⚙️ تحكم كامل بسقشنات ونصوص الموقع</h2>
      <p style="color:#666;font-size:13px;margin-bottom:20px;">أي تعديل هنا يظهر مباشرة على الموقع الرئيسي.</p>
      ${fields.map(([k, l]) => `<label>${l}</label><input id="set_${k}" value="${esc(get(k))}" style="margin-bottom:12px;">`).join('')}
      <div style="margin-top:20px;"><button id="set_save" style="width:100%;padding:12px;background:#0058be;color:#fff;font-weight:bold;border-radius:8px;">💾 حفظ كل التغييرات</button></div>
    </div>
  `;

  $('set_save').onclick = async () => {
    $('set_save').disabled = true;
    $('set_save').textContent = '⏳ جاري الحفظ...';
    for (const [k] of fields) {
      const v = $('set_' + k).value;
      await sb.from('settings').upsert({ key: k, value: v, updated_at: new Date().toISOString() });
    }
    $('set_save').disabled = false;
    $('set_save').textContent = '💾 حفظ كل التغييرات';
    await loadAll();
    flash('✅ تم حفظ كافة إعدادات السقشنات بنجاح');
  };
}

init();