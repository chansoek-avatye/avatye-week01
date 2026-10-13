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
  // M:N 조인 테이블 → profiles 이름까지 embed 되어 옴
  reservation_participants: {
    user_id: string;
    profiles: { display_name: string } | null;
  }[];
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

  // 참석 / 참석 취소 (본인)
  async function toggleJoin(reservationId: number, joined: boolean) {
    setMsg(null);
    const res = await fetch(`/api/reservations/${reservationId}/participants`, {
      method: joined ? "DELETE" : "POST",
    });
    if (!res.ok) setMsg({ kind: "err", text: (await res.json()).error });
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
              {reservations.map((r) => {
                const participants = r.reservation_participants ?? [];
                const joined = participants.some((p) => p.user_id === userId);
                const isMine = r.user_id === userId;
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        <b>{r.title || "(제목 없음)"}</b>
                        {isMine && <span className="ml-1 text-xs text-zinc-500">(내 예약)</span>}
                        <br />
                        <span className="text-xs text-zinc-500">
                          {fmt(r.start_at)} ~ {fmt(r.end_at)}
                        </span>
                      </span>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => toggleJoin(r.id, joined)}
                          className={`rounded px-2 py-0.5 text-xs ${
                            joined
                              ? "bg-zinc-200 dark:bg-zinc-700"
                              : "bg-black text-white dark:bg-white dark:text-black"
                          }`}
                        >
                          {joined ? "참석 취소" : "참석"}
                        </button>
                        {/* 내 예약만 취소 버튼 노출 (서버/RLS 에서도 본인만 허용) */}
                        {isMine && (
                          <button onClick={() => cancel(r.id)} className="text-xs text-red-500 underline">
                            예약 취소
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 참석자 (M:N) */}
                    {participants.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-zinc-500">참석자 {participants.length}명:</span>
                        {participants.map((p) => (
                          <span
                            key={p.user_id}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                          >
                            {p.profiles?.display_name ?? "알 수 없음"}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
