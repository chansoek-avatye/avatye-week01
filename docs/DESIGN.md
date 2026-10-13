# 회의실 예약 서비스 — 설계 정리 (중간점검)

> **한 줄 소개**: 같은 회의실의 겹치는 예약과 동시 요청을 **DB 제약(EXCLUSION)** 으로 막는 회의실 예약 서비스

- 스택: Next.js 16 (App Router, Route Handler) + TypeScript / Supabase (PostgreSQL + Auth)
- ERD 이미지: [erd.png](./erd.png)

---

## 1. 문제 정의

핵심 규칙: **"같은 회의실의 겹치는 시간에는 확정 예약이 하나만 존재해야 한다."**

앱 코드로 `겹치는 예약 조회 → 없으면 INSERT` 하면, 동시에 들어온 두 요청이 둘 다 "없음"을 보고
둘 다 INSERT 한다 (race condition). → **판정을 DB 에 맡겨서** 원자적으로 해결.

---

## 2. DB 설계

### 테이블 (4개 + Supabase 의 auth.users)

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `rooms` | 회의실 | id, name, capacity |
| `reservations` | 예약 | room_id, user_id, title, start_at, end_at, status |
| `profiles` | 앱용 사용자 정보 | id(=auth.users.id), display_name, department |
| `reservation_participants` | 참석자 (조인 테이블) | reservation_id, user_id |
| `auth.users` | 회원 (Supabase 관리) | id(uuid), email |

### 관계

| 관계 | 유형 | 구현 |
|---|---|---|
| rooms → reservations | 1 : N | `reservations.room_id` FK |
| auth.users → reservations | 1 : N | `reservations.user_id` FK (예약자) |
| auth.users ↔ profiles | 1 : 1 | `profiles.id` 가 PK 이자 FK |
| reservations ↔ profiles | M : N | `reservation_participants` + 복합 PK |

### 제약 — "규칙을 DB 가 보장한다"

| 제약 | 막는 것 | 위반 코드 |
|---|---|---|
| **EXCLUDE** `(room_id =, tstzrange(start_at,end_at) &&) WHERE status='confirmed'` | 같은 방·겹치는 시간의 확정 예약 | `23P01` |
| CHECK `start_at < end_at` | 끝이 시작보다 빠른 예약 | `23514` |
| CHECK `end_at - start_at <= 4 hours` | 4시간 초과 예약 | `23514` |
| 복합 PK `(reservation_id, user_id)` | 같은 사람 중복 참석 | `23505` |
| FK + `on delete cascade` | 없는 방/사람 참조, 고아 데이터 | `23503` |
| enum `reservation_status` | 잘못된 상태값 | — |
| RLS 정책 | 남의 예약 수정, 권한 없는 참석자 추가 | `42501` |

### 핵심 설계 결정

- **시간은 구간(start/end)** → 고정 슬롯이 아니라 임의 시간 예약 가능. 겹침은 `tstzrange` + `&&`.
- **취소는 soft delete** (`status='cancelled'`) → 이력 보존 + 제약이 `confirmed` 에만 걸려서 **취소하면 시간이 다시 열림**.
- **profiles 를 1:1 로 분리** → auth.users 는 Supabase 관리라 컬럼 추가 불가.
- **트리거로 profiles 자동 생성** (`handle_new_user`) → 가입과 프로필 생성이 항상 같이 일어남.
- 4시간 제한은 CHECK 가능(컬럼끼리 계산 = 불변), **과거 시간 금지는 CHECK 불가**(`now()` 가 변함 → 트리거/API 로 해야 함).

### 마이그레이션 순서

| 파일 | 내용 |
|---|---|
| `0001_init.sql` | rooms, reservations, EXCLUSION 제약, 시드 |
| `0002_policies.sql` | GRANT + RLS (조회는 모두, 생성·취소는 본인) |
| `0003_profiles_participants.sql` | profiles(1:1) + 가입 트리거, participants(M:N), RLS |
| `0004_backfill_profiles.sql` | 트리거 이전 가입자 profiles 채우기 |
| `0005_max_duration.sql` | 최대 4시간 CHECK |

---

## 3. API 설계

REST 스타일: 자원(명사) URL + HTTP 메서드(동사). 인증은 Supabase 세션 쿠키.

