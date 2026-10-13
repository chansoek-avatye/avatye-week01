-- =============================================================================
-- 0002_policies.sql  —  접근 권한(RLS) 설정
-- -----------------------------------------------------------------------------
-- "permission denied for table rooms" = 이 키(역할)로는 테이블을 못 읽는다는 뜻.
-- Supabase 는 "명시적으로 허용하지 않으면 막는다"가 기본이라, 권한을 정해줘야 한다.
--
-- 두 겹으로 설정한다:
--   1) GRANT      : 역할(anon=비로그인, authenticated=로그인)에게 테이블 접근 자체를 허용
--   2) RLS Policy : 그 중에서도 "어떤 행을, 어떤 조건에서" 다룰 수 있는지 세부 규칙
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
-- =============================================================================

-- [1] 역할에 테이블 접근 권한 부여 -----------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on rooms                      to anon, authenticated;
grant select, insert, update on reservations to anon, authenticated;


-- [2] RLS 켜기 ------------------------------------------------------------------
-- RLS 를 켜면, 아래 정책(policy)에 해당하는 행만 보이고/다룰 수 있게 된다.
alter table rooms        enable row level security;
alter table reservations enable row level security;


-- [3] 조회 정책 -----------------------------------------------------------------
-- 회의실 목록은 누구나 볼 수 있게 (using (true) = 모든 행 허용)
create policy "rooms are viewable by everyone"
  on rooms for select
  using (true);

-- 예약 현황도 누구나 볼 수 있게 (공유 캘린더처럼)
create policy "reservations are viewable by everyone"
  on reservations for select
  using (true);


-- [4] 쓰기 정책 (예약 생성/취소는 "로그인한 본인" 것만) --------------------------
-- with check: INSERT 하려는 행의 user_id 가 로그인한 사람(auth.uid())과 같아야 함
create policy "users can insert own reservation"
  on reservations for insert
  to authenticated
  with check (user_id = auth.uid());

-- using: UPDATE 대상 행이 본인 것일 때만 (예약 취소 = status 변경)
create policy "users can update own reservation"
  on reservations for update
  to authenticated
  using (user_id = auth.uid());
