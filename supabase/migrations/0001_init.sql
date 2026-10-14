-- 0001_init.sql — 회의실 예약 초기 스키마 (같은 방·겹치는 시간 예약을 DB 제약으로 차단)


-- [1] 확장 — room_id = 비교를 gist 배타 제약에 쓰기 위한 btree_gist
create extension if not exists btree_gist;


-- [2] 회의실 --------------------------------------------------------------------
create table rooms (
  id         int generated always as identity primary key,
  name       text not null,
  -- TODO: 수용 인원/위치/층 같은 컬럼이 필요하면 직접 추가해보기
  capacity   int  not null default 0 check (capacity >= 0),
  created_at timestamptz not null default now()
);


-- [3] 예약 상태 enum — confirmed / cancelled
create type reservation_status as enum ('confirmed', 'cancelled');


-- [4] 예약 — user_id 는 auth.users(id) 참조
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

  -- ★핵심★ 같은 방 + 겹치는 시간의 확정 예약 공존 불가 (위반 시 23P01, 취소 건은 제외)
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


-- [6] RLS (선택) — 실제 정책은 0002_policies.sql 에서 설정
