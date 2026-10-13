// POST /api/auth/login   — 로그인 (이메일/비번)
// POST /api/auth/logout  은 아래 별도 파일(logout/route.ts)
//
// signInWithPassword 가 성공하면 세션 쿠키가 응답에 심어져서(브라우저가 저장)
// 이후 요청부터 "로그인한 사용자"로 인식된다.

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
