// POST /api/auth/signup  — 회원가입 (Supabase Auth)
// body: { email: string, password: string }
//
// 회원가입을 직접 테이블 만들어 비번 해싱... 할 필요 없이 Supabase Auth 에 위임한다.
// signUp 이 성공하면 auth.users 에 사용자가 생기고, reservations.user_id 로 참조된다.

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  // TODO: email / password 가 있는지 검증 (없으면 400)
  if (!body.email || !body.password){
    return Response.json({error: "email과 password는 필수 입니다."}, {status: 400 });
  }

  // TODO: 회원가입 호출
      const { data, error } = await supabase.auth.signUp({
        email: body.email,
        password: body.password,
      });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ user: data.user }, { status: 201 });
    }
