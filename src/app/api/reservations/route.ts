// /api/reservations — GET 목록 조회 / POST 생성(INSERT 후 배타 제약 위반을 409 로 변환)

import { createClient } from "@/lib/supabase/server";

// DB 의 reservations_max_duration CHECK 제약(4시간)과 같은 값
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

// 페이지네이션 기본값
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

// 쿼리 문자열에서 양의 정수를 안전하게 뽑는다 (없거나 이상하면 기본값)
function positiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

// GET ?roomId&upcoming&page&limit(≤50)&from&to — 오프셋 페이지네이션, 지난 예약·기간 필터는 서버에서 처리
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const roomId = searchParams.get("roomId"); // 선택 필터
  const upcoming = searchParams.get("upcoming") === "true";
  const from = searchParams.get("from"); // 기간 필터 (선택)
  const to = searchParams.get("to");
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
    return Response.json({ error: "from/to 는 ISO 날짜 형식이어야 합니다" }, { status: 400 });
  }
  const page = positiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const limit = positiveInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;

  // 확정 예약 + 참석자 이름 embed(N+1 회피), exact count, start_at·id 정렬로 페이지 순서 고정
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("reservations")
    .select(
      "id, room_id, user_id, title, start_at, end_at, status, reservation_participants ( user_id, profiles ( display_name ) )",
      { count: "exact" }
    )
    .eq("status", "confirmed")
    .order("start_at")
    .order("id");

  // roomId 가 들어오면 그 방으로 필터를 추가
  if (roomId) query = query.eq("room_id", Number(roomId));
  // 이미 끝난 예약은 제외
  if (upcoming) query = query.gte("end_at", nowIso);
  // 기간 필터: 창(from~to)과 겹치는 예약만
  if (from) query = query.gte("end_at", from);
  if (to) query = query.lt("start_at", to);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  // 범위 밖 페이지(PGRST103)는 에러 대신 빈 페이지 + total 로 응답
  if (error?.code === "PGRST103") {
    let countQuery = supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed");
    if (roomId) countQuery = countQuery.eq("room_id", Number(roomId));
    if (upcoming) countQuery = countQuery.gte("end_at", nowIso);
    if (from) countQuery = countQuery.gte("end_at", from);
    if (to) countQuery = countQuery.lt("start_at", to);

    const { count: total } = await countQuery;
    return Response.json({
      reservations: [],
      page,
      limit,
      total: total ?? 0,
      totalPages: Math.max(1, Math.ceil((total ?? 0) / limit)),
    });
  }

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 등장한 user_id 의 profiles 를 한 번에 조회해 예약자 이름 매핑 (N+1 회피)
  const rows = data ?? [];
  const hostIds = [...new Set(rows.map((r) => r.user_id as string))];
  const { data: hosts } = hostIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", hostIds)
    : { data: [] };
  const nameById = new Map((hosts ?? []).map((h) => [h.id, h.display_name]));

  const total = count ?? 0;

  return Response.json({
    reservations: rows.map((r) => ({
      ...r,
      host_name: nameById.get(r.user_id as string) ?? null,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

// POST /api/reservations — body: { roomId, startAt, endAt, title? }
export async function POST(request: Request) {
  const supabase = await createClient();

  // 1) 로그인 사용자 확인 — user_id 는 클라이언트 값이 아닌 세션 기준
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // 2) 입력 파싱/검증 — 명백히 잘못된 요청은 DB 제약 전에 400 으로 차단
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
  // 최대 4시간 (DB 에도 CHECK 제약이 있지만, 친절한 메시지를 위해 먼저 확인)
  if (new Date(endAt).getTime() - new Date(startAt).getTime() > MAX_DURATION_MS) {
    return Response.json(
      { error: "예약은 최대 4시간까지 가능합니다" },
      { status: 400 }
    );
  }

  // 3) INSERT 시도 — 사전 조회 없이 DB 제약에 판정을 맡겨 race condition 방지
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

  // 4) 배타 제약 위반(23P01) → 제약 이름으로 원인 구분해 409 Conflict
  if (error?.code === "23P01") {
    const byUser = error.message.includes("reservations_no_user_overlap");
    return Response.json(
      {
        error: byUser
          ? "같은 시간에 이미 다른 예약이 있습니다"
          : "이미 예약된 시간대입니다",
      },
      { status: 409 }
    );
  }
  // CHECK 제약 위반(23514): 시간 역전 / 4시간 초과 — API 검증을 우회해도 DB 가 막는다
  if (error?.code === "23514") {
    return Response.json(
      { error: "예약 시간이 올바르지 않습니다 (최대 4시간)" },
      { status: 400 }
    );
  }
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 성공: 생성된 예약을 201(Created) 로 응답
  return Response.json({ reservation: data }, { status: 201 });
}
