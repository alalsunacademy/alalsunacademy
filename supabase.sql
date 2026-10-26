-- =====================================================
-- أكاديميا نكست — Schema كامل
-- نفّذ الملف ده كامل في Supabase SQL Editor
-- =====================================================

-- 1) جدول الأخبار
create table if not exists public.news (
  id text primary key,
  title text not null,
  summary text,
  content text,
  image_url text,
  category text default 'عام',
  published boolean default true,
  created_at timestamptz default now()
);

-- 2) جدول معرض الصور
create table if not exists public.gallery (
  id text primary key,
  title text not null,
  description text,
  image_url text not null,
  category text default 'عام',
  year int default extract(year from now()),
  created_at timestamptz default now()
);

-- 3) جدول الإعلانات والتنبيهات
create table if not exists public.announcements (
  id text primary key,
  text text not null,
  link text,
  active boolean default true,
  created_at timestamptz default now()
);

-- 4) جدول الجامعات والشركاء
create table if not exists public.universities (
  id text primary key,
  name text not null,
  location text,
  description text,
  image_url text,
  badge text,
  price_from text,
  majors text[],           -- مصفوفة التخصصات
  category text,           -- مصر / ماليزيا / تركيا ...
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 5) جدول التخصصات (الـ pills)
create table if not exists public.majors (
  id text primary key,
  name text not null,
  sort_order int default 0
);

-- 6) جدول الإعدادات (الروابط + النصوص العامة)
create table if not exists public.settings (
  key text primary key,
  value text
);

-- إعدادات افتراضية للروابط
insert into public.settings (key, value) values
  ('social_facebook', '#'),
  ('social_twitter',  '#'),
  ('social_instagram','#'),
  ('social_youtube',  '#'),
  ('social_whatsapp', '#'),
  ('contact_phone',   '+966 11 400 9988'),
  ('contact_email',   'contact@academianext.edu.sa'),
  ('contact_address', 'الرياض، حي النخيل، طريق الملك عبد العزيز')
on conflict (key) do nothing;

-- =====================================================
-- دالة is_admin
-- =====================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- =====================================================
-- RLS — تفعيل + سياسات
-- =====================================================

alter table public.news          enable row level security;
alter table public.gallery       enable row level security;
alter table public.announcements enable row level security;
alter table public.universities  enable row level security;
alter table public.majors        enable row level security;
alter table public.settings      enable row level security;

-- الجميع يقرأ، الأدمن فقط يكتب

-- NEWS
drop policy if exists "news_read"  on public.news;
drop policy if exists "news_write" on public.news;
create policy "news_read"  on public.news for select using (true);
create policy "news_write" on public.news for all
  using (public.is_admin()) with check (public.is_admin());

-- GALLERY
drop policy if exists "gallery_read"  on public.gallery;
drop policy if exists "gallery_write" on public.gallery;
create policy "gallery_read"  on public.gallery for select using (true);
create policy "gallery_write" on public.gallery for all
  using (public.is_admin()) with check (public.is_admin());

-- ANNOUNCEMENTS
drop policy if exists "ann_read"  on public.announcements;
drop policy if exists "ann_write" on public.announcements;
create policy "ann_read"  on public.announcements for select using (true);
create policy "ann_write" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- UNIVERSITIES
drop policy if exists "uni_read"  on public.universities;
drop policy if exists "uni_write" on public.universities;
create policy "uni_read"  on public.universities for select using (true);
create policy "uni_write" on public.universities for all
  using (public.is_admin()) with check (public.is_admin());

-- MAJORS
drop policy if exists "maj_read"  on public.majors;
drop policy if exists "maj_write" on public.majors;
create policy "maj_read"  on public.majors for select using (true);
create policy "maj_write" on public.majors for all
  using (public.is_admin()) with check (public.is_admin());

-- SETTINGS
drop policy if exists "set_read"  on public.settings;
drop policy if exists "set_write" on public.settings;
create policy "set_read"  on public.settings for select using (true);
create policy "set_write" on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================
-- Storage Policies لبَكِت media
-- (لازم تعمل البكت يدويًا من Storage → New Bucket → "media" → Public ON)
-- =====================================================

drop policy if exists "media_read"  on storage.objects;
drop policy if exists "media_write" on storage.objects;

create policy "media_read" on storage.objects for select
  using (bucket_id = 'media');

create policy "media_write" on storage.objects for all
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());