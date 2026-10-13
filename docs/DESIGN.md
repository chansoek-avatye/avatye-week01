# 회의실 예약 서비스 — 설계 문서 (발표용)

> 한 줄 소개: **회의실 예약 시 중복과 동시 요청을 DB 제약으로 막는 서비스**

---

## 1. 문제 정의

회의실 예약에서 가장 중요한 불변식(invariant):

> "같은 회의실의 겹치는 시간에는 예약이 하나만 존재해야 한다."

순진한 구현(앱에서 조회 후 삽입)은 **동시 요청**에 취약하다 → race condition(TOCTOU).
이 서비스는 그 판정을 **DB 제약으로 위임**해서 동시성 문제까지 한 번에 해결한다.

---

## 2. 기술 선택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router, Route Handler) | API 서버 + 웹을 한 프로젝트로 |
| DB | Supabase (PostgreSQL) | EXCLUSION 제약 등 RDB 고급 기능, Auth 내장 |
| 인증/회원가입 | Supabase Auth | 비번 해싱·세션 관리를 위임, `auth.users` 재사용 |

---

## 3. DB 모델링

### 테이블

- **rooms** — 회의실 (id, name, capacity)
- **reservations** — 예약 (id, room_id→rooms, user_id→auth.users, title, start_at, end_at, status, created_at)
- **auth.users** — Supabase Auth 가 관리 (회원)

관계: `rooms 1 : N reservations`, `auth.users 1 : N reservations`

### 핵심 제약 (발표 하이라이트)

```sql
create extension btree_gist;

constraint reservations_no_overlap exclude using gist (
  room_id                      with =,   -- 같은 회의실이고
  tstzrange(start_at, end_at)  with &&   -- 시간 구간이 겹치면
) where (status = 'confirmed')           -- 확정 예약끼리만
```

- `=` : 같은 방인지 비교
- `&&` : 두 시간 구간이 겹치는지 비교 (range 연산자)
- `where`: 취소된 예약은 제외 → 취소하면 그 시간대가 다시 열림
- 동시 INSERT 2건 → DB가 원자적으로 판정 → **하나만 성공, 나머지는 `23P01` 에러**

> 비교: 앱 레벨 체크(race 발생) vs UNIQUE(고정 슬롯만) vs **EXCLUSION(임의 시간대 + 동시성 안전)**

---

## 4. API 설계

REST 스타일. 자원(resource) 중심 URL + HTTP 메서드로 행위 표현.

| 메서드 | 경로 | 설명 | 주요 응답 |
|---|---|---|---|
| POST | `/api/auth/signup` | 회원가입 | 201 / 400 |
| GET | `/api/rooms` | 회의실 목록 | 200 |
| GET | `/api/reservations?roomId=&from=&to=` | 예약 목록(필터) | 200 |
| POST | `/api/reservations` | 예약 생성 | 201 / 400 / 401 / **409(중복)** |
| DELETE | `/api/reservations/:id` | 예약 취소(soft delete) | 204 / 401 / 404 |

### 상태 코드 설계 포인트

- **409 Conflict** = 시간대 중복. DB의 `23P01`(배타 제약 위반)을 그대로 409로 번역.
- **401** = 미로그인, **400** = 입력 오류 → 계층별로 책임을 나눈다.

### 예약 생성 흐름

```
클라이언트 → POST /api/reservations
  1. 로그인 확인 (아니면 401)
  2. 입력 검증: roomId/startAt/endAt, startAt < endAt (아니면 400)
  3. INSERT 시도 (겹침 조회를 "직접 하지 않음")
  4. DB 제약 위반(23P01) → 409 / 성공 → 201
```

---

## 5. 동시성 시연 (발표 데모 아이디어)

같은 방·같은 시간으로 두 요청을 동시에 던지면 하나만 201, 하나는 409가 나온다:

```bash
# 쿠키(로그인 세션)가 필요하면 -b/-H 로 넣어주세요
curl -s -X POST localhost:3000/api/reservations \
  -H 'content-type: application/json' \
  -d '{"roomId":1,"startAt":"2026-10-14T01:00:00Z","endAt":"2026-10-14T02:00:00Z"}' &
curl -s -X POST localhost:3000/api/reservations \
  -H 'content-type: application/json' \
  -d '{"roomId":1,"startAt":"2026-10-14T01:00:00Z","endAt":"2026-10-14T02:00:00Z"}' &
wait
```

---

## 6. 발표 때 할 말 (요약 대본)

1. "회의실 예약의 핵심 불변식은 *겹치는 예약 금지* 입니다."
2. "앱 코드로 조회 후 삽입하면 동시 요청에 race condition이 생깁니다."
3. "그래서 Postgres의 EXCLUSION 제약으로 DB가 원자적으로 막게 했습니다."
4. "API는 겹침을 직접 조회하지 않고, 제약 위반 에러(23P01)를 409로 변환합니다."
5. "회원가입은 Supabase Auth에 위임해 `auth.users`를 예약의 주인으로 참조합니다."

---

## 7. 더 해보면 좋은 것 (여유 있으면)

- RLS 정책으로 "본인 예약만 취소" 를 DB 레벨에서 강제 (migration 파일 [6]번 참고)
- 예약 폼/목록 UI (src/app/page.tsx)
- 과거 시간 예약 금지, 최대 예약 길이 제한 (check 제약 또는 API 검증)
