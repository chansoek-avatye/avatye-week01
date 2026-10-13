// /api/profile
//   GET — 내 프로필 조회
//   PUT — 내 프로필 수정 (이름/부서)
//
// profiles 는 auth.users 와 1:1. 로그인한 본인 것만 다룬다.

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, department")
    .eq("id", user.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: body.displayName, department: body.department })
    .eq("id", user.id) // RLS 로도 막히지만, 명시적으로 본인 것만
    .select("id, display_name, department")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}
