// POST /api/auth/signup — Supabase Auth 회원가입, handle_new_user 트리거가 profiles 자동 생성

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
        // options.data → raw_user_meta_data → handle_new_user 트리거가 profiles 채움
        options: {
          data: {
            display_name: body.displayName,
            department: body.department,
          },
        },
      });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ user: data.user }, { status: 201 });
    }
