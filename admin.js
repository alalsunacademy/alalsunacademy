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

/* ========== LOGIN ========== */
async function init() {
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) { await sb.auth.signOut(); return showLogin('هذا الحساب ليس أدمن'); }
  enterApp();
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
  const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
  $('go').disabled = false;
  if (error) return $('loginErr').textContent = 'الإيميل أو الباسورد غلط';
  init();
}

/* ========== APP ========== */
async function enterApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('logout').onclick = async () => { await sb.auth.signOut(); showLogin(); };
  document.querySelectorAll('.sidebar nav button[data-tab]').forEach(b => {
    b.onclick = () => switchTab(b.dataset.tab);
  });
  await loadAll();
  switchTab('news');
}

async function loadAll() {
  const [n,g,a,u,m,s] = await Promise.all([
    sb.from('news').select('*').order('created_at',{ascending:false}),
    sb.from('gallery').select('*').order('created_at',{ascending:false}),
    sb.from('announcements').select('*').order('created_at',{ascending:false}),
    sb.from('universities').select('*').order('sort_order'),
    sb.from('majors').select('*').order('sort_order'),
    sb.from('settings').select('*'),
  ]);
  if (n.error) console.error(n.error);
  DATA.news = n.data || [];
  DATA.gallery = g.data || [];
  DATA.announcements = a.data || [];
  DATA.universities = u.data || [];
  DATA.majors = m.data || [];
  DATA.settings = s.data || [];
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.sidebar nav button[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const titles = {news:'الأخبار',gallery:'معرض الصور',announcements:'الإعلانات',
    universities:'الجامعات والشركاء',majors:'التخصصات',settings:'الإعدادات'};
  $('pageTitle').textContent = titles[tab];
  renderTab();
}

/* ========== HELPERS ========== */
function flash(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
  $('panel').prepend(el);
  setTimeout(() => el.remove(), 3500);
}

async function uploadImage(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file);
  if (error) { flash('فشل رفع الصورة: ' + error.message, false); return null; }
  const { data } = sb.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

/* ========== RENDER: NEWS ========== */
function renderTab() {
  if (currentTab === 'news') renderNews();
  else if (currentTab === 'gallery') renderGallery();
  else if (currentTab === 'announcements') renderAnnouncements();
  else if (currentTab === 'universities') renderUniversities();
  else if (currentTab === 'majors') renderMajors();
  else if (currentTab === 'settings') renderSettings();
}

function renderNews() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة خبر جديد</h2>
      <label>العنوان *</label>
      <input id="n_title">
      <label>الوصف المختصر</label>
      <textarea id="n_summary"></textarea>
      <label>المحتوى الكامل</label>
      <textarea id="n_content"></textarea>
      <div class="grid2">
        <div>
          <label>التصنيف</label>
          <input id="n_category" value="عام">
        </div>
        <div>
          <label>صورة الخبر</label>
          <input type="file" id="n_image" accept="image/*">
          <img id="n_preview" class="preview">
        </div>
      </div>
      <div class="row">
        <button id="n_save">حفظ الخبر</button>
      </div>
    </div>
    <div class="card">
      <h2>📰 الأخبار المنشورة (${DATA.news.length})</h2>
      ${DATA.news.length === 0 ? '<div class="empty">لا توجد أخبار بعد</div>' :
        DATA.news.map(n => `
          <div class="item">
            ${n.image_url ? `<img src="${esc(n.image_url)}" class="thumb">` : '<div class="thumb"></div>'}
            <div class="item-info">
              <b>${esc(n.title)}</b>
              <span>${esc(n.summary || '')}</span>
              <span class="pill">${esc(n.category || 'عام')}</span>
            </div>
            <button class="d" data-del-news="${esc(n.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('n_image').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { const img = $('n_preview'); img.src = ev.target.result; img.style.display = 'block'; };
    r.readAsDataURL(f);
  };

  $('n_save').onclick = async () => {
    const title = $('n_title').value.trim();
    if (!title) return flash('العنوان مطلوب', false);
    $('n_save').disabled = true;
    const img = await uploadImage($('n_image').files[0]);
    const { error } = await sb.from('news').insert({
      id: newId(),
      title,
      summary: $('n_summary').value.trim(),
      content: $('n_content').value.trim(),
      category: $('n_category').value.trim() || 'عام',
      image_url: img,
    });
    $('n_save').disabled = false;
    if (error) return flash('فشل الحفظ: ' + error.message, false);
    await loadAll(); renderNews(); flash('تم حفظ الخبر ✅');
  };

  document.querySelectorAll('[data-del-news]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الخبر؟')) return;
      await sb.from('news').delete().eq('id', b.dataset.delNews);
      await loadAll(); renderNews(); flash('تم الحذف');
    };
  });
}

/* ========== RENDER: GALLERY ========== */
function renderGallery() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة صورة جديدة</h2>
      <label>العنوان *</label>
      <input id="g_title">
      <label>الوصف</label>
      <textarea id="g_desc"></textarea>
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
        <button id="g_save">حفظ الصورة</button>
      </div>
    </div>
    <div class="card">
      <h2>🖼️ الصور (${DATA.gallery.length})</h2>
      ${DATA.gallery.length === 0 ? '<div class="empty">لا توجد صور بعد</div>' :
        DATA.gallery.map(g => `
          <div class="item">
            <img src="${esc(g.image_url)}" class="thumb">
            <div class="item-info">
              <b>${esc(g.title)}</b>
              <span>${esc(g.description || '')}</span>
              <span class="pill">${esc(g.category || 'عام')} • ${g.year || ''}</span>
            </div>
            <button class="d" data-del-gal="${esc(g.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('g_image').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { const img = $('g_preview'); img.src = ev.target.result; img.style.display = 'block'; };
    r.readAsDataURL(f);
  };

  $('g_save').onclick = async () => {
    const title = $('g_title').value.trim();
    const file = $('g_image').files[0];
    if (!title) return flash('العنوان مطلوب', false);
    if (!file) return flash('الصورة مطلوبة', false);
    $('g_save').disabled = true;
    const url = await uploadImage(file);
    if (!url) { $('g_save').disabled = false; return; }
    const { error } = await sb.from('gallery').insert({
      id: newId(), title,
      description: $('g_desc').value.trim(),
      category: $('g_category').value.trim() || 'عام',
      year: parseInt($('g_year').value) || new Date().getFullYear(),
      image_url: url,
    });
    $('g_save').disabled = false;
    if (error) return flash('فشل الحفظ: ' + error.message, false);
    await loadAll(); renderGallery(); flash('تم حفظ الصورة ✅');
  };

  document.querySelectorAll('[data-del-gal]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الصورة؟')) return;
      await sb.from('gallery').delete().eq('id', b.dataset.delGal);
      await loadAll(); renderGallery(); flash('تم الحذف');
    };
  });
}

