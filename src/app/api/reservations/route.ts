// /api/reservations
//   GET  — 예약 목록 조회 (room_id 로 필터)
//   POST — 예약 생성  ★이번 과제의 핵심 라우트★
//
// POST 의 포인트: "겹치는지 직접 조회해서 막지 말고",
// 그냥 INSERT 를 시도한 뒤 DB 가 돌려주는 '배타 제약 위반' 에러를 잡아서
// 409 Conflict 로 변환한다. (동시 요청에도 안전한 이유 = DB가 원자적으로 판정)

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/reservations?roomId=1
//   예약 현황을 조회한다. roomId 를 주면 그 방 것만, 없으면 전체(확정 예약).
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const roomId = searchParams.get("roomId"); // 선택 필터

  // 기본 쿼리: 확정(confirmed) 예약만, 시작시간 순 정렬
  let query = supabase
    .from("reservations")
    .select("id, room_id, user_id, title, start_at, end_at, status")
    .eq("status", "confirmed")
    .order("start_at");

  // roomId 가 들어오면 그 방으로 필터를 추가
  if (roomId) query = query.eq("room_id", Number(roomId));

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ reservations: data });
}

// ---------------------------------------------------------------------------
// POST /api/reservations
// body: { roomId: number, startAt: string(ISO), endAt: string(ISO), title?: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const supabase = await createClient();

  // 1) 로그인 사용자 확인 -----------------------------------------------------
  // 쿠키(세션)를 보고 "지금 누가 로그인했는지" 확인한다.
  // 예약의 주인(user_id)은 클라이언트가 보낸 값이 아니라 여기서 확인한 값을 쓴다
  // → 남의 이름으로 예약하는 걸 서버가 원천 차단.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // 2) 입력 파싱/검증 ---------------------------------------------------------
  // DB 에도 check / exclusion 제약이 있지만, 사용자에게 친절한 에러를 주려면
  // 명백히 잘못된 요청은 서버에서 먼저 400 으로 걸러주는 게 좋다.
  const body = await request.json();
  const { roomId, startAt, endAt, title } = body;

  if (!roomId || !startAt || !endAt) {
    return Response.json(
      { error: "roomId, startAt, endAt 는 필수입니다" },
      { status: 400 }
    );
  }
  if (new Date(startAt) >= new Date(endAt)) {
    return Response.json(
      { error: "시작 시간은 종료 시간보다 빨라야 합니다" },
      { status: 400 }
    );
  }

  // 3) INSERT 시도 ------------------------------------------------------------
  // 겹치는지 "미리 조회"하지 않는다. 그냥 넣어보고, DB 제약이 판정하게 맡긴다.
  // → 동시 요청이 와도 DB 가 원자적으로 하나만 통과시키므로 race condition 없음.
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      room_id: roomId,
      user_id: user.id,
      title: title ?? null,
      start_at: startAt,
      end_at: endAt,
    })
    .select()
    .single();

  // 4) 겹침(배타 제약 위반) 처리 ★핵심★ --------------------------------------
  // Postgres 배타 제약 위반의 SQLSTATE 는 '23P01'.
  // Supabase 는 error.code 로 이 값을 돌려주므로 → 409 Conflict 로 변환한다.
  if (error?.code === "23P01") {
    return Response.json(
      { error: "이미 예약된 시간대입니다" },
      { status: 409 }
    );
  }
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 성공: 생성된 예약을 201(Created) 로 응답
  return Response.json({ reservation: data }, { status: 201 });
}
