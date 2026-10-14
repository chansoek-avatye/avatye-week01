// /rooms — 회의실 선택·예약·현황, 비로그인이면 렌더 전 /login 으로 이동

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import RoomsView from "./RoomsView";

// 쿠키 확인이 필요한 개인화 페이지라 이동 시 잠깐 대기하는 동적 화면으로 표시
export const instant = false;

export default async function RoomsPage() {
  // 사용자·현재 시각에 의존하므로 connection() 으로 요청 시점 렌더링
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // profiles(1:1) 에서 표시 이름 가져오기 (없으면 이메일로 대체)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <RoomsView
      userId={user.id}
      userLabel={profile?.display_name ?? user.email ?? "사용자"}
    />
  );
}
