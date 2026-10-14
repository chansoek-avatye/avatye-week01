// / — /rooms 로 리다이렉트 (비로그인이면 /rooms 가 /login 으로 보냄)

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/rooms");
}
