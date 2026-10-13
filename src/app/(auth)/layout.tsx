// (auth) 는 라우트 그룹: URL 에는 안 나타나고(/login, /signup) 레이아웃만 공유한다.
// 로그인/회원가입 화면을 가운데 카드 형태로 감싼다.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
        {children}
      </div>
    </main>
  );
}
