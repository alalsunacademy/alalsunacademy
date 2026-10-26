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
    sb.from('gallery').select('*').order('image_order', { ascending: true }).order('created_at', { ascending: false }),
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
    console.error('upload error:', error);
    flash('فشل رفع الصورة: ' + error.message, false);
    return null;
  }
  const { data } = sb.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

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
   ROUTER
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
      <textarea id="n_summary" placeholder="سطر أو سطرين"></textarea>
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
      <div class="row"><button id="n_save">💾 حفظ الخبر</button></div>
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
   GALLERY (يدعم صورة واحدة أو ألبوم)
   ============================================ */
function renderGallery() {
  // تجميع الصور في ألبومات
  const albums = {};
  DATA.gallery.forEach(g => {
    const key = g.album_id || ('solo_' + g.id);
    if (!albums[key]) albums[key] = [];
    albums[key].push(g);
  });

  $('panel').innerHTML = `
    <div class="card">
      <h2>➕ إضافة صورة أو ألبوم جديد</h2>

      <label>نوع الإضافة</label>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;padding:10px 16px;border:2px solid var(--bd);border-radius:8px;flex:1">
          <input type="radio" name="g_mode" value="single" checked style="width:auto;margin:0">
          <span>🖼️ صورة واحدة</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;padding:10px 16px;border:2px solid var(--bd);border-radius:8px;flex:1">
          <input type="radio" name="g_mode" value="album" style="width:auto;margin:0">
          <span>📚 ألبوم (كذا صورة)</span>
        </label>
      </div>

      <label>العنوان *</label>
      <input id="g_title" placeholder="عنوان الصورة أو الألبوم">

      <label>الوصف</label>
      <textarea id="g_desc" placeholder="وصف مختصر"></textarea>

      <div class="grid2">
        <div>
          <label>التصنيف</label>
          <input id="g_category" value="عام">
        </div>
        <div>
          <label>السنة</label>
          <input id="g_year" type="number" value="${new Date().getFullYear()}">
        </div>
      </div>

      <label id="g_file_label">الصورة *</label>
      <input type="file" id="g_image" accept="image/*">
      <input type="file" id="g_images" accept="image/*" multiple style="display:none">

      <div id="g_previews" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:12px"></div>

      <div class="row"><button id="g_save">💾 حفظ</button></div>
    </div>

    <div class="card">
      <h2>🖼️ المحتوى المنشور (${Object.keys(albums).length} ألبوم / صورة)</h2>
      ${Object.keys(albums).length === 0 ? '<div class="empty">لا توجد صور بعد</div>' :
        Object.entries(albums).map(([key, imgs]) => {
          const first = imgs[0];
          const isAlbum = imgs.length > 1;
          return `
            <div class="item">
              <div style="position:relative;flex-shrink:0">
                <img src="${esc(first.image_url)}" class="thumb" onerror="this.style.background='#eee'">
                ${isAlbum ? `<span style="position:absolute;bottom:-4px;left:-4px;background:#0058be;color:#fff;font-size:10px;padding:2px 6px;border-radius:99px;font-weight:700">${imgs.length}</span>` : ''}
              </div>
              <div class="item-info">
                <b>${esc(first.title)} ${isAlbum ? '📚' : ''}</b>
                <span>${esc(first.description || '—')}</span>
                <span class="pill">${esc(first.category || 'عام')} • ${first.year || ''}${isAlbum ? ' • ' + imgs.length + ' صورة' : ''}</span>
              </div>
              <button class="d" data-del-album="${esc(key)}">حذف</button>
            </div>
          `;
        }).join('')}
    </div>
  `;

  // تبديل بين "صورة" و "ألبوم"
  const radios = document.querySelectorAll('input[name="g_mode"]');
  radios.forEach(r => {
    r.onchange = () => {
      const isAlbum = document.querySelector('input[name="g_mode"]:checked').value === 'album';
      $('g_image').style.display = isAlbum ? 'none' : 'block';
      $('g_images').style.display = isAlbum ? 'block' : 'none';
      $('g_file_label').textContent = isAlbum ? 'الصور (اختر كذا صورة) *' : 'الصورة *';
      $('g_previews').innerHTML = '';
      $('g_image').value = '';
      $('g_images').value = '';
    };
  });

  // معاينة الصور
  const handlePreview = (input) => {
    input.onchange = e => {
      const files = Array.from(e.target.files);
      const wrap = $('g_previews');
      wrap.innerHTML = '';
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const div = document.createElement('div');
          div.style.cssText = 'position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid #e0e3e5';
          div.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
          wrap.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    };
  };
  handlePreview($('g_image'));
  handlePreview($('g_images'));

  // الحفظ
  $('g_save').onclick = async () => {
    const title = $('g_title').value.trim();
    const mode = document.querySelector('input[name="g_mode"]:checked').value;
    if (!title) return flash('العنوان مطلوب', false);

    $('g_save').disabled = true;
    $('g_save').textContent = '⏳ جاري الرفع...';

    const desc = $('g_desc').value.trim();
    const category = $('g_category').value.trim() || 'عام';
    const year = parseInt($('g_year').value) || new Date().getFullYear();

    if (mode === 'single') {
      const file = $('g_image').files[0];
      if (!file) {
        $('g_save').disabled = false;
        $('g_save').textContent = '💾 حفظ';
        return flash('الصورة مطلوبة', false);
      }

      const url = await uploadImage(file);
      if (!url) {
        $('g_save').disabled = false;
        $('g_save').textContent = '💾 حفظ';
        return;
      }

      const { error } = await sb.from('gallery').insert({
        id: newId(),
        title, description: desc, category, year,
        image_url: url,
        album_id: null,
        image_order: 0,
      });

      $('g_save').disabled = false;
      $('g_save').textContent = '💾 حفظ';

      if (error) return flash('فشل: ' + error.message, false);

    } else {
      const files = Array.from($('g_images').files);
      if (files.length === 0) {
        $('g_save').disabled = false;
        $('g_save').textContent = '💾 حفظ';
        return flash('اختر صورة واحدة على الأقل', false);
      }

      const albumId = newId();
      let failed = 0;

      for (let i = 0; i < files.length; i++) {
        const url = await uploadImage(files[i]);
        if (!url) { failed++; continue; }

        const { error } = await sb.from('gallery').insert({
          id: newId(),
          title, description: desc, category, year,
          image_url: url,
          album_id: albumId,
          image_order: i,
        });

        if (error) {
          console.error('album insert error:', error);
          failed++;
        }
      }

      $('g_save').disabled = false;
      $('g_save').textContent = '💾 حفظ';

      if (failed > 0) return flash(`فشل ${failed} من ${files.length} صورة`, false);
    }

    await loadAll();
    renderGallery();
    flash('✅ تم الحفظ');
  };

  // الحذف
  document.querySelectorAll('[data-del-album]').forEach(b => {
    b.onclick = async () => {
      const key = b.dataset.delAlbum;
      const isSolo = key.startsWith('solo_');
      const label = isSolo ? 'الصورة' : 'الألبوم كامل (كل صوره)';
      if (!confirm(`حذف ${label}؟`)) return;

      if (isSolo) {
        const id = key.replace('solo_', '');
        await sb.from('gallery').delete().eq('id', id);
      } else {
        await sb.from('gallery').delete().eq('album_id', key);
      }
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
      <textarea id="a_text" placeholder="نص الإعلان"></textarea>
      <label>رابط (اختياري)</label>
      <input id="a_link" placeholder="#contact">
      <div class="row"><button id="a_save">💾 حفظ الإعلان</button></div>
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
        <div><label>الاسم *</label><input id="u_name" placeholder="اسم الجامعة"></div>
        <div><label>الموقع</label><input id="u_loc" placeholder="القاهرة، مصر"></div>
      </div>
      <label>الوصف</label>
      <textarea id="u_desc" placeholder="نبذة عن الجامعة"></textarea>
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
      <div class="row"><button id="u_save">💾 حفظ</button></div>
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
      <div class="row"><button id="m_save">➕ إضافة</button></div>
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
      id: newId(), name, sort_order: DATA.majors.length
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
   SETTINGS
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
      fields: [['footer_text', 'نص الحقوق']]
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
        key: k, value: v, updated_at: new Date().toISOString()
      });
      if (error) { console.error('fail ' + k, error); failed++; }
    }
    $('set_save').disabled = false;
    $('set_save').textContent = '💾 حفظ كل الإعدادات';
    if (failed) flash(`فشل حفظ ${failed} حقل`, false);
    else { await loadAll(); flash('✅ تم حفظ الإعدادات'); }
  };
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