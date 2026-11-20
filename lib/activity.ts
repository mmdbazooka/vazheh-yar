import type { Direction, Mode, Rating } from "./study";

export type Drill = Exclude<Mode, "smart">;
export const drills: Drill[] = ["flash", "choice", "type", "listen", "match"];
export type Outcomes = [missed: number, hard: number, correct: number];
export type PromptDirection = Exclude<Direction, "mixed">;
export type StudyDay = {
  milliseconds: number; results: Partial<Record<Drill, Outcomes>>;
  directions: Partial<Record<PromptDirection, Outcomes>>; recovered: number;
};
export type Activity = Record<string, StudyDay>;
export type StudyTimer = { startedAt: number; since: number; owner: string; source: "manual" | "practice" };
export type Period = "day" | "week" | "month";

export const minute = 60_000;
export const goals = [5, 10, 15, 20, 30, 45, 60];
export const defaultGoal = 15;
export const emptyDay = (): StudyDay => ({ milliseconds: 0, results: {}, directions: {}, recovered: 0 });
const digits = new Intl.NumberFormat("fa-IR");
const persianDay = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { day: "numeric" });
const fullDate = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" });
const weekday = new Intl.DateTimeFormat("fa-IR", { weekday: "short" });
const monthOnly = new Intl.DateTimeFormat("fa-IR", { month: "short" });
const monthYear = new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" });

// Keep local calendar dates stable in a backup, including when it moves to another time zone.
export function dayKey(time: number) {
  const d = new Date(time);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function midnight(time: number) {
  return new Date(time).setHours(0, 0, 0, 0);
}

export function shiftDays(time: number, days: number) {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.setHours(0, 0, 0, 0);
}

export function periodStart(time: number, period: Period) {
  const start = midnight(time);
  if (period === "week") return shiftDays(start, -((new Date(start).getDay() + 1) % 7));
  if (period === "month") return shiftDays(start, 1 - Number(persianDay.format(start)));
  return start;
}

function adjacent(start: number, period: Period, step: 1 | -1) {
  if (period === "month") return periodStart(shiftDays(start, step === 1 ? 32 : -1), period);
  return shiftDays(start, step * (period === "week" ? 7 : 1));
}

export const dateLabel = (time: number) => fullDate.format(time);
export const weekLabel = (time: number) => weekday.format(time);
export const weekdayInitial = (time: number) => ["ی", "د", "س", "چ", "پ", "ج", "ش"][new Date(time).getDay()];

export function durationLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return digits.format(seconds) + " ثانیه";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return digits.format(minutes) + " دقیقه";
  const rest = minutes % 60;
  return digits.format(Math.floor(minutes / 60)) + " ساعت" + (rest ? " و " + digits.format(rest) + " دقیقه" : "");
}

export function addStudyTime(activity: Activity, from: number, to: number): Activity {
  if (to <= from) return activity;
  const next = { ...activity };
  for (let cursor = from; cursor < to;) {
    const end = Math.min(to, shiftDays(midnight(cursor), 1));
    const key = dayKey(cursor);
    const day = next[key] ?? emptyDay();
    next[key] = { ...day, milliseconds: day.milliseconds + end - cursor };
    cursor = end;
  }
  return next;
}

// Background tabs can go minutes without running a checkpoint.
export function timerIsLive(timer: StudyTimer | null, now: number): timer is StudyTimer {
  return !!timer && now >= timer.since;
}

export function activityAt(activity: Activity, timer: StudyTimer | null, now: number) {
  return timerIsLive(timer, now) ? addStudyTime(activity, timer.since, now) : activity;
}

export type AnswerContext = { drill: Drill; direction?: PromptDirection; revisit?: boolean };

export function logAnswer(activity: Activity, time: number, { drill, revisit, direction }: AnswerContext, rating: Rating, previous?: Rating): Activity {
  const key = dayKey(time);
  const day = activity[key] ?? emptyDay();
  if (revisit) {
    const recovered = day.recovered + Number(rating === 2) - Number(previous === 2);
    return recovered === day.recovered ? activity : { ...activity, [key]: { ...day, recovered } };
  }
  function tally(prior?: Outcomes): Outcomes {
    const counts: Outcomes = prior ? [...prior] : [0, 0, 0];
    if (previous !== undefined) counts[previous] = Math.max(0, counts[previous] - 1);
    counts[rating]++;
    return counts;
  }
  const results = { ...day.results, [drill]: tally(day.results[drill]) };
  const directions = direction ? { ...day.directions, [direction]: tally(day.directions[direction]) } : day.directions;
  return { ...activity, [key]: { ...day, results, directions } };
}

export const countOutcomes = (counts: Outcomes) => counts[0] + counts[1] + counts[2];

export function sumOutcomes(values: Outcomes[]): Outcomes {
  return values.reduce<Outcomes>((sum, row) => [sum[0] + row[0], sum[1] + row[1], sum[2] + row[2]], [0, 0, 0]);
}

export function recentDirections(activity: Activity, now: number) {
  const days = Array.from({ length: 7 }, (_, i) => activity[dayKey(shiftDays(now, -i))]);
  const sum = (direction: PromptDirection) => sumOutcomes(days.flatMap((day) => day?.directions[direction] ? [day.directions[direction]] : []));
  return { "en-fa": sum("en-fa"), "fa-en": sum("fa-en") };
}

export function startingDirection(activity: Activity, now: number): PromptDirection {
  const counts = recentDirections(activity, now);
  const en = countOutcomes(counts["en-fa"]);
  const fa = countOutcomes(counts["fa-en"]);
  if (en >= 3 && fa >= 3) {
    const diff = counts["en-fa"][2] / en - counts["fa-en"][2] / fa;
    if (Math.abs(diff) >= 0.1) return diff > 0 ? "fa-en" : "en-fa";
  }
  return fa < en ? "fa-en" : "en-fa";
}

export function activeStreak(activity: Activity, now: number) {
  const active = (time: number) => {
    const day = activity[dayKey(time)];
    return day && (day.milliseconds > 0 || Object.keys(day.results).length > 0 || day.recovered > 0);
  };
  let cursor = midnight(now);
  if (!active(cursor)) cursor = shiftDays(cursor, -1);
  let streak = 0;
  while (active(cursor)) { streak++; cursor = shiftDays(cursor, -1); }
  return streak;
}

export function timeSeries(activity: Activity, period: Period, now: number, page: number) {
  const size = period === "month" ? 6 : period === "week" ? 8 : 7;
  let current = periodStart(now, period);
  for (let i = 0; i < page * size; i++) current = adjacent(current, period, -1);
  // Include one extra bucket so even the oldest visible bar has a comparison.
  const rows: { start: number; label: string; short: string; full: string; value: number }[] = [];
  for (let i = 0; i <= size; i++) {
    const end = adjacent(current, period, 1);
    let value = 0;
    for (let cursor = current; cursor < end; cursor = shiftDays(cursor, 1)) value += activity[dayKey(cursor)]?.milliseconds ?? 0;
    const label = period === "month" ? monthOnly.format(current) : period === "week" ? shortDate.format(current) : weekday.format(current);
    const full = period === "month" ? monthYear.format(current) : period === "week"
      ? shortDate.format(current) + " تا " + fullDate.format(shiftDays(end, -1)) : fullDate.format(current);
    rows.unshift({ start: current, label, short: period === "day" ? weekdayInitial(current) : label, full, value });
    current = adjacent(current, period, -1);
  }
  return rows.slice(1).map((row, i) => ({ ...row, previous: rows[i].value }));
}