| 메서드 | 경로 | 인증 | 성공 | 실패 |
|---|---|---|---|---|
| POST | `/api/auth/signup` | X | 201 | 400 |
| POST | `/api/auth/login` | X | 200 | 400, 401 |
| POST | `/api/auth/logout` | O | 200 | — |
| GET | `/api/auth/me` | X | 200 | — |
| GET / PUT | `/api/profile` | O | 200 | 401 |
| GET | `/api/rooms` | X | 200 | 500 |
| GET | `/api/reservations?roomId=` | X | 200 | 500 |
| POST | `/api/reservations` | O | 201 | 400, 401, **409** |
| DELETE | `/api/reservations/:id` | O (본인) | 200 | 401 |
| GET | `/api/reservations/:id/participants` | X | 200 | 500 |
| POST | `/api/reservations/:id/participants` | O | 201 | 401, 403, 404, 409 |
| DELETE | `/api/reservations/:id/participants` | O | 200 | 401, 404 |

### 예약 생성 흐름 (핵심)

```
POST /api/reservations
 1. 세션에서 로그인 사용자 확인            → 없으면 401
 2. 입력 검증 (필수값, 시작<종료, 4시간)   → 틀리면 400  (친절한 메시지용 1차 방어)
 3. INSERT 시도 — 겹침을 "미리 조회하지 않음"
 4. DB 제약이 판정 → 23P01 이면 409 / 성공이면 201
```

- `user_id` 는 요청 body 가 아니라 **세션에서 확인한 값** → 남의 이름으로 예약 불가.

### DB 에러 → HTTP 상태 코드

| DB 코드 | 의미 | HTTP |
|---|---|---|
| `23P01` | 배타 제약 위반 (시간 겹침) | 409 Conflict |
| `23505` | 고유 제약 위반 (중복 참석) | 409 Conflict |
| `23514` | CHECK 위반 (시간 역전, 4시간 초과) | 400 Bad Request |
| `23503` | FK 위반 (없는 예약/프로필) | 404 Not Found |
| `42501` | RLS 위반 (권한 없음) | 403 Forbidden |

### 성능 포인트

예약 목록은 참석자 이름까지 **조인(embed) 한 번**으로 가져온다. 예약마다 참석자를 따로 조회하면 N+1 문제가 생긴다.

---

## 4. 회원가입 / 인증

```
[가입]  POST /api/auth/signup { email, password, displayName, department }
          → Supabase Auth 가 auth.users 생성 (비밀번호 해싱 포함)
          → DB 트리거 handle_new_user 가 profiles 행 자동 생성
          → 세션 쿠키 발급 → /rooms 로 이동
[요청]  API 마다 supabase.auth.getUser() 로 쿠키의 세션을 확인
[화면]  /rooms 는 서버 컴포넌트에서 로그인 확인 → 비로그인이면 /login 으로 redirect
[권한]  RLS 로 DB 레벨에서도 "본인 것만 수정" 을 강제 (API 를 우회해도 막힘)
```

- **로그인 식별자는 이메일**, 내부 식별자는 auth 의 **uuid**, 표시 이름은 **profiles**.
- 데모 편의상 이메일 인증(Confirm email)은 꺼둠 → 실서비스에서는 켜야 함.

---

## 5. 화면

| 경로 | 내용 |
|---|---|
| `/login` | 로그인 |
| `/signup` | 회원가입 (이메일·비밀번호·이름·부서) |
| `/rooms` | 회의실 선택 · 예약 폼(기본 1시간, 최대 4시간 안내) · 다가오는 예약 현황(날짜별, 예약자·참석자 표시) |

---

## 6. 예상 질문

| 질문 | 답 |
|---|---|
| 왜 앱에서 겹침을 확인 안 하나? | 조회와 삽입 사이에 다른 요청이 끼어들 수 있음(race). DB 가 INSERT 시점에 원자적으로 판정해야 안전. |
| UNIQUE 로는 안 되나? | UNIQUE 는 "값이 같은지"만 봄. 1:00~2:00 과 1:30~2:30 같은 **부분 겹침**은 못 막음. |
| `btree_gist` 는 왜? | GiST 인덱스에서 `room_id =` 같은 일반 비교를 하려면 필요. |
| 2시 종료 / 2시 시작은 겹침? | 아님. `tstzrange` 기본이 `[시작, 끝)` 이라 끝 시각 불포함 → 연속 예약 허용. |
| 취소하면 왜 다시 예약 가능? | soft delete 로 status 만 바꾸고, 제약이 `WHERE status='confirmed'` 라서 제외됨. |
| 예약 id 가 건너뛰는데? | 실패한 INSERT 도 시퀀스 번호를 소모함(롤백 안 됨). 정상 동작. |
| 과거 시간 예약은? | `now()` 는 CHECK 에 못 씀 → 트리거나 API 검증으로 해야 함 (개선 예정). |

---

## 7. 한계 / 개선 방향

- 과거 시간 예약 금지 (트리거 또는 API 검증)
- 예약 취소 API 가 "없는 예약 / 남의 예약" 을 403·404 로 구분하지 않음
- 이메일 인증, 운영시간 제한, 반복 예약은 미구현