/* ========== RENDER: ANNOUNCEMENTS ========== */
function renderAnnouncements() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة إعلان / تنبيه</h2>
      <label>النص *</label>
      <textarea id="a_text"></textarea>
      <label>رابط (اختياري)</label>
      <input id="a_link" placeholder="#quick-contact">
      <div class="row"><button id="a_save">حفظ الإعلان</button></div>
    </div>
    <div class="card">
      <h2>📢 الإعلانات (${DATA.announcements.length})</h2>
      ${DATA.announcements.length === 0 ? '<div class="empty">لا توجد إعلانات</div>' :
        DATA.announcements.map(a => `
          <div class="item">
            <div class="item-info">
              <b>${esc(a.text)}</b>
              <span>${esc(a.link || '')}</span>
              <span class="pill">${a.active ? 'نشط' : 'موقوف'}</span>
            </div>
            <button class="s" data-tog-ann="${esc(a.id)}">${a.active ? 'إيقاف' : 'تفعيل'}</button>
            <button class="d" data-del-ann="${esc(a.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('a_save').onclick = async () => {
    const text = $('a_text').value.trim();
    if (!text) return flash('النص مطلوب', false);
    const { error } = await sb.from('announcements').insert({
      id: newId(), text, link: $('a_link').value.trim() || null, active: true,
    });
    if (error) return flash('فشل: ' + error.message, false);
    await loadAll(); renderAnnouncements(); flash('تم الحفظ ✅');
  };

  document.querySelectorAll('[data-del-ann]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف الإعلان؟')) return;
      await sb.from('announcements').delete().eq('id', b.dataset.delAnn);
      await loadAll(); renderAnnouncements(); flash('تم الحذف');
    };
  });
  document.querySelectorAll('[data-tog-ann]').forEach(b => {
    b.onclick = async () => {
      const a = DATA.announcements.find(x => x.id === b.dataset.togAnn);
      if (!a) return;
      await sb.from('announcements').update({ active: !a.active }).eq('id', a.id);
      await loadAll(); renderAnnouncements();
    };
  });
}

/* ========== RENDER: UNIVERSITIES ========== */
function renderUniversities() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة جامعة / شريك</h2>
      <div class="grid2">
        <div><label>الاسم *</label><input id="u_name"></div>
        <div><label>الموقع</label><input id="u_loc" placeholder="القاهرة، مصر"></div>
      </div>
      <label>الوصف</label>
      <textarea id="u_desc"></textarea>
      <div class="grid2">
        <div><label>شارة (اختياري)</label><input id="u_badge" placeholder="معتمدة دولياً"></div>
        <div><label>السعر يبدأ من</label><input id="u_price" placeholder="$3,200 / سنوي"></div>
      </div>
      <div class="grid2">
        <div><label>التصنيف (بلد)</label><input id="u_cat" placeholder="مصر"></div>
        <div><label>التخصصات (مفصولة بفاصلة)</label><input id="u_majors" placeholder="الهندسة, الطب"></div>
      </div>
      <label>صورة الجامعة</label>
      <input type="file" id="u_image" accept="image/*">
      <img id="u_preview" class="preview">
      <div class="row"><button id="u_save">حفظ</button></div>
    </div>
    <div class="card">
      <h2>🏛️ الجامعات (${DATA.universities.length})</h2>
      ${DATA.universities.length === 0 ? '<div class="empty">لا توجد جامعات</div>' :
        DATA.universities.map(u => `
          <div class="item">
            ${u.image_url ? `<img src="${esc(u.image_url)}" class="thumb">` : '<div class="thumb"></div>'}
            <div class="item-info">
              <b>${esc(u.name)}</b>
              <span>${esc(u.location || '')} — ${esc(u.description || '')}</span>
            </div>
            <button class="d" data-del-uni="${esc(u.id)}">حذف</button>
          </div>
        `).join('')}
    </div>
  `;

  $('u_image').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { const img = $('u_preview'); img.src = ev.target.result; img.style.display = 'block'; };
    r.readAsDataURL(f);
  };

  $('u_save').onclick = async () => {
    const name = $('u_name').value.trim();
    if (!name) return flash('الاسم مطلوب', false);
    $('u_save').disabled = true;
    const img = await uploadImage($('u_image').files[0]);
    const majors = $('u_majors').value.split(',').map(x => x.trim()).filter(Boolean);
    const { error } = await sb.from('universities').insert({
      id: newId(), name,
      location: $('u_loc').value.trim(),
      description: $('u_desc').value.trim(),
      badge: $('u_badge').value.trim(),
      price_from: $('u_price').value.trim(),
      category: $('u_cat').value.trim(),
      majors, image_url: img,
      sort_order: DATA.universities.length,
    });
    $('u_save').disabled = false;
    if (error) return flash('فشل: ' + error.message, false);
    await loadAll(); renderUniversities(); flash('تم الحفظ ✅');
  };

  document.querySelectorAll('[data-del-uni]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('حذف؟')) return;
      await sb.from('universities').delete().eq('id', b.dataset.delUni);
      await loadAll(); renderUniversities(); flash('تم الحذف');
    };
  });
}

