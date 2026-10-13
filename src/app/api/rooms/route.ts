// GET /api/rooms  — 회의실 목록 조회
//
// 가장 쉬운 라우트부터 시작합니다. 이걸로 "Supabase 연결 → 조회 → JSON 응답"
// 흐름을 손에 익히세요.

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  //TODO: rooms 테이블에서 id, name, capacity 를 이름순으로 조회해보기
    const { data, error } = await supabase
             .from("rooms")
             .select("id, name, capacity")
             .order("id");

  // TODO: error 가 있으면 500 으로 응답
    if (error) return Response.json({ error: error.message }, { status: 500 });

  // TODO: 정상이면 data 를 JSON 으로 응답
  return Response.json({ rooms: data });
}
