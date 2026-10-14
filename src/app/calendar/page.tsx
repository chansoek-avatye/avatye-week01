// /calendar — 확정 예약 현황을 주간 캘린더로 본다 (읽기 전용)
//
// /rooms 와 같은 방식: 서버에서 로그인 여부를 먼저 확인하고,
// 로그인 안 했으면 화면을 그리기 전에 /login 으로 보낸다.

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CalendarView from "./CalendarView";

// 로그인 확인이 끝나야 내용이 정해지는 개인화 페이지 (즉시 네비게이션 대상 아님)
export const instant = false;

export default async function CalendarPage() {
  // "이번 주"가 현재 시각에 의존하므로 요청 시점에 렌더링한다
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <CalendarView
      userId={user.id}
      userLabel={profile?.display_name ?? user.email ?? "사용자"}
    />
  );
}