/* ========== RENDER: MAJORS ========== */
function renderMajors() {
  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة تخصص</h2>
      <label>اسم التخصص</label>
      <input id="m_name">
      <div class="row"><button id="m_save">إضافة</button></div>
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
    const { error } = await sb.from('majors').insert({ id: newId(), name, sort_order: DATA.majors.length });
    if (error) return flash('فشل: ' + error.message, false);
    await loadAll(); renderMajors(); flash('تم ✅');
  };

  document.querySelectorAll('[data-del-maj]').forEach(b => {
    b.onclick = async () => {
      await sb.from('majors').delete().eq('id', b.dataset.delMaj);
      await loadAll(); renderMajors();
    };
  });
}

/* ========== RENDER: SETTINGS ========== */
function renderSettings() {
  const get = k => (DATA.settings.find(s => s.key === k) || {}).value || '';
  const fields = [
    ['social_facebook','فيسبوك'],['social_twitter','تويتر/X'],
    ['social_instagram','إنستجرام'],['social_youtube','يوتيوب'],
    ['social_whatsapp','واتساب'],
    ['contact_phone','الهاتف'],['contact_email','الإيميل'],
    ['contact_address','العنوان'],
  ];
  $('panel').innerHTML = `
    <div class="card">
      <h2>⚙️ الروابط والإعدادات</h2>
      ${fields.map(([k,l]) => `
        <label>${l}</label>
        <input id="set_${k}" value="${esc(get(k))}">
      `).join('')}
      <div class="row"><button id="set_save">حفظ الإعدادات</button></div>
    </div>
  `;

  $('set_save').onclick = async () => {
    $('set_save').disabled = true;
    for (const [k] of fields) {
      const v = $('set_' + k).value.trim();
      await sb.from('settings').upsert({ key: k, value: v });
    }
    $('set_save').disabled = false;
    await loadAll(); flash('تم الحفظ ✅');
  };
}

/* ========== START ========== */
init().catch(e => {
  console.error(e);
  document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ba1a1a">خطأ: ' + esc(e.message) + '</div>';
});