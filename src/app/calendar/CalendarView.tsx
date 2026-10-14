"use client";

// 주간 캘린더 화면 (읽기 전용).
// 회의실 하나를 골라 7일 × 시간 격자에 확정 예약을 블록으로 그린다.
// 한 열(하루) 안에서 블록이 절대 겹치지 않는 것 = DB 의 EXCLUSION 제약이 보장하는 것.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, BrandMark, Button, IconClock, IconLogout, IconUsers } from "@/components/ui";

type Room = { id: number; name: string; capacity: number };
type Reservation = {
  id: number;
  room_id: number;
  user_id: string;
  host_name: string | null;
  title: string | null;
  start_at: string;
  end_at: string;
  reservation_participants: { user_id: string; profiles: { display_name: string } | null }[];
};
type Block = { r: Reservation; top: number; height: number };

const HOUR_START = 8; // 표시 시간대 08:00 – 22:00
const HOUR_END = 22;
const ROW_H = 44; // 1시간 높이(px)
const TOTAL_MIN = (HOUR_END - HOUR_START) * 60;
const TOTAL_PX = (HOUR_END - HOUR_START) * ROW_H;
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

// ---- 날짜 유틸 --------------------------------------------------------------
function startOfDay(d: Date) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}
function startOfWeek(d: Date) {
  // 월요일 00:00
  const t = startOfDay(d);
  const dow = (t.getDay() + 6) % 7; // 월=0 … 일=6
  t.setDate(t.getDate() - dow);
  return t;
}
function addDays(d: Date, n: number) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}
const fmtMD = (d: Date) => d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtFull = (s: string) =>
  new Date(s).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// 한 주 치 예약을 한 번에 가져온다 (서버의 from/to 기간 필터 사용)
async function fetchWeek(roomId: number, weekStart: Date): Promise<Reservation[]> {
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();
  const res = await fetch(`/api/reservations?roomId=${roomId}&from=${from}&to=${to}&limit=50`);
  const json = await res.json();
  return (json.reservations ?? []) as Reservation[];
}

