// 서버용 Supabase 클라이언트 — 요청 쿠키 기준 로그인 사용자로 동작 (@supabase/ssr 필요)

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 에서 호출되면 set 이 막힐 수 있음 → 무시 가능
          }
        },
      },
    }
  );
}
