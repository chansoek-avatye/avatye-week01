// DELETE /api/reservations/:id  — 예약 취소
//
// 실제로 행을 지우기보다 status 를 'cancelled' 로 바꾸는 게(soft delete) 보통 낫다.
// (이력이 남고, 배타 제약은 'confirmed' 에만 걸리므로 취소하면 그 시간대가 다시 열린다)
//
// Next 16: 동적 라우트의 params 는 Promise 라서 await 해야 한다.

import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // TODO: 로그인 사용자 확인 (없으면 401)
  const { data: { user} } = await supabase.auth.getUser();
  if(!user) {
    return Response.json({ error: "로그인이 필요합니다"}, { status: 401});
  }


  // TODO: 해당 id 예약의 status 를 'cancelled' 로 update.
  //       본인 예약만 취소되도록 user_id 조건도 함께 걸기.

      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", Number(id))
        .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
