import { StickyNote } from "lucide-react";
import { wordNoteLimit } from "../lib/study";
import { cx, ui } from "./styles";

export function WordNoteField({ note, onChange }: { note: string; onChange: (note: string) => void }) {
  return <label className={ui.fieldLabel}>مثال یا یادداشت (اختیاری)
    <textarea className={cx(ui.field, "resize-y phone:text-[16px]")} dir="auto" rows={3}
      maxLength={wordNoteLimit} value={note} onChange={(event) => onChange(event.target.value)}
      placeholder="جملهٔ مثال، نکتهٔ کاربردی یا هر یادداشت دیگری…" />
  </label>;
}

export function WordNote({ note }: { note?: string }) {
  if (typeof note !== "string" || !note) return null;
  return <div className="mt-2 flex items-start gap-2 rounded-lg bg-(--soft) px-2.5 py-1.5 text-start text-[13px] text-(--muted)">
    <StickyNote size={15} className="mt-1 text-(--accent)" aria-label="مثال یا یادداشت" />
    <p dir="auto" className="min-w-0 whitespace-pre-wrap wrap-anywhere">{note}</p>
  </div>;
}
