-- =============================================================================
-- 0003_profiles_participants.sql  —  테이블 확장
-- -----------------------------------------------------------------------------
-- 관계 모델링을 두 가지 더 보여주기 위한 확장:
--   profiles                : auth.users 와 1:1  (앱용 사용자 정보: 이름/부서)
--   reservation_participants: 예약 ↔ 사용자 M:N  (회의 참석자)
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run (0001, 0002 적용 이후)
-- =============================================================================

-- [1] profiles : auth.users 와 1:1 -------------------------------------------
-- auth.users 는 Supabase 가 관리(이메일 등)하므로 직접 컬럼을 못 늘린다.
-- 그래서 PK = FK(auth.users.id) 인 1:1 테이블을 따로 둬서 앱 정보를 담는다.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department   text
);

-- 회원가입(auth.users insert) 시 profiles 행을 자동 생성하는 트리거.
-- security definer: RLS/권한을 우회해 시스템 권한으로 insert (표준 Supabase 패턴).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, department)
  values (
    new.id,
    -- 가입 시 넘긴 이름이 있으면 그걸, 없으면 이메일 아이디 부분을 기본값으로
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'department'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- [2] reservation_participants : 예약 ↔ 사용자 M:N ---------------------------
-- 하나의 예약에 여러 참석자, 한 사용자가 여러 예약에 참석 → 다대다.
-- 조인 테이블 + 복합 기본키(두 FK의 조합)로 "같은 사람을 같은 예약에 중복 추가" 방지.
create table reservation_participants (
  reservation_id int  not null references reservations(id) on delete cascade,
  user_id        uuid not null references profiles(id)     on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (reservation_id, user_id)
);


-- [3] 권한(GRANT) + RLS -------------------------------------------------------
grant select, update on profiles                 to anon, authenticated;
grant select, insert, delete on reservation_participants to anon, authenticated;

alter table profiles                 enable row level security;
alter table reservation_participants enable row level security;

-- profiles: 이름은 누구나 조회 가능(목록에 표시), 수정은 본인만
create policy "profiles are viewable by everyone"
  on profiles for select using (true);
create policy "users can update own profile"
  on profiles for update to authenticated using (id = auth.uid());

-- participants: 조회는 누구나
create policy "participants are viewable by everyone"
  on reservation_participants for select using (true);

-- 추가는 "본인이 참석(자기 자신 추가)" 하거나 "그 예약의 주인(호스트)" 일 때만
create policy "join or host can add participant"
  on reservation_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from reservations r
      where r.id = reservation_id and r.user_id = auth.uid()
    )
  );

-- 삭제도 동일한 조건(본인이 빠지거나, 호스트가 제외)
create policy "leave or host can remove participant"
  on reservation_participants for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from reservations r
      where r.id = reservation_id and r.user_id = auth.uid()
    )
  );
