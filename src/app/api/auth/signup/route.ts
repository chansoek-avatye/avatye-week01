// POST /api/auth/signup  — 회원가입 (Supabase Auth)
// body: { email: string, password: string, displayName?: string, department?: string }
//
// 회원가입을 직접 테이블 만들어 비번 해싱... 할 필요 없이 Supabase Auth 에 위임한다.
// signUp 이 성공하면 auth.users 에 사용자가 생기고, DB 트리거(handle_new_user)가
// profiles 행을 자동 생성한다. displayName/department 는 거기로 전달된다.

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
        // options.data 는 auth.users.raw_user_meta_data 에 저장되고,
        // handle_new_user 트리거가 이 값을 읽어 profiles 를 채운다.
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
