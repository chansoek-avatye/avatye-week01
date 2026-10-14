// /api/reservations/:id/participants — 참석자(M:N 조인 테이블) GET 조회 / POST 추가 / DELETE 제외

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

// POST — body: { userId?: string }, 생략 시 본인을 참석자로 추가
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

// DELETE — body: { userId?: string }, 생략 시 본인 참석 취소
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

  // .select() 로 삭제된 행을 받아 0건(없음·RLS 차단)이면 404
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
