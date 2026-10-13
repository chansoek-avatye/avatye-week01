// /rooms — 회의실 선택 + 예약 + 예약 현황
//
// 서버 컴포넌트에서 먼저 로그인 여부를 확인한다.
// 로그인 안 했으면 화면을 그리기 전에 /login 으로 보낸다(깜빡임 없음).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomsView from "./RoomsView";

export default async function RoomsPage() {
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
