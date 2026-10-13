"use client";

// /signup — 회원가입 화면. 이름/부서는 profiles 테이블로 들어간다(DB 트리거).
// 성공하면(이메일 인증 OFF 상태라 바로 세션 생성) /rooms 로 이동.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName: displayName || undefined,
        department: department || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/rooms");
    router.refresh();
  }

  const input =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-900";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">회원가입</h1>

      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

      <input className={input} placeholder="email@gmail.com" type="email"
        value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={input} placeholder="비밀번호 (6자 이상)" type="password"
        value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <input className={input} placeholder="이름"
        value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input className={input} placeholder="부서 (선택)"
        value={department} onChange={(e) => setDepartment(e.target.value)} />

      <button
        disabled={loading}
        className="rounded bg-black py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "가입 중..." : "가입하기"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
