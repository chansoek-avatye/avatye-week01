-- 0004_backfill_profiles.sql — 트리거 이전 가입자 profiles 채우기 (on conflict do nothing 으로 재실행 안전)

insert into public.profiles (id, display_name, department)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'department'
from auth.users u
on conflict (id) do nothing;
