"use client";

// 회의실 화면의 인터랙션 부분 (회의실 선택 / 예약 폼 / 예약 현황).
// 모든 데이터는 /api/* 라우트를 통해 주고받는다.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Room = { id: number; name: string; capacity: number };
type Reservation = {
  id: number;
  room_id: number;
  user_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
};

export default function RoomsView({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
  const router = useRouter();

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

  // ---- 동작 ---------------------------------------------------------------
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!roomId || !startAt || !endAt) {
      return setMsg({ kind: "err", text: "시작/종료 시간을 입력하세요" });
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

  const input = "rounded border border-zinc-300 px-2 py-1 text-sm dark:bg-zinc-900";
  const selectedRoom = rooms.find((r) => r.id === roomId);

  // ---- 화면 ---------------------------------------------------------------
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      {/* 상단 바 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">회의실 예약</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>
            <b>{userLabel}</b> 님
          </span>
          <button onClick={logout} className="text-zinc-500 underline">
            로그아웃
          </button>
        </div>
      </header>

      {/* 회의실 선택 (카드) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">회의실 선택</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoomId(r.id)}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${
                r.id === roomId
                  ? "border-black bg-zinc-100 dark:border-white dark:bg-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-zinc-500">정원 {r.capacity}명</div>
            </button>
          ))}
        </div>
      </section>

      {msg && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            msg.kind === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 예약 폼 */}
        <form
          onSubmit={book}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <h2 className="text-sm font-semibold">
            새 예약 {selectedRoom && <span className="text-zinc-500">· {selectedRoom.name}</span>}
          </h2>
          <label className="flex flex-col gap-1 text-xs">
            시작
            <input type="datetime-local" className={input}
              value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            종료
            <input type="datetime-local" className={input}
              value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>
          <input className={input} placeholder="제목 (선택)"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="self-start rounded bg-black px-4 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            예약하기
          </button>
        </form>

        {/* 예약 현황 */}
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">예약 현황</h2>
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
                    <span className="text-xs text-zinc-500">
                      {fmt(r.start_at)} ~ {fmt(r.end_at)}
                    </span>
                  </span>
                  {/* 내 예약만 취소 버튼 노출 (서버/RLS 에서도 본인만 허용) */}
                  {r.user_id === userId && (
                    <button onClick={() => cancel(r.id)} className="text-xs text-red-500 underline">
                      취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
