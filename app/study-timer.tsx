"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { activityAt, dayKey, durationLabel, midnight, timerIsLive, type StudyTimer } from "../lib/activity";
import { type StudyData } from "../lib/study";
import type { ChangeData } from "./use-study-store";
import { cx, ui } from "./styles";

export function useStudyTimer(change: ChangeData) {
  const owner = useRef("");
  const practice = useRef<{ from: number; milliseconds: number } | null>(null);
  const start = useCallback((source: StudyTimer["source"], takeOver = false) => {
    if (!owner.current) owner.current = crypto.getRandomValues(new Uint32Array(3)).join("-");
    const now = Date.now();
    change((data) => {
      if (timerIsLive(data.timer, now) && (!takeOver || data.timer.owner === owner.current)) return data;
      return { ...data, activity: activityAt(data.activity, data.timer, now), timer: { owner: owner.current, source, since: now, startedAt: now } };
    });
  }, [change]);

  const checkpoint = useCallback((action: "tick" | "pause" | "leave" | "finish") => {
    const now = Date.now();
    change((data) => {
      const timer = data.timer;
      if (!timer || (action !== "pause" && timer.owner !== owner.current)) return data;
      const live = timerIsLive(timer, now);
      if (practice.current && live && timer.owner === owner.current) {
        practice.current.milliseconds += Math.max(0, now - Math.max(practice.current.from, timer.since));
      }
      const running = (action === "tick" || (action === "finish" && timer.source === "manual")) && live;
      return { ...data, activity: activityAt(data.activity, timer, now), timer: running ? { ...timer, since: now } : null };
    });
  }, [change]);

  useEffect(() => {
    const leave = () => checkpoint("leave");
    const visibility = () => checkpoint("tick");
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
    };
  }, [checkpoint]);

  function startPractice() {
    practice.current = { from: Date.now(), milliseconds: 0 };
    start("practice", true);
  }

  function finishPractice() {
    if (!practice.current) return 0;
    checkpoint("finish");
    const elapsed = practice.current.milliseconds;
    practice.current = null;
    return elapsed;
  }

  return { startManual: () => start(practice.current ? "practice" : "manual"), checkpoint, owner, startPractice, finishPractice };
}

export function TimerControl({ data, ready, clock }: {
  data: StudyData; ready: boolean; clock: ReturnType<typeof useStudyTimer>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const { timer } = data;
  const { owner, checkpoint } = clock;
  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    const save = timer.owner === owner.current
      ? window.setInterval(() => checkpoint("tick"), 15_000) : undefined;
    return () => { clearInterval(ticker); clearInterval(save); };
  }, [timer?.owner, timer?.since, checkpoint, owner]);

  const current = timer ? Math.max(timer.since, now) : Date.now();
  const running = timerIsLive(timer, current);
  const saved = data.activity[dayKey(current)]?.milliseconds ?? 0;
  const today = saved + (running ? current - Math.max(timer.since, midnight(current)) : 0);
  const seconds = Math.floor((running ? current - timer.startedAt : today) / 1000);
  const parts = [Math.floor(seconds / 60), seconds % 60];
  const time = parts.map((part) => part.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false })).join(":");
  const label = running ? "مکث زمان‌سنج" : "شروع زمان‌سنج";
  return (
    <button type="button" disabled={!ready} className={cx(ui.button, ui.smallButton, running ? ui.correct : ui.secondary, "shrink-0 gap-1.5!")}
      aria-label={label} aria-pressed={running} aria-description={"مجموع امروز " + durationLabel(today)} title={label + " · مجموع امروز " + durationLabel(today)}
      onClick={() => running ? checkpoint("pause") : clock.startManual()}>
      <Timer size={16} aria-hidden="true" /><span className="phone:sr-only">{running ? "این نوبت" : "زمان امروز"}</span>
      <bdi dir="ltr" className="tabular-nums">{time}</bdi>
      {running ? <Pause size={13} /> : <Play size={13} />}
    </button>
  );
}
