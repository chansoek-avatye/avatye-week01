-- 0005_max_duration.sql — 예약 최대 4시간 CHECK 제약 (기존 위반 행 먼저 정리)

-- [1] 기존 위반 데이터 확인: end_at - start_at > 4시간인 예약 조회

-- [2] 위반 데이터 정리 (테스트 데이터 기준. 참석자는 on delete cascade 로 함께 삭제됨)
delete from reservations
where end_at - start_at > interval '4 hours';

-- [3] 제약 추가
alter table reservations
  add constraint reservations_max_duration
  check (end_at - start_at <= interval '4 hours');
