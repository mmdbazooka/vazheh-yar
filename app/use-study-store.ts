"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultData, storageKey, type StudyData } from "../lib/study";

export type ChangeData = (change: (data: StudyData) => StudyData) => void;

export function useStudyStore() {
  const [data, setData] = useState(defaultData);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const latest = useRef(defaultData);
  const unsaved = useRef(false);

  const readData = useCallback((): StudyData => {
    if (unsaved.current) return latest.current;
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...defaultData, ...JSON.parse(raw) } : defaultData;
  }, []);

  const adopt = useCallback((next: StudyData) => {
    latest.current = next;
    setData(next);
  }, []);

  const saveData = useCallback((next: StudyData) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    unsaved.current = false;
    setStorageError(false);
    adopt(next);
  }, [adopt]);

  const changeData: ChangeData = useCallback((change) => {
    let previous = latest.current;
    try { previous = readData(); } catch { setStorageError(true); }
    const next = change(previous);
    if (next === previous) return;
    try { saveData(next); } catch {
      unsaved.current = true;
      setStorageError(true);
      adopt(next);
    }
  }, [adopt, readData, saveData]);

  useEffect(() => {
    function sync() {
      try { adopt(readData()); } catch { setStorageError(true); }
    }
    function onStorage(event: StorageEvent) {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) sync();
    }
    sync();
    setReady(true);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [adopt, readData]);

  return { data, ready, storageError, changeData, readData, saveData };
}
