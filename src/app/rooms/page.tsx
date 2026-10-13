// /rooms — 회의실 선택 + 예약 + 예약 현황
//
// 서버 컴포넌트에서 먼저 로그인 여부를 확인한다.
// 로그인 안 했으면 화면을 그리기 전에 /login 으로 보낸다(깜빡임 없음).

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import RoomsView from "./RoomsView";

// 이 화면은 로그인 확인(쿠키)이 끝나야 내용이 정해지는 개인화 페이지라,
// 미리 만들어 둔 화면을 즉시 보여줄 수 없다. "이동할 때 잠깐 기다려도 되는 화면"으로 표시한다.
export const instant = false;

export default async function RoomsPage() {
  // 이 화면은 로그인한 사람마다 내용이 다르고, 예약 폼의 기본값이 "현재 시각"에
  // 의존한다(RoomsView 의 useState 초기값). 그래서 빌드 때 미리 만들어두면 안 되고
  // 요청이 들어온 시점에 렌더링해야 한다. connection() 이 그 경계를 표시한다.
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
