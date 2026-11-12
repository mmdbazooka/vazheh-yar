"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { LibraryChange } from "../lib/decks";
import type { Word } from "../lib/study";
import { cx, ui } from "./styles";

export type LibraryAction =
  | { kind: "rename-deck" | "delete-deck"; name: string }
  | { kind: "edit-word" | "delete-word"; word: Word };

export function LibraryEditor({ action, onSave, onClose }: {
  action: LibraryAction;
  onSave: (change: LibraryChange) => string | undefined;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("name" in action ? action.name : "");
  const [en, setEn] = useState("word" in action ? action.word.en : "");
  const [fa, setFa] = useState("word" in action ? action.word.fa : "");
  const [error, setError] = useState("");
  const deleting = action.kind === "delete-word" || action.kind === "delete-deck";
  const title = {
    "rename-deck": "تغییر نام مجموعه",
    "delete-deck": "حذف مجموعه",
    "edit-word": "ویرایش واژه",
    "delete-word": "حذف واژه",
  }[action.kind];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  function submit() {
    let change: LibraryChange;
    switch (action.kind) {
      case "rename-deck":
        change = { kind: action.kind, name };
        break;
      case "delete-deck":
        change = { kind: action.kind };
        break;
      case "edit-word":
        change = { kind: action.kind, wordId: action.word.id, entry: { en, fa } };
        break;
      case "delete-word":
        change = { kind: action.kind, wordId: action.word.id };
        break;
    }
    const message = onSave(change);
    if (message) setError(message);
    else dialog.current?.close();
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={deleting ? descriptionId : undefined}
      className={cx(ui.surface, "fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[460px] overflow-y-auto p-5 text-(--ink) backdrop:bg-black/50")}
      onClose={onClose}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <h2 id={titleId}>{title}</h2>
        {action.kind === "rename-deck" && (
          <label className={ui.fieldLabel}>نام مجموعه
            <input className={cx(ui.field, "phone:text-[16px]")} value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} />
          </label>
        )}
        {action.kind === "edit-word" && (
          <>
            <label className={ui.fieldLabel}>واژهٔ انگلیسی
              <input className={cx(ui.field, "phone:text-[16px]")} dir="ltr" lang="en" value={en} onChange={(event) => setEn(event.target.value)} required />
            </label>
            <label className={ui.fieldLabel}>معنی فارسی
              <input className={cx(ui.field, "phone:text-[16px]")} value={fa} onChange={(event) => setFa(event.target.value)} required />
            </label>
          </>
        )}
        {action.kind === "delete-word" && (
          <p id={descriptionId} className={cx(ui.muted, "wrap-anywhere")}>
            واژهٔ «<bdi dir="ltr" lang="en">{action.word.en}</bdi>» و سابقهٔ تمرینش حذف می‌شوند.
          </p>
        )}
        {action.kind === "delete-deck" && (
          <p id={descriptionId} className={cx(ui.muted, "wrap-anywhere")}>
            مجموعهٔ «{action.name}»، همهٔ واژه‌ها و سابقهٔ تمرین آن‌ها حذف می‌شوند.
          </p>
        )}
        {error && <p className={ui.errorText} role="alert">{error}</p>}
        <div className={ui.buttonRow}>
          <button className={cx(ui.button, ui.secondary)} type="button" onClick={() => dialog.current?.close()}>انصراف</button>
          <button className={cx(ui.button, deleting ? "border-(--error) bg-(--error-bg) text-(--error)" : ui.primary)} type="submit">
            {deleting && <Trash2 size={17} />}{deleting ? "تأیید حذف" : "ذخیرهٔ تغییرات"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
