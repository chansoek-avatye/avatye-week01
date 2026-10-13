// /api/reservations/:id/participants
//   GET    — 참석자 목록 (이름 포함)
//   POST   — 참석자 추가 (본인 참석, 또는 호스트가 다른 사람 추가)
//   DELETE — 참석자 제외 (본인 참석 취소, 또는 호스트가 제외)
//
// reservation_participants 는 예약 ↔ 사용자 M:N 조인 테이블.
// user_id 가 profiles(id) 를 참조하므로, 이름을 함께 조회(embed)할 수 있다.

import { createClient } from "@/lib/supabase/server";

// GET ------------------------------------------------------------------------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // reservation_participants → profiles(display_name) 를 조인해서 이름까지 가져온다.
  const { data, error } = await supabase
    .from("reservation_participants")
    .select("user_id, profiles ( display_name, department )")
    .eq("reservation_id", Number(id));

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ participants: data });
}

// POST -----------------------------------------------------------------------
// body: { userId?: string }  — 생략하면 "본인(로그인 사용자)"을 참석자로 추가
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId ?? user.id; // 기본값: 본인

  const { data, error } = await supabase
    .from("reservation_participants")
    .insert({ reservation_id: Number(id), user_id: targetUserId })
    .select()
    .single();

  // 복합 PK 중복(이미 참석자) → 23505(unique_violation)
  if (error?.code === "23505") {
    return Response.json({ error: "이미 참석자입니다" }, { status: 409 });
  }
  // FK 위반(23503) → 없는 예약이거나, 프로필이 없는 사용자
  if (error?.code === "23503") {
    return Response.json(
      { error: "예약이 없거나 사용자 프로필이 없습니다" },
      { status: 404 }
    );
  }
  // RLS 정책 위반(42501) → 권한 없음: 호스트가 아닌데 다른 사람을 추가하려 한 경우
  if (error?.code === "42501") {
    return Response.json({ error: "참석자를 추가할 권한이 없습니다" }, { status: 403 });
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ participant: data }, { status: 201 });
}

// DELETE ---------------------------------------------------------------------
// body: { userId?: string }  — 생략하면 "본인" 참석 취소
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId ?? user.id;

  // .select() 로 실제 삭제된 행을 돌려받아, 0건이면 404 로 구분한다.
  // (RLS 에 막혀도 에러 없이 0건이 되므로 같은 404 로 처리)
  const { data, error } = await supabase
    .from("reservation_participants")
    .delete()
    .eq("reservation_id", Number(id))
    .eq("user_id", targetUserId)
    .select();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: "참석 정보가 없거나 권한이 없습니다" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
