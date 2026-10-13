-- =============================================================================
-- 0005_max_duration.sql  —  최대 예약 길이 제한 (4시간)
-- -----------------------------------------------------------------------------
-- 회의실을 며칠씩 잡아버리는 예약을 DB 레벨에서 차단한다.
-- end_at - start_at 은 컬럼끼리의 계산이라 결과가 항상 같다(immutable)
--   → CHECK 제약으로 표현 가능.
--   (반대로 "과거 시간 금지"는 now() 가 매번 바뀌어서 CHECK 로는 불가 → 트리거/API 로 처리해야 함)
--
-- 주의: CHECK 제약은 추가하는 순간 "기존 행"까지 전부 검사한다.
--       이미 4시간을 넘는 예약이 있으면 alter table 이 실패하므로 먼저 정리한다.
-- =============================================================================

-- [1] 기존 위반 데이터 확인 (먼저 이것만 실행해서 어떤 게 지워질지 볼 수 있음)
-- select id, title, start_at, end_at, end_at - start_at as duration
-- from reservations
-- where end_at - start_at > interval '4 hours';

-- [2] 위반 데이터 정리 (테스트 데이터 기준. 참석자는 on delete cascade 로 함께 삭제됨)
delete from reservations
where end_at - start_at > interval '4 hours';

-- [3] 제약 추가
alter table reservations
  add constraint reservations_max_duration
  check (end_at - start_at <= interval '4 hours');
