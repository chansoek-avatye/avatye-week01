-- 0002_policies.sql — 접근 권한: GRANT(역할별 테이블 접근) + RLS 정책(행 단위 규칙)

-- [1] 역할에 테이블 접근 권한 부여 -----------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on rooms                      to anon, authenticated;
grant select, insert, update on reservations to anon, authenticated;


-- [2] RLS 켜기 — 정책에 해당하는 행만 접근 가능
alter table rooms        enable row level security;
alter table reservations enable row level security;


-- [3] 조회 정책 — 회의실 목록은 누구나 조회
create policy "rooms are viewable by everyone"
  on rooms for select
  using (true);

-- 예약 현황도 누구나 볼 수 있게 (공유 캘린더처럼)
create policy "reservations are viewable by everyone"
  on reservations for select
  using (true);


-- [4] 쓰기 정책 — 예약 생성/취소는 로그인한 본인(auth.uid()) 것만
create policy "users can insert own reservation"
  on reservations for insert
  to authenticated
  with check (user_id = auth.uid());

-- using: UPDATE 대상 행이 본인 것일 때만 (예약 취소 = status 변경)
create policy "users can update own reservation"
  on reservations for update
  to authenticated
  using (user_id = auth.uid());
