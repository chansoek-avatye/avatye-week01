"use client";

// /login — 로그인 화면. 성공하면 /rooms 로 이동.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">로그인</h1>
        <p className="text-xs text-ink-2">가입한 이메일로 로그인하세요</p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Field label="이메일">
        <Input
          type="email"
          autoComplete="email"
          placeholder="email@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="비밀번호">
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      <Button type="submit" disabled={loading} className="mt-1 w-full">
        {loading ? "로그인 중..." : "로그인"}
      </Button>

      <p className="text-center text-xs text-ink-2">
        계정이 없나요?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
