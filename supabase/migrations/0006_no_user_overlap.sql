-- 0006_no_user_overlap.sql — 같은 사용자의 시간 겹치는 확정 예약 금지 (user_id 배타 제약)

-- [1] 위반 데이터 확인: 같은 user_id 로 시간이 겹치는 확정 예약 쌍 조회

-- [2] 위반 데이터 정리 — 겹치는 쌍 중 나중 것(id 큰 쪽)을 취소(soft delete)
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
