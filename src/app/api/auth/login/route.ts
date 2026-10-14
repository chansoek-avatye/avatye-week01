// POST /api/auth/login — 이메일/비번 로그인, 성공 시 세션 쿠키 발급 (로그아웃은 logout/route.ts)

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  if (!body.email || !body.password) {
    return Response.json({ error: "email과 password는 필수입니다" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  return Response.json({ user: data.user });
}
