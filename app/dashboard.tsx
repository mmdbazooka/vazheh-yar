"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, BarChart3, CalendarDays, CalendarRange, ChartNoAxesColumn, CheckCheck,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, Flame, Layers3, LibraryBig, Target, Timer,
  type LucideIcon,
} from "lucide-react";
import {
  activeStreak, activityAt, countOutcomes, dateLabel, dayKey, drills, durationLabel, midnight, minute,
  recentDirections, shiftDays, sumOutcomes, timeSeries, weekdayInitial, weekLabel, type Activity, type Drill, type Outcomes, type Period, type PromptDirection,
} from "../lib/activity";
import { isKnown, number, type Deck, type StudyData } from "../lib/study";
import { modes } from "./modes";
import { cx, tileTone, ui } from "./styles";

const panel = cx(ui.surface, "min-w-0 p-5 phone:p-3.5");
const caption = "text-[13px] text-(--muted)";
const ink = ["var(--peach-text)", "var(--purple-text)", "var(--accent)"];
const outcomeNames = ["اشتباه", "با مکث یا راهنما", "درست و مستقل"];

function PanelTitle({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h2 className="flex items-center gap-2 text-[18px]"><Icon size={18} className="text-(--accent)" />{title}</h2>
    {children}
  </div>;
}

type Bar = { label: string; short: string; full: string; value: number; counts?: Outcomes };

function Bars({ rows, selected, onSelect, format, label }: {
  rows: Bar[]; selected: number; onSelect: (index: number) => void; format: (n: number) => string; label: string;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return <div role="group" aria-label={label} dir="ltr" className="flex items-start gap-2 pt-2">
    {max > 0 && <span aria-hidden="true" dir="rtl" className="flex h-26 max-w-14 shrink-0 flex-col justify-between text-end text-[10px] leading-tight text-(--muted)">
      <span>{format(max)}</span><span>۰</span>
    </span>}
    <div className="relative isolate grid min-w-0 flex-1 grid-flow-col auto-cols-fr gap-1">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-1 flex h-26 flex-col justify-between">
      {[0, 1, 2].map((line) => <i key={line} className="w-full border-t border-dashed border-(--line)" />)}
    </div>
    {rows.map((row, i) => <button type="button" key={row.full}
      aria-pressed={i === selected} aria-label={row.full + "، " + format(row.value)} title={row.full + " · " + format(row.value)}
      className="group min-w-0 rounded-md! text-center text-(--muted) hover:bg-(--soft) aria-pressed:text-(--accent)"
      onClick={() => onSelect(i)}>
      <span className="flex h-26 items-end justify-center">
        <span className="flex w-[55%] max-w-12 flex-col-reverse overflow-hidden rounded-t-[5px]"
          style={{ height: row.value ? Math.max(3, row.value / max * 100) + "%" : 2, background: row.value ? "var(--accent)" : "var(--line)" }}>
          {row.counts && row.value > 0 && row.counts.map((n, j) =>
            <span key={j} style={{ height: n / row.value * 100 + "%", background: ink[j] }} />)}
        </span>
      </span>
      <span dir="rtl" className="mt-1.5 block overflow-hidden rounded py-1 text-[11px] group-aria-pressed:bg-(--accent-soft) group-aria-pressed:font-bold">
        <span className="phone:hidden">{row.label}</span><span className="hidden phone:inline">{row.short}</span>
      </span>
    </button>)}
    </div>
  </div>;
}

const periods = { day: "روزانه", week: "هفتگی", month: "ماهانه" } as const;
const previousNames = { day: "روز قبل", week: "هفتهٔ قبل", month: "ماه قبل" };

function TimeChart({ activity, now }: { activity: Activity; now: number }) {
  const [period, setPeriod] = useState<Period>("day");
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const rows = timeSeries(activity, period, now, page);
  const index = selection ?? rows.length - 1;
  const row = rows[index];
  const measured = Object.entries(activity).filter(([, day]) => day.milliseconds > 0);
  const earlier = measured.some(([key]) => key < dayKey(rows[0].start));
  function turn(to: number) { setPage(to); setSelection(null); }
  const delta = row.value - row.previous;

  return <section className={panel} aria-label="نمودار زمان مطالعه">
    <PanelTitle icon={Clock3} title="زمان مطالعه">
      <div className="flex rounded-lg bg-(--soft) p-0.5" role="group" aria-label="بازهٔ نمودار زمان">
        {(Object.keys(periods) as Period[]).map((p) => <button key={p} aria-pressed={period === p}
          className="rounded-md! px-2.5 py-1 text-[12px] text-(--muted) aria-pressed:bg-(--surface) aria-pressed:font-bold aria-pressed:text-(--accent)"
          onClick={() => { setPeriod(p); turn(0); }}>{periods[p]}</button>)}
      </div>
    </PanelTitle>
    <div className="mb-4 flex items-center justify-between gap-2">
      <div><b className="block text-[24px] leading-tight">{durationLabel(row.value)}</b>
        <span className={caption}>{row.full}{page === 0 && index === rows.length - 1 ? " · تا این لحظه" : ""}</span></div>
      <div className="flex gap-1">
        <button className={cx(ui.iconButton, "disabled:opacity-35")} aria-label="بازهٔ قدیمی‌تر" disabled={!earlier} onClick={() => turn(page + 1)}><ChevronRight size={16} /></button>
        <button className={cx(ui.iconButton, "disabled:opacity-35")} aria-label="بازهٔ جدیدتر" disabled={!page} onClick={() => turn(page - 1)}><ChevronLeft size={16} /></button>
      </div>
    </div>
    <Bars rows={rows} selected={index} onSelect={setSelection} format={durationLabel} label="انتخاب بازهٔ مطالعه" />
    <p className={cx(caption, "mt-3 border-t border-(--line) pt-2.5")}>
      {measured.length ? <>{previousNames[period]}، {durationLabel(row.previous)}
        {delta !== 0 && <> · {durationLabel(Math.abs(delta))} {delta > 0 ? "بیشتر" : "کمتر"} در بازهٔ انتخابی</>}</>
        : "برای ثبت اولین نوبت، زمان‌سنج نوار بالا را روشن کن یا یک تمرین شروع کن."}
    </p>
  </section>;
}

function OutcomesChart({ rows }: { rows: (Bar & { counts: Outcomes; recovered: number })[] }) {
  const [selected, setSelected] = useState(6);
  const row = rows[selected];
  return <section className={panel}>
    <PanelTitle icon={BarChart3} title="نتیجهٔ پاسخ‌ها"><span className={caption}>۷ روز اخیر</span></PanelTitle>
    <Bars rows={rows} selected={selected} onSelect={setSelected} format={(n) => number(n) + " پاسخ"} label="نتیجهٔ تلاش اول به تفکیک روز" />
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px]" aria-live="polite">
      {outcomeNames.map((name, i) => <span key={name} className="flex items-center gap-1">
        <i className="size-2 rounded-full" style={{ background: ink[i] }} />{name} <b>{number(row.counts[i])}</b>
      </span>)}
    </div>
    <p className={cx(caption, "mt-1.5")}>{row.full} · {number(row.recovered)} واژه در تلاش دوباره به یاد آمد.</p>
  </section>;
}

function Mastery({ total, learning, known }: { total: number; learning: number; known: number }) {
  const percent = (n: number) => total ? n / total * 100 : 0;
  const rows = [
    { name: "یادگرفته‌شده", value: known, color: "var(--accent)" },
    { name: "در حال یادگیری", value: learning, color: "var(--purple-text)" },
    { name: "تازه", value: total - known - learning, color: "var(--line)" },
  ];
  const gradient = "conic-gradient(var(--accent) " + percent(known) + "%, var(--purple-text) 0 " + percent(known + learning) + "%, var(--line) 0)";
  return <section className={panel}>
    <PanelTitle icon={Layers3} title="تسلط بر واژه‌ها"><span className={caption}>همهٔ مجموعه‌ها</span></PanelTitle>
    <div className="flex min-h-40 flex-wrap items-center justify-evenly gap-3">
      <div className="grid size-32 shrink-0 place-items-center rounded-full" style={{ background: gradient }}>
        <div className="grid size-[105px] place-content-center rounded-full bg-(--surface) text-center">
          <b className="text-[26px]">{number(Math.round(percent(known)))}٪</b><span className={caption}>یادگرفته‌شده</span>
        </div>
      </div>
      <ul className="grid min-w-32 flex-1 gap-2.5 text-[13px]">{rows.map(({ name, value, color }) => <li key={name} className="flex items-center gap-2">
        <i className="size-2.5 rounded-full" style={{ background: color }} />{name}<b className="ms-auto">{number(value)}</b>
      </li>)}</ul>
    </div>
  </section>;
}

type Filter = "due" | "known" | "new";
type Props = {
  data: StudyData; deck: Deck; decks: Deck[]; now: number;
  due: number; fresh: number; mistakes: number; onMistakes: () => void; onReview: () => void; onGoal: () => void;
  onWords: (filter: Filter) => void; onDeck: (deck: Deck) => void; onDrill: (drill: Drill, direction?: PromptDirection) => void;
};

function AccuracyChart({ activity, days, now, onDrill }: Pick<Props, "now" | "onDrill"> & { activity: Activity; days: number[] }) {
  const [group, setGroup] = useState<"method" | "direction">("method");
  const directions = recentDirections(activity, now);
  const rows = group === "direction" ? (["en-fa", "fa-en"] as const).map((direction) => ({
    title: direction === "en-fa" ? "انگلیسی به فارسی" : "فارسی به انگلیسی",
    counts: directions[direction], configure: () => onDrill("type", direction),
  })) : drills.map((drill) => ({
    title: modes[drill].title, configure: () => onDrill(drill),
    counts: sumOutcomes(days.flatMap((d) => {
      const result = activity[dayKey(d)]?.results[drill];
      return result ? [result] : [];
    })),
  }));
  return <section className={panel}>
    <PanelTitle icon={ChartNoAxesColumn} title="دقت در تلاش اول" />
    <div role="group" aria-label="نمایش دقت" className="mb-2 flex gap-1">
      {(["method", "direction"] as const).map((tab) => <button key={tab} className={ui.filterButton}
        aria-pressed={group === tab} onClick={() => setGroup(tab)}>{tab === "method" ? "روش تمرین" : "جهت سؤال"}</button>)}
    </div>
    <div className="grid gap-1">{rows.map(({ title, counts, configure }) => {
      const count = countOutcomes(counts);
      const rate = count ? Math.round(counts[2] / count * 100) : 0;
      return <button key={title} className="grid gap-1 rounded-lg px-1 py-1.5 text-start hover:bg-(--soft)"
        onClick={configure} aria-label={"تنظیم تمرین " + title}>
        <span className="flex items-center justify-between gap-2 text-[13px]"><span>{title}</span>
          <span className="ms-auto text-[12px] text-(--muted)">{count ? number(counts[2]) + " از " + number(count) + " · " + number(rate) + "٪" : "هنوز تمرین نشده"}</span>
          <ArrowLeft size={13} className="text-(--accent)" /></span>
        <span className="h-1.5 overflow-hidden rounded-full bg-(--soft)"><span className="block h-full rounded-full bg-(--blue-text)" style={{ width: rate + "%" }} /></span>
      </button>;
    })}</div>
    <p className={cx(caption, "mt-2")}>نتیجهٔ ۷ روز اخیر · هر ردیف، تمرین همان مهارت را باز می‌کند.</p>
  </section>;
}

export function Dashboard({ data, deck, decks, now, due, fresh, mistakes, onMistakes, onReview, onGoal, onWords, onDeck, onDrill }: Props) {
  const activity = activityAt(data.activity, data.timer, now);
  const today = midnight(now);
  const ms = activity[dayKey(today)]?.milliseconds ?? 0;
  const goal = data.dailyGoal * minute;
  const progress = Math.min(100, Math.floor(ms / goal * 100));
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(today, i - 6));
  const answers = days.map((day) => {
    const entry = activity[dayKey(day)];
    const counts = sumOutcomes(Object.values(entry?.results ?? {}));
    return { label: weekLabel(day), short: weekdayInitial(day), full: dateLabel(day), value: countOutcomes(counts), counts, recovered: entry?.recovered ?? 0 };
  });
  const allCounts = sumOutcomes(answers.map((row) => row.counts));
  const firstAttempts = countOutcomes(allCounts);
  const words = useMemo(() => decks.flatMap((d) => d.words), [decks]);
  const reviews = useMemo(() => words.map((w) => data.reviews[w.id]).filter(Boolean), [words, data.reviews]);
  const known = reviews.filter(isKnown).length;
  const dueStarts = Array.from({ length: 8 }, (_, i) => shiftDays(today, i));
  const dueRows = dueStarts.slice(0, 7).map((day, i) => ({
    label: i ? weekLabel(day) : "امروز", short: i ? weekdayInitial(day) : "امروز", full: dateLabel(day),
    value: reviews.filter((r) => r.due < dueStarts[i + 1] && (!i || r.due >= day)).length,
  }));
  const [forecast, setForecast] = useState(0);
  const daily = Math.min(10, due + Math.min(6, fresh));
  const activeKnown = deck.words.filter((word) => isKnown(data.reviews[word.id])).length;

  return <div className="grid gap-4 phone:gap-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h1>داشبورد یادگیری</h1>
      <span className={cx(caption, "flex items-center gap-1.5")}><CalendarDays size={15} />{dateLabel(now)}</span>
    </div>
    <div className="grid grid-cols-[1.35fr_1fr_1fr] gap-3 phone:grid-cols-2 phone:gap-2">
      <section className="rounded-[15px] bg-linear-to-bl from-(--hero) to-(--hero-deep) px-5 py-4 text-[#eff8ec] phone:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[14px]"><Timer size={17} />مطالعهٔ امروز</h2>
          <button className="text-[12px] text-[#d5edca] underline-offset-3 hover:underline" onClick={onGoal}>تنظیم هدف</button>
        </div>
        <p className="my-1 text-[25px] font-bold">{durationLabel(ms)} <span className="text-[12px] font-normal text-[#daeadb]">از {number(data.dailyGoal)} دقیقه</span></p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="هدف زمانی امروز" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#c5eca8]" style={{ width: progress + "%" }} />
        </div>
      </section>
      {[
        { icon: Flame, tone: "peach" as const, title: "روزهای پی‌درپی", value: number(activeStreak(activity, now)), detail: "روز مطالعه یا تمرین" },
        { icon: CheckCheck, tone: "blue" as const, title: "یادآوری در تلاش اول", value: firstAttempts ? number(Math.round(allCounts[2] / firstAttempts * 100)) + "٪" : "—", detail: number(firstAttempts) + " پاسخ در ۷ روز اخیر" },
      ].map(({ icon: Icon, tone, title, value, detail }) => <section key={title} className={cx(panel, "flex items-center gap-3 phone:flex-col phone:items-start phone:gap-1")}>
        <span className={cx(ui.iconTile, tileTone[tone], "phone:size-8")}><Icon size={19} /></span>
        <div><h2 className="text-[13px] font-medium text-(--muted)">{title}</h2><b className="block text-[25px] leading-tight">{value}</b><small className={caption}>{detail}</small></div>
      </section>)}
    </div>

    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 list-small:grid-cols-1">
      <TimeChart activity={activity} now={now} />
      <section className={cx(panel, "flex flex-col")}>
        <PanelTitle icon={Target} title="مرور پیشنهادی" />
        <p className="mb-3 font-semibold">{deck.name}</p>
        {([{ name: "آمادهٔ مرور", value: due, filter: "due" }, { name: "واژه‌های تازه", value: fresh, filter: "new" }, { name: "یادگرفته‌شده", value: activeKnown, filter: "known" }] as const)
          .map(({ name, value, filter }) => <button key={name} onClick={() => onWords(filter)}
            className="flex items-center justify-between gap-1 border-b border-(--line) py-1.5 text-[13px] text-(--muted) hover:text-(--accent)">{name}<b>{number(value)}</b></button>)}
        <div className={cx(ui.buttonRow, "mt-4")}>
          <button className={cx(ui.button, ui.primary)} onClick={onReview}>
            {daily ? "تمرین امروز · " + number(daily) + " واژه" : "تنظیم تمرین"}<ArrowLeft size={16} />
          </button>
          {mistakes > 0 && <button className={ui.textButton} onClick={onMistakes}>مرور {number(mistakes)} اشتباه</button>}
        </div>
      </section>
    </div>

    <div className="grid grid-cols-2 gap-4 list-small:grid-cols-1">
      <OutcomesChart rows={answers} />
      <Mastery total={words.length} known={known} learning={reviews.length - known} />
      <AccuracyChart activity={activity} days={days} now={now} onDrill={onDrill} />
      <section className={panel}>
        <PanelTitle icon={CalendarRange} title="صف مرور پیش رو"><span className={caption}>همهٔ مجموعه‌ها</span></PanelTitle>
        <p className={cx(caption, "mb-3")}>مرورهای عقب‌افتاده در ستون امروز هستند.</p>
        <Bars rows={dueRows} selected={forecast} onSelect={setForecast} label="واژه‌های موعد مرور" format={(n) => number(n) + " واژه"} />
        <p aria-live="polite" className={cx(caption, "mt-2")}>{dueRows[forecast].full} · {number(dueRows[forecast].value)} واژه</p>
      </section>
    </div>
    <details className={cx(ui.surface, ui.deckCatalog)}>
      <summary className={ui.catalogSummary}><LibraryBig size={19} /><span>همهٔ مجموعه‌ها</span>
        <span className={ui.catalogCount}>{number(decks.length)} مجموعه · {number(words.length)} واژه و عبارت</span>
        <ChevronDown size={17} className={ui.catalogChevron} /></summary>
      <div className={ui.catalogGrid}>{decks.map((d) => <button key={d.id} className={cx(ui.button, ui.secondary, ui.catalogButton)} onClick={() => onDeck(d)}>
        <span>{d.name}</span><small>{number(d.words.length)}</small></button>)}</div>
    </details>
  </div>;
}
