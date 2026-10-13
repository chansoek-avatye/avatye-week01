-- =============================================================================
-- 0001_init.sql  —  회의실 예약 서비스 초기 스키마
-- -----------------------------------------------------------------------------
-- 핵심 목표:
--   "같은 회의실 + 겹치는 시간"의 예약을 DB 레벨에서 원자적으로 차단한다.
--   (애플리케이션 코드가 아니라 DB 제약으로 막기 때문에 동시 요청에도 안전)
--
-- 실행 방법(둘 중 하나):
--   1) Supabase 대시보드 > SQL Editor 에 이 파일 내용을 붙여넣고 Run
--   2) supabase CLI 사용 시: supabase db push
-- =============================================================================


-- [1] 확장(extension) -----------------------------------------------------------
-- 시간 "범위(range)"끼리 겹침(&&)을 비교하는 배타 제약(EXCLUSION)을 쓰려면
-- btree_gist 확장이 필요하다. (= 같은 room_id 비교를 gist 인덱스에서 하기 위함)
create extension if not exists btree_gist;


-- [2] 회의실 --------------------------------------------------------------------
create table rooms (
  id         int generated always as identity primary key,
  name       text not null,
  -- TODO: 수용 인원/위치/층 같은 컬럼이 필요하면 직접 추가해보기
  capacity   int  not null default 0 check (capacity >= 0),
  created_at timestamptz not null default now()
);


-- [3] 예약 상태 ------------------------------------------------------------------
-- 'confirmed'(확정) / 'cancelled'(취소) 두 가지로 시작.
-- 상태를 enum 으로 두면 오타/잘못된 값이 DB 레벨에서 막힌다.
create type reservation_status as enum ('confirmed', 'cancelled');


-- [4] 예약 ----------------------------------------------------------------------
-- user_id 는 Supabase Auth 가 관리하는 auth.users(id: uuid) 를 참조한다.
-- (회원가입을 Supabase Auth 로 처리하면 이 테이블은 자동으로 채워짐)
create table reservations (
  id         int generated always as identity primary key,
  room_id    int not null references rooms(id)      on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  title      text,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  status     reservation_status not null default 'confirmed',
  created_at timestamptz not null default now(),

  -- 끝시간은 반드시 시작시간보다 뒤여야 한다.
  constraint reservations_time_valid check (start_at < end_at),

  -- ★★★★★ 이번 과제의 핵심 제약 ★★★★★
  -- "같은 회의실(room_id WITH =) 이면서
  --  시간 구간이 겹치는(tstzrange(start_at,end_at) WITH &&)
  --  확정(status='confirmed') 예약" 은 두 개가 동시에 존재할 수 없다.
  --
  --  → INSERT 시점에 DB가 원자적으로 검사하므로, 동시 요청 2개가 와도
  --    하나만 성공하고 나머지는 에러(SQLSTATE 23P01)를 돌려준다.
  --  → WHERE 로 'confirmed' 에만 적용 → 취소된 예약은 겹쳐도 무방.
  constraint reservations_no_overlap exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed')
);

-- 특정 방의 특정 기간 예약을 빠르게 조회하기 위한 인덱스.
create index reservations_room_start_idx on reservations (room_id, start_at);


-- [5] 시드 데이터 (발표 데모용 회의실 몇 개) -------------------------------------
insert into rooms (name, capacity) values
  ('소회의실 A', 4),
  ('중회의실 B', 8),
  ('대회의실 C', 16);


-- [6] Row Level Security (선택 / 가산점) ----------------------------------------
-- Supabase 는 클라이언트가 anon key 로 DB에 직접 접근할 수 있으므로,
-- "누가 무엇을 할 수 있는지"를 RLS 정책으로 막는 게 정석이다.
-- 처음엔 끄고 API 라우트(서버)에서만 접근하도록 해도 되지만,
-- 발표 때 "보안도 DB 레벨에서 고려했다"고 말하려면 아래를 켜보자.
--
-- alter table rooms        enable row level security;
-- alter table reservations enable row level security;
--
-- -- 회의실은 로그인한 누구나 조회 가능
-- create policy "rooms are viewable" on rooms
--   for select using (auth.role() = 'authenticated');
--
-- -- 예약은 로그인한 누구나 조회 가능
-- create policy "reservations are viewable" on reservations
--   for select using (auth.role() = 'authenticated');
--
-- -- 예약 생성은 본인(user_id = 로그인한 사람) 것만
-- create policy "insert own reservation" on reservations
--   for insert with check (user_id = auth.uid());
--
-- -- TODO: 취소(update/delete)는 본인 예약만 가능하도록 정책을 직접 작성해보기
-- -- create policy "..." on reservations for update using ( ___ );
