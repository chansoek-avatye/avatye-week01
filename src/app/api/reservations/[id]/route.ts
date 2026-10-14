// DELETE /api/reservations/:id — 예약 취소(status='cancelled' soft delete, Next 16 params 는 await)

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


  // TODO: 본인(user_id) 예약만 status 를 'cancelled' 로 update

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
