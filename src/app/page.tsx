"use client";

// 회의실 예약 데모 UI (단일 페이지).
// 모든 동작은 우리가 만든 /api/* 라우트를 fetch 로 호출한다.
// (DB 접근 로직은 전부 서버 라우트에 있고, 이 화면은 그걸 쓰기만 함)

import { useCallback, useEffect, useState } from "react";

type Room = { id: number; name: string; capacity: number };
type Reservation = {
  id: number;
  room_id: number;
  title: string | null;
  start_at: string;
  end_at: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [title, setTitle] = useState("");

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ---- 데이터 로드 --------------------------------------------------------
  const loadReservations = useCallback(async (rid: number) => {
    const res = await fetch(`/api/reservations?roomId=${rid}`);
    const json = await res.json();
    setReservations(json.reservations ?? []);
  }, []);

  useEffect(() => {
    // 로그인 상태 복원
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setUserEmail(j.user?.email ?? null));
    // 회의실 목록
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((j) => {
        setRooms(j.rooms ?? []);
        if (j.rooms?.[0]) setRoomId(j.rooms[0].id);
      });
  }, []);

  useEffect(() => {
    if (roomId != null) loadReservations(roomId);
  }, [roomId, loadReservations]);

  // ---- 인증 ---------------------------------------------------------------
  async function auth(path: "signup" | "login") {
    setMsg(null);
    const res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return setMsg({ kind: "err", text: json.error });
    setUserEmail(json.user?.email ?? email);
    setMsg({ kind: "ok", text: path === "signup" ? "가입 완료" : "로그인 완료" });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserEmail(null);
    setMsg({ kind: "ok", text: "로그아웃됨" });
  }

  // ---- 예약 ---------------------------------------------------------------
  async function book() {
    setMsg(null);
    if (!roomId || !startAt || !endAt) {
      return setMsg({ kind: "err", text: "회의실/시작/종료를 모두 입력하세요" });
    }
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId,
        // datetime-local(로컬시간) → ISO(UTC) 로 변환
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        title,
      }),
    });
    const json = await res.json();
    if (res.status === 409) return setMsg({ kind: "err", text: "⛔ " + json.error });
    if (!res.ok) return setMsg({ kind: "err", text: json.error });
    setMsg({ kind: "ok", text: "✅ 예약 완료" });
    setTitle("");
    loadReservations(roomId);
  }

  async function cancel(id: number) {
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (roomId) loadReservations(roomId);
  }

  const fmt = (s: string) =>
    new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

  // ---- 화면 ---------------------------------------------------------------
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">회의실 예약</h1>
        <p className="text-sm text-zinc-500">
          같은 회의실의 겹치는 시간은 DB 제약으로 차단됩니다.
        </p>
      </header>

      {/* 메시지 배너 */}
      {msg && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 인증 영역 */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {userEmail ? (
          <div className="flex items-center justify-between">
            <span className="text-sm">
              로그인됨: <b>{userEmail}</b>
            </span>
            <button onClick={logout} className="text-sm text-zinc-500 underline">
              로그아웃
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
              placeholder="email@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
              placeholder="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={() => auth("signup")}
              className="rounded bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-700"
            >
              가입
            </button>
            <button
              onClick={() => auth("login")}
              className="rounded bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black"
            >
              로그인
            </button>
          </div>
        )}
      </section>

      {/* 회의실 선택 */}
      <section className="flex items-center gap-3">
        <label className="text-sm font-medium">회의실</label>
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
          value={roomId ?? ""}
          onChange={(e) => setRoomId(Number(e.target.value))}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (정원 {r.capacity})
            </option>
          ))}
        </select>
      </section>

      {/* 예약 폼 */}
      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">새 예약</h2>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs">
            시작
            <input
              type="datetime-local"
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-xs">
            종료
            <input
              type="datetime-local"
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
        </div>
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900"
          placeholder="제목 (선택)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          onClick={book}
          className="self-start rounded bg-black px-4 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          예약하기
        </button>
      </section>

      {/* 예약 목록 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">예약 현황</h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-zinc-500">예약이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reservations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span>
                  <b>{r.title || "(제목 없음)"}</b>
                  <br />
                  <span className="text-zinc-500">
                    {fmt(r.start_at)} ~ {fmt(r.end_at)}
                  </span>
                </span>
                <button
                  onClick={() => cancel(r.id)}
                  className="text-xs text-red-500 underline"
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
