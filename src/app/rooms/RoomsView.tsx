"use client";

// 회의실 화면의 인터랙션 부분 (회의실 선택 / 예약 폼 / 예약 현황).
// 모든 데이터는 /api/* 라우트를 통해 주고받는다.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  BrandMark,
  Button,
  Field,
  IconCalendar,
  IconCheck,
  IconClock,
  IconDoor,
  IconLogout,
  IconUsers,
  Input,
} from "@/components/ui";

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
const QUICK_MINUTES = [30, 60, 90, 120, 240]; // 빠른 길이 선택 버튼

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
function addMinutes(local: string, m: number) {
  const d = new Date(local);
  d.setMinutes(d.getMinutes() + m);
  return toLocalInput(d);
}
function startOfDay(d: Date) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
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
  new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
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

  // "오늘/내일" 표시용 기준 날짜 (렌더마다 바뀌지 않게 처음 한 번만)
  const [today] = useState(() => startOfDay(new Date()));
  // 기본값: 다음 정각부터 1시간
  const [startAt, setStartAt] = useState(() => toLocalInput(nextHour()));
  const [endAt, setEndAt] = useState(() => addMinutes(toLocalInput(nextHour()), 60));
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

  // 알림(성공/실패 모두)은 3초 뒤 자동으로 사라지게.
  // msg 는 매번 새 객체라, 같은 메시지가 다시 떠도 타이머가 새로 시작된다.
  useEffect(() => {
    if (!msg) return;
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

  // 날짜별로 묶기 + 오늘/내일 태그 (지난 예약은 fetchUpcoming 에서 이미 제외됨)
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; tag: string | null; list: Reservation[] }>();
    for (const r of reservations) {
      const label = fmtDay(r.start_at);
      const group = map.get(label);
      if (group) {
        group.list.push(r);
      } else {
        const diff = Math.round((startOfDay(new Date(r.start_at)) - today) / 86400000);
        map.set(label, {
          label,
          tag: diff === 0 ? "오늘" : diff === 1 ? "내일" : null,
          list: [r],
        });
      }
    }
    return [...map.values()];
  }, [reservations, today]);

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
    if (v && new Date(endAt) <= new Date(v)) setEndAt(addMinutes(v, 60));
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
    if (!res.ok) return setMsg({ kind: "err", text: json.error }); // 409(겹침) 포함
    setMsg({ kind: "ok", text: "예약이 완료됐어요" });
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

  // ---- 화면 ---------------------------------------------------------------
  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">회의실 예약</div>
              <div className="text-[11px] text-ink-2">겹치는 예약은 DB 제약으로 차단</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar name={userLabel} />
            <span className="hidden text-sm sm:inline">
              <b>{userLabel}</b> 님
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <IconLogout className="h-3.5 w-3.5" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        {/* 회의실 선택 (카드) */}
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="font-semibold">회의실</h2>
            <span className="text-xs text-ink-2">예약할 회의실을 선택하세요</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {rooms.map((r) => {
              const selected = r.id === roomId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoomId(r.id)}
                  className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-brand bg-brand-soft/60 ring-2 ring-brand/30"
                      : "border-line bg-surface hover:border-ink-2/40 hover:shadow-sm"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      selected ? "bg-brand text-white" : "bg-surface-2 text-ink-2"
                    }`}
                  >
                    <IconDoor className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-2">
                      <IconUsers className="h-3.5 w-3.5" />
                      최대 {r.capacity}명
                    </span>
                  </span>
                  {selected && (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* 예약 폼 */}
          <form
            onSubmit={book}
            className="flex h-fit flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
          >
            <div>
              <h2 className="font-semibold">새 예약</h2>
              <p className="text-xs text-ink-2">{selectedRoom?.name ?? "회의실을 선택하세요"}</p>
            </div>

            <Field label="시작">
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => onStartChange(e.target.value)}
              />
            </Field>
            <Field label="종료">
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </Field>

            {/* 빠른 길이 선택 + 길이 미리보기 */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEndAt(addMinutes(startAt, m))}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      minutes === m
                        ? "border-brand bg-brand text-white"
                        : "border-line text-ink-2 hover:border-ink-2/50 hover:text-ink"
                    }`}
                  >
                    {durationLabel(m)}
                  </button>
                ))}
              </div>
              <p
                className={`flex items-center gap-1.5 text-xs ${
                  durationError ? "text-rose-500" : "text-ink-2"
                }`}
              >
                <IconClock className="h-3.5 w-3.5" />
                {durationError ?? `${durationLabel(minutes)} 예약 · 최대 4시간`}
              </p>
            </div>

            <Field label="제목 (선택)">
              <Input
                placeholder="예: 주간 스프린트 회의"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Button type="submit" disabled={!!durationError || busy === "book"} className="w-full">
              {busy === "book" ? "예약 중..." : "예약하기"}
            </Button>
          </form>

          {/* 예약 현황 */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold">예약 현황</h2>
              <span className="text-xs text-ink-2">
                {loadingList ? "불러오는 중" : `다가오는 예약 ${reservations.length}건`}
              </span>
            </div>

            {loadingList ? (
              // 로딩 스켈레톤
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              // 빈 상태
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <IconCalendar className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium">예정된 예약이 없어요</p>
                <p className="text-xs text-ink-2">왼쪽에서 첫 예약을 만들어 보세요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(({ label, tag, list }) => (
                  <div key={label}>
                    {/* 날짜 헤더 */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink-2">{label}</span>
                      {tag && (
                        <span className="rounded-full bg-brand-soft px-2 py-px text-[11px] font-medium text-brand">
                          {tag}
                        </span>
                      )}
                    </div>

                    <ul className="flex flex-col gap-2">
                      {list.map((r) => {
                        const participants = r.reservation_participants ?? [];
                        const joined = participants.some((p) => p.user_id === userId);
                        const isMine = r.user_id === userId;
                        return (
                          <li
                            key={r.id}
                            className={`flex gap-3 rounded-xl border p-3 ${
                              isMine ? "border-brand/40 bg-brand-soft/50" : "border-line"
                            }`}
                          >
                            {/* 시간 */}
                            <div
                              className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-lg py-2 font-mono text-xs ${
                                isMine ? "bg-brand text-white" : "bg-surface-2"
                              }`}
                            >
                              <span className="font-semibold">{fmtTime(r.start_at)}</span>
                              <span className={`my-0.5 h-3 w-px ${isMine ? "bg-white/40" : "bg-line"}`} />
                              <span className={isMine ? "text-white/80" : "text-ink-2"}>
                                {fmtTime(r.end_at)}
                              </span>
                            </div>

                            {/* 내용 */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{r.title || "(제목 없음)"}</span>
                                {isMine && (
                                  <span className="shrink-0 rounded-full bg-brand px-1.5 py-px text-[10px] font-medium text-white">
                                    내 예약
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
                                <Avatar name={r.host_name ?? "?"} size="sm" />
                                {r.host_name ?? "알 수 없음"}
                              </div>

                              {/* 참석자 (M:N) */}
                              {participants.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                  <IconUsers className="mr-0.5 h-3.5 w-3.5 text-ink-2" />
                                  {participants.map((p) => {
                                    const name = p.profiles?.display_name ?? "알 수 없음";
                                    return (
                                      <span
                                        key={p.user_id}
                                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-2 pl-0.5 text-xs"
                                      >
                                        <Avatar name={name} size="sm" />
                                        {name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 동작 */}
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Button
                                size="sm"
                                variant={joined ? "secondary" : "primary"}
                                onClick={() => toggleJoin(r.id, joined)}
                                disabled={busy === `join-${r.id}`}
                              >
                                {joined ? "참석 취소" : "참석"}
                              </Button>
                              {/* 내 예약만 취소 버튼 노출 (서버/RLS 에서도 본인만 허용) */}
                              {isMine && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => cancel(r.id)}
                                  disabled={busy === `cancel-${r.id}`}
                                >
                                  예약 취소
                                </Button>
                              )}
                            </div>
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
    </div>
  );
}
