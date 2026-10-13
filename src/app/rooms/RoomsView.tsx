"use client";

// 회의실 화면의 인터랙션 부분 (회의실 선택 / 예약 폼 / 예약 현황).
// 모든 데이터는 /api/* 라우트를 통해 주고받는다.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Room = { id: number; name: string; capacity: number };
type Reservation = {
  id: number;
  room_id: number;
  user_id: string;
  host_name: string | null;
  title: string | null;
  start_at: string;
  end_at: string;
  // M:N 조인 테이블 → profiles 이름까지 embed 되어 옴
  reservation_participants: {
    user_id: string;
    profiles: { display_name: string } | null;
  }[];
};

const MAX_MINUTES = 4 * 60; // DB 의 최대 예약 길이 제약과 동일

// ---- 시간 유틸 --------------------------------------------------------------
// datetime-local 입력은 "로컬 시간" 문자열(YYYY-MM-DDTHH:mm)을 쓴다.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
function addHours(local: string, h: number) {
  const d = new Date(local);
  d.setHours(d.getHours() + h);
  return toLocalInput(d);
}
function durationLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(" ") || "0분";
}
// 특정 방의 "다가오는" 예약만 가져오기 (이미 끝난 예약은 제외)
async function fetchUpcoming(roomId: number): Promise<Reservation[]> {
  const res = await fetch(`/api/reservations?roomId=${roomId}`);
  const json = await res.json();
  const now = Date.now();
  return ((json.reservations ?? []) as Reservation[]).filter(
    (r) => new Date(r.end_at).getTime() >= now
  );
}

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

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
  const [loadedRoomId, setLoadedRoomId] = useState<number | null>(null);
  const loadingList = loadedRoomId !== roomId; // 선택한 방의 데이터가 아직 안 왔으면 로딩 중

  // 기본값: 다음 정각부터 1시간
  const [startAt, setStartAt] = useState(() => toLocalInput(nextHour()));
  const [endAt, setEndAt] = useState(() => addHours(toLocalInput(nextHour()), 1));
  const [title, setTitle] = useState("");

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 처리 중인 동작 키 (중복 클릭 방지)

  // ---- 데이터 로드 --------------------------------------------------------
  // 예약/취소/참석 후 목록 새로고침 (이벤트 핸들러에서 호출)
  const loadReservations = useCallback(async (rid: number) => {
    setReservations(await fetchUpcoming(rid));
    setLoadedRoomId(rid);
  }, []);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((j) => {
        setRooms(j.rooms ?? []);
        if (j.rooms?.[0]) setRoomId(j.rooms[0].id);
      });
  }, []);

  // 방을 바꾸면 그 방의 예약을 불러온다.
  // ignore: 방을 빠르게 바꿨을 때 늦게 도착한 "이전 방" 응답이 화면을 덮어쓰지 않도록
  useEffect(() => {
    if (roomId == null) return;
    let ignore = false;
    fetchUpcoming(roomId).then((list) => {
      if (ignore) return;
      setReservations(list);
      setLoadedRoomId(roomId);
    });
    return () => {
      ignore = true;
    };
  }, [roomId]);

  // 성공 메시지는 3초 뒤 자동으로 사라지게
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  // ---- 파생 값 ------------------------------------------------------------
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  const durationError =
    !startAt || !endAt ? "시작/종료 시간을 입력하세요"
    : minutes <= 0 ? "종료 시간이 시작 시간보다 늦어야 합니다"
    : minutes > MAX_MINUTES ? "최대 4시간까지 예약할 수 있습니다"
    : null;

  // 날짜별로 묶기 (지난 예약은 loadReservations 에서 이미 제외됨)
  const grouped = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = fmtDay(r.start_at);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [reservations]);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  // ---- 동작 ---------------------------------------------------------------
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function onStartChange(v: string) {
    setStartAt(v);
    // 시작을 바꿨는데 종료가 그 이전이면 → 종료를 시작+1시간으로 맞춰줌
    if (v && new Date(endAt) <= new Date(v)) setEndAt(addHours(v, 1));
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!roomId || durationError) return;
    setBusy("book");
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
    setBusy(null);
    if (res.status === 409) return setMsg({ kind: "err", text: "⛔ " + json.error });
    if (!res.ok) return setMsg({ kind: "err", text: json.error });
    setMsg({ kind: "ok", text: "✅ 예약 완료" });
    setTitle("");
    loadReservations(roomId);
  }

  async function cancel(id: number) {
    setBusy(`cancel-${id}`);
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    setBusy(null);
    if (roomId) loadReservations(roomId);
  }

  // 참석 / 참석 취소 (본인)
  async function toggleJoin(reservationId: number, joined: boolean) {
    setMsg(null);
    setBusy(`join-${reservationId}`);
    const res = await fetch(`/api/reservations/${reservationId}/participants`, {
      method: joined ? "DELETE" : "POST",
    });
    setBusy(null);
    if (!res.ok) setMsg({ kind: "err", text: (await res.json()).error });
    if (roomId) loadReservations(roomId);
  }

  const input =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  // ---- 화면 ---------------------------------------------------------------
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
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
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                r.id === roomId
                  ? "border-black bg-zinc-100 dark:border-white dark:bg-zinc-800"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
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
            msg.kind === "ok"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_3fr]">
        {/* 예약 폼 */}
        <form
          onSubmit={book}
          className="flex h-fit flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <h2 className="text-sm font-semibold">
            새 예약 {selectedRoom && <span className="text-zinc-500">· {selectedRoom.name}</span>}
          </h2>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            시작
            <input type="datetime-local" className={input}
              value={startAt} onChange={(e) => onStartChange(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            종료
            <input type="datetime-local" className={input}
              value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>

          {/* 예약 길이 미리보기 / 검증 */}
          <p className={`text-xs ${durationError ? "text-red-500" : "text-zinc-500"}`}>
            {durationError ?? `${durationLabel(minutes)} 예약 · 최대 4시간`}
          </p>

          <input className={input} placeholder="제목 (선택)"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <button
            disabled={!!durationError || busy === "book"}
            className="rounded-md bg-black py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy === "book" ? "예약 중..." : "예약하기"}
          </button>
        </form>

        {/* 예약 현황 */}
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            예약 현황
            <span className="text-xs font-normal text-zinc-500">다가오는 예약</span>
          </h2>

          {loadingList && grouped.length === 0 ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-zinc-500">예정된 예약이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map(([day, list]) => (
                <div key={day}>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-500">{day}</h3>
                  <ul className="flex flex-col gap-2">
                    {list.map((r) => {
                      const participants = r.reservation_participants ?? [];
                      const joined = participants.some((p) => p.user_id === userId);
                      const isMine = r.user_id === userId;
                      return (
                        <li
                          key={r.id}
                          className={`flex flex-col gap-2 rounded-md border px-3 py-2 text-sm ${
                            isMine
                              ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-mono text-xs text-zinc-500">
                                {fmtTime(r.start_at)} – {fmtTime(r.end_at)}
                              </div>
                              <b>{r.title || "(제목 없음)"}</b>
                              <div className="text-xs text-zinc-500">
                                예약자 {r.host_name ?? "알 수 없음"}
                                {isMine && " (나)"}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                onClick={() => toggleJoin(r.id, joined)}
                                disabled={busy === `join-${r.id}`}
                                className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${
                                  joined
                                    ? "bg-zinc-200 dark:bg-zinc-700"
                                    : "bg-black text-white dark:bg-white dark:text-black"
                                }`}
                              >
                                {joined ? "참석 취소" : "참석"}
                              </button>
                              {/* 내 예약만 취소 버튼 노출 (서버/RLS 에서도 본인만 허용) */}
                              {isMine && (
                                <button
                                  onClick={() => cancel(r.id)}
                                  disabled={busy === `cancel-${r.id}`}
                                  className="text-xs text-red-500 underline disabled:opacity-40"
                                >
                                  예약 취소
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 참석자 (M:N) */}
                          {participants.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-xs text-zinc-500">참석 {participants.length}명</span>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
