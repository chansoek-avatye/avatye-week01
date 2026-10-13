-- =============================================================================
-- 0006_no_user_overlap.sql  —  한 사람이 같은 시간에 두 예약을 못 하게
-- -----------------------------------------------------------------------------
-- 0001 의 제약은 "같은 회의실(room_id)" 기준이라,
-- 한 사람이 7~8시 대회의실 + 7~11시 소회의실을 동시에 잡는 건 막지 못했다.
-- 사람은 동시에 두 곳에 있을 수 없으므로 이것도 막아야 한다.
--
-- 해결 방법은 똑같다. 비교 대상만 room_id → user_id 로 바꾼 EXCLUSION 제약을 하나 더 건다.
--   "같은 사용자(user_id =) 이면서 시간이 겹치는(&&) 확정 예약은 공존할 수 없다"
-- (user_id 는 uuid 인데, btree_gist 확장이 uuid 의 = 비교를 지원한다)
-- =============================================================================

-- [1] 위반 데이터 확인 (먼저 이것만 실행해서 어떤 게 취소될지 볼 수 있음)
-- select b.id, b.title, b.start_at, b.end_at
-- from reservations a
-- join reservations b
--   on a.user_id = b.user_id
--  and a.id < b.id
--  and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at)
-- where a.status = 'confirmed' and b.status = 'confirmed';

-- [2] 위반 데이터 정리
-- 겹치는 쌍이 있으면 "나중에 만든 쪽(id 가 큰 쪽)" 을 취소한다.
-- 삭제가 아니라 status 변경(soft delete) 이라 이력은 남는다.
update reservations b
set status = 'cancelled'
where b.status = 'confirmed'
  and exists (
    select 1
    from reservations a
    where a.user_id = b.user_id
      and a.id < b.id
      and a.status = 'confirmed'
      and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at)
  );

-- [3] 제약 추가
alter table reservations
  add constraint reservations_no_user_overlap
  exclude using gist (
    user_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed');