export default function CalendarView({ userId, userLabel }: { userId: string; userLabel: string }) {
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [today] = useState(() => startOfDay(new Date()).getTime());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Reservation | null>(null);

  const loading = loadedKey !== `${roomId}:${weekStart.getTime()}`;

  // ---- 데이터 로드 --------------------------------------------------------
  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((j) => {
        setRooms(j.rooms ?? []);
        if (j.rooms?.[0]) setRoomId(j.rooms[0].id);
      });
  }, []);

  // 방이나 주가 바뀌면 그 주의 예약을 불러온다 (늦게 온 이전 응답은 무시)
  useEffect(() => {
    if (roomId == null) return;
    let ignore = false;
    fetchWeek(roomId, weekStart).then((list) => {
      if (ignore) return;
      setReservations(list);
      setLoadedKey(`${roomId}:${weekStart.getTime()}`);
      setSelected(null);
    });
    return () => {
      ignore = true;
    };
  }, [roomId, weekStart]);

  // ---- 파생 값 ------------------------------------------------------------
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // 요일별 블록 위치 계산: 시작/끝 분(分)을 픽셀로 바꾸고, 표시 범위(08–22시) 밖은 잘라낸다
  const byDay = useMemo(() => {
    const map = new Map<number, Block[]>();
    for (const r of reservations) {
      const s = new Date(r.start_at);
      const e = new Date(r.end_at);
      const dayIdx = Math.round((startOfDay(s).getTime() - weekStart.getTime()) / 86400000);
      if (dayIdx < 0 || dayIdx > 6) continue;
      const sMin = s.getHours() * 60 + s.getMinutes() - HOUR_START * 60;
      // 자정을 넘기는 예약은 그 날의 끝까지로 잘라서 그린다
      const crossesMidnight = startOfDay(e).getTime() > startOfDay(s).getTime();
      const eMin = crossesMidnight ? TOTAL_MIN : e.getHours() * 60 + e.getMinutes() - HOUR_START * 60;
      const top = Math.max(0, sMin);
      const bottom = Math.min(TOTAL_MIN, eMin);
      if (bottom <= top) continue; // 표시 범위 밖
      const list = map.get(dayIdx) ?? [];
      list.push({ r, top: (top / 60) * ROW_H, height: Math.max(18, ((bottom - top) / 60) * ROW_H - 2) });
      map.set(dayIdx, list);
    }
    return map;
  }, [reservations, weekStart]);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // ---- 화면 ---------------------------------------------------------------
  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">예약 캘린더</div>
              <div className="text-[11px] text-ink-2">확정 예약 현황 · 한 열 안에서 블록은 절대 겹치지 않아요</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/rooms"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-strong"
            >
              <IconClock className="h-3.5 w-3.5" />
              예약하기
            </Link>
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

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        {/* 회의실 탭 */}
        <div className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoomId(r.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                r.id === roomId
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-2 hover:border-ink-2/50 hover:text-ink"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* 주 이동 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ◀ 이전 주
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              이번 주
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              다음 주 ▶
            </Button>
          </div>
          <div className="text-sm font-medium">
            {fmtMD(days[0])} – {fmtMD(days[6])}
            <span className="ml-2 text-xs font-normal text-ink-2">
              {selectedRoom?.name} · {loading ? "불러오는 중…" : `확정 ${reservations.length}건`}
            </span>
          </div>
        </div>

        {/* 격자 */}
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <div className="min-w-[760px]">
            {/* 요일 헤더 */}
            <div className="grid border-b border-line" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
              <div />
              {days.map((d, i) => {
                const isToday = d.getTime() === today;
                return (
                  <div
                    key={i}
                    className={`border-l border-line px-2 py-2 text-center text-xs ${
                      isToday ? "font-semibold text-brand" : "text-ink-2"
                    }`}
                  >
                    {DAY_LABELS[i]} <span className="text-sm">{d.getDate()}</span>
                    {isToday && <span className="ml-1 rounded-full bg-brand-soft px-1.5 text-[10px]">오늘</span>}
                  </div>
                );
              })}
            </div>

            {/* 본문: 시간 눈금 + 7일 */}
            <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
              <div className="relative" style={{ height: TOTAL_PX }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-2"
                    style={{ top: (h - HOUR_START) * ROW_H }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((d, i) => {
                const isToday = d.getTime() === today;
                return (
                  <div
                    key={i}
                    className={`relative border-l border-line ${isToday ? "bg-brand-soft/30" : ""}`}
                    style={{ height: TOTAL_PX }}
                  >
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-line/70"
                        style={{ top: (h - HOUR_START) * ROW_H }}
                      />
                    ))}
                    {(byDay.get(i) ?? []).map(({ r, top, height }) => {
                      const mine = r.user_id === userId;
                      const active = selected?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelected(active ? null : r)}
                          title={`${r.title || "(제목 없음)"} · ${fmtTime(r.start_at)}–${fmtTime(r.end_at)}`}
                          className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition ${
                            mine
                              ? "bg-brand text-white hover:bg-brand-strong"
                              : "border border-brand/30 bg-brand-soft text-ink hover:border-brand"
                          } ${active ? "ring-2 ring-brand/50" : ""}`}
                          style={{ top, height }}
                        >
                          <div className="truncate font-semibold">{r.title || "(제목 없음)"}</div>
                          <div className={`truncate ${mine ? "text-white/80" : "text-ink-2"}`}>
                            {fmtTime(r.start_at)}–{fmtTime(r.end_at)} · {r.host_name ?? "알 수 없음"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 선택한 예약 상세 */}
        {selected && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold">
                {selected.title || "(제목 없음)"}
                {selected.user_id === userId && (
                  <span className="ml-2 rounded-full bg-brand px-1.5 py-px text-[10px] font-medium text-white">내 예약</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-2">
                <IconClock className="h-3.5 w-3.5" />
                {fmtFull(selected.start_at)} – {fmtTime(selected.end_at)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-2">
                <Avatar name={selected.host_name ?? "?"} size="sm" />
                예약자 {selected.host_name ?? "알 수 없음"}
              </div>
              {selected.reservation_participants?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <IconUsers className="mr-0.5 h-3.5 w-3.5 text-ink-2" />
                  {selected.reservation_participants.map((p) => {
                    const name = p.profiles?.display_name ?? "알 수 없음";
                    return (
                      <span
                        key={p.user_id}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pr-2 pl-0.5 text-xs"
                      >
                        <Avatar name={name} size="sm" />
                        {name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              닫기
            </Button>
          </div>
        )}

        <p className="text-xs text-ink-2">
          표시 시간대 {String(HOUR_START).padStart(2, "0")}:00 – {HOUR_END}:00 · 파란 블록은 내 예약, 연한 블록은 다른 사람의 예약
        </p>
      </main>
    </div>
  );
}
