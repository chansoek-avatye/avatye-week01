// GET /api/auth/me  — 현재 로그인한 사용자 확인 (페이지 새로고침 시 로그인 상태 유지용)

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Response.json({ user });
}
