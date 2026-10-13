"use client";

// /signup — 회원가입 화면. 이름/부서는 profiles 테이블로 들어간다(DB 트리거).
// 성공하면(이메일 인증 OFF 상태라 바로 세션 생성) /rooms 로 이동.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">회원가입</h1>
        <p className="text-xs text-ink-2">이름은 예약 현황에 표시됩니다</p>
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
          autoComplete="new-password"
          placeholder="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름">
          <Input
            autoComplete="name"
            placeholder="홍길동"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="부서 (선택)">
          <Input
            placeholder="개발팀"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </Field>
      </div>

      <Button type="submit" disabled={loading} className="mt-1 w-full">
        {loading ? "가입 중..." : "가입하기"}
      </Button>

      <p className="text-center text-xs text-ink-2">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
