"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Target, Upload } from "lucide-react";
import { createBackup, parseBackup } from "../lib/backup";
import { goals } from "../lib/activity";
import { number, type StudyData } from "../lib/study";
import { Dropdown } from "./dropdown";
import { cx, ui } from "./styles";

export function Settings({ ready, readData, onRestore, goal, onGoal }: {
  ready: boolean;
  goal: number;
  onGoal: (goal: number) => void;
  readData: () => StudyData;
  onRestore: (data: StudyData) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ filename: string; data: StudyData } | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function downloadBackup() {
    try {
      const { filename, content } = createBackup(readData());
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: "دانلود فایل پشتیبان آغاز شد." });
    } catch {
      setMessage({ text: "خواندن اطلاعات مرورگر برای پشتیبان‌گیری ممکن نبود.", error: true });
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setMessage(null);
    setPending(null);
    setReading(true);
    try {
      const content = await file.text();
      try {
        setPending({ filename: file.name, data: parseBackup(content) });
      } catch (error) {
        setMessage({ text: (error as Error).message, error: true });
      }
    } catch {
      setMessage({ text: "خواندن فایل ممکن نبود. دوباره امتحان کن.", error: true });
    } finally {
      setReading(false);
    }
  }

  function restoreBackup() {
    if (!pending) return;
    try {
      onRestore(pending.data);
      setPending(null);
      setMessage({ text: "اطلاعات از فایل پشتیبان بازیابی شد." });
    } catch {
      setMessage({ text: "ذخیرهٔ اطلاعات در مرورگر ممکن نبود. دوباره امتحان کن.", error: true });
    }
  }

  return (
    <>
      <div className={ui.pageHeading}><h1>تنظیمات</h1></div>
      <section className={cx(ui.surface, "mb-4 grid max-w-[720px] gap-3 p-5 phone:p-3.5")} aria-labelledby="goal-heading">
        <h2 id="goal-heading" className="flex items-center gap-2"><Target size={20} />هدف روزانهٔ مطالعه</h2>
        <div className="max-w-48">
          <Dropdown label="هدف روزانهٔ مطالعه" value={String(goal)} onChange={(value) => onGoal(Number(value))}
            items={goals.map((n) => ({ value: String(n), label: number(n) + " دقیقه در روز" }))} />
        </div>
        <p className={ui.muted}>زمان‌سنج را از نوار بالا روشن کن. هنگام تمرین خودش شروع می‌شود. با عوض کردن زبانه مکث می‌کند و وقتی برگردی ادامه می‌دهد. بستن صفحه زمان ثبت‌شده را ذخیره می‌کند.</p>
      </section>
      <section className={cx(ui.surface, "grid max-w-[720px] gap-4 p-5 phone:p-3.5")} aria-labelledby="backup-heading">
        <div className="grid gap-1">
          <h2 id="backup-heading">پشتیبان‌گیری و بازیابی</h2>
          <p className={ui.muted}>مجموعه‌ها، واژه‌های اضافه‌شده، پیشرفت تمرین، تاریخچهٔ پاسخ‌ها، زمان مطالعه، هدف روزانه و تم را در یک فایل JSON ذخیره کن.</p>
        </div>

        <div className={ui.buttonRow}>
          <button className={cx(ui.button, ui.primary)} type="button" disabled={!ready || reading} onClick={downloadBackup}>
            <Download size={17} /> گرفتن بک‌آپ
          </button>
          <button className={cx(ui.button, ui.secondary)} type="button" disabled={!ready || reading} onClick={() => fileInput.current?.click()}>
            <Upload size={17} /> بازیابی بک‌آپ
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={selectBackup} />
        </div>

        {reading && <p role="status" className={ui.muted}>در حال خواندن فایل…</p>}
        {pending && (
          <div className="grid gap-3 rounded-xl border border-(--line) bg-(--soft) p-3.5">
            <div role="status" className="grid gap-1 wrap-anywhere">
              <p className="font-bold"><bdi>{pending.filename}</bdi></p>
              <p className={ui.muted}>
                {number(pending.data.decks.length)} مجموعهٔ شخصی، {number(Object.keys(pending.data.reviews).length)} واژهٔ مرورشده و {number(Object.keys(pending.data.activity).length)} روز در تاریخچهٔ مطالعه
              </p>
              <p>با تأیید، اطلاعات فعلی واژه‌یار در این مرورگر با محتوای فایل جایگزین می‌شود.</p>
            </div>
            <div className={ui.buttonRow}>
              <button className={cx(ui.button, ui.primary)} type="button" onClick={restoreBackup}>تأیید بازیابی</button>
              <button className={cx(ui.button, ui.secondary)} type="button" onClick={() => { setPending(null); setMessage(null); }}>انصراف</button>
            </div>
          </div>
        )}
        {message && <p role={message.error ? "alert" : "status"} className={message.error ? ui.errorText : ui.muted}>{message.text}</p>}
      </section>
    </>
  );
}
