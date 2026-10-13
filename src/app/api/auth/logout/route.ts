// POST /api/auth/logout  — 로그아웃 (세션 쿠키 제거)

import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
