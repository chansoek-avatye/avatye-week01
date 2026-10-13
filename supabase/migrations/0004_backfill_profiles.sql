-- =============================================================================
-- 0004_backfill_profiles.sql  —  기존 사용자 profiles 채우기
-- -----------------------------------------------------------------------------
-- 0003 의 트리거(handle_new_user)는 "적용 이후 가입한 사용자"에게만 profiles 를 만든다.
-- 그 전에 가입한 사용자는 profiles 행이 없어서,
--   reservation_participants.user_id → profiles(id) FK 를 위반하게 된다.
-- 이미 있는 auth.users 전원에 대해 profiles 를 한 번 채워준다(backfill).
--
-- on conflict do nothing : 이미 profiles 가 있는 사용자는 건드리지 않음 → 여러 번 실행해도 안전
-- =============================================================================

insert into public.profiles (id, display_name, department)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'department'
from auth.users u
on conflict (id) do nothing;
