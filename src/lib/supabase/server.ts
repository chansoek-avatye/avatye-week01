// 서버(Route Handler / Server Component)에서 쓰는 Supabase 클라이언트.
// 요청마다 쿠키를 읽어 "현재 로그인한 사용자" 기준으로 동작한다.
// 이 파일은 플러밍(설정 코드)이라 완성형으로 둡니다. 로직은 API 라우트에서 채웁니다.
//
// 사전 준비: npm install @supabase/supabase-js @supabase/ssr

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
