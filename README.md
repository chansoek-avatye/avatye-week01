# 회의실 예약 서비스

같은 회의실의 **겹치는 시간 예약과 동시 요청을 PostgreSQL 제약으로 차단**하는 서비스.
(Next.js App Router + Supabase)

## 구조

```
src/app/api/            API 라우트 (Route Handlers)
  rooms/route.ts          GET  회의실 목록
  reservations/route.ts   GET  목록 / POST 예약 생성(핵심)
  reservations/[id]/route.ts  DELETE 예약 취소
  auth/signup/route.ts    POST 회원가입(Supabase Auth)
src/lib/supabase/server.ts  서버용 Supabase 클라이언트
supabase/migrations/0001_init.sql  DB 스키마 (핵심 제약 포함)
docs/DESIGN.md          설계/발표 문서  ← 먼저 읽기
```

## 세팅

```bash
# 1) 패키지 설치
npm install

# 2) Supabase 프로젝트 만들고 키 복사
cp .env.local.example .env.local   # 값 채우기

# 3) DB 스키마 적용
#    Supabase 대시보드 > SQL Editor 에 supabase/migrations/0001_init.sql 붙여넣고 Run

# 4) 개발 서버
npm run dev
```

## 직접 채울 부분

API 라우트의 `// TODO` 와 `return ... 501` 줄들을 채우면 됩니다.
DB 설계 의도와 발표 대본은 [docs/DESIGN.md](docs/DESIGN.md) 참고.
