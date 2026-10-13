"use client";

// /login — 로그인 화면. 성공하면 /rooms 로 이동.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/rooms");
    router.refresh(); // 서버 컴포넌트가 새 세션 쿠키로 다시 렌더되도록
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">로그인</h1>

      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

      <input
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-900"
        placeholder="email@gmail.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-900"
        placeholder="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button
        disabled={loading}
        className="rounded bg-black py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        계정이 없나요?{" "}
        <Link href="/signup" className="underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
