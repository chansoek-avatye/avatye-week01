// / — 첫 화면은 회의실 화면으로 보낸다.
// (/rooms 에서 로그인 여부를 확인해서, 비로그인이면 다시 /login 으로 보냄)

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/rooms");
}
