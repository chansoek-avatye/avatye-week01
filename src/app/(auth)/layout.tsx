// (auth) 는 라우트 그룹: URL 에는 안 나타나고(/login, /signup) 레이아웃만 공유한다.
// 위에 브랜드 마크, 아래에 카드. 로그인/회원가입 폼이 카드 안에 들어간다.

import { BrandMark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandMark size={44} />
          <div className="text-center">
            <div className="text-base font-semibold">회의실 예약</div>
            <div className="text-xs text-ink-2">겹치는 예약은 DB 제약으로 막습니다</div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,.04),0_16px_40px_-16px_rgba(0,0,0,.18)]">
          {children}
        </div>
      </div>
    </main>
  );
}
