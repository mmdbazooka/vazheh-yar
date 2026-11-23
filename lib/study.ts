import seed from "./seed.json";
import { defaultGoal, startingDirection, type Activity, type StudyTimer } from "./activity";

export type WordEntry = { en: string; fa: string; note?: string };
export type Word = Pick<WordEntry, "en" | "fa"> & { id: string };
export type Deck = { id: string; name: string; words: Word[] };
export type Review = { level: number; due: number; missed: boolean };
export type Rating = 0 | 1 | 2;
export type Direction = "en-fa" | "fa-en" | "mixed";
export type Mode = "smart" | "flash" | "choice" | "type" | "listen" | "match";
export type Scope = "daily" | "due" | "all" | "mistakes" | "new";
export type StudySettings = { mode: Mode; direction: Direction; scope: Scope; limit: number };

export const storageKey = "vazheyar.v1";
export const wordNoteLimit = 4000;
export const starter: Deck = {
  id: "pdf",
  name: "واژگان فایل من",
  words: seed.map((word) => ({ ...word, id: "pdf:" + word.en })),
};

export type StudyData = {
  decks: Deck[];
  addedWords: Record<string, Word[]>;
  reviews: Record<string, Review>;
  wordNotes: Record<string, string>;
  theme: "light" | "dark" | null;
  deckId: string;
  activity: Activity;
  dailyGoal: number;
  timer: StudyTimer | null;
};

export const defaultData: StudyData = {
  decks: [], addedWords: {}, reviews: {}, wordNotes: {}, theme: null, deckId: starter.id,
  activity: {}, dailyGoal: defaultGoal, timer: null,
};
const day = 86_400_000;
export const isKnown = (review?: Review) => (review?.level ?? 0) >= 3;

export function updateReview(previous: Review | undefined, rating: Rating, now = Date.now()): Review {
  const level = previous?.level ?? 0;
  if (rating === 0) return { level: 0, due: now + 10 * 60_000, missed: true };
  if (rating === 1) return { level: Math.min(2, level), due: now + day, missed: previous?.missed ?? false };
  if (previous && level > 0 && previous.due > now) return { ...previous, missed: false };
  const intervals = [1, 3, 7, 14, 30, 60];
  const next = Math.min(level + 1, intervals.length);
  return { level: next, due: now + intervals[next - 1] * day, missed: false };
}

export function manualReview(): Review {
  return { level: 3, due: Date.now() + 7 * day, missed: false };
}

export function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase()
    .replace(/\u064a|\u0649/g, "ی").replace(/\u0643/g, "ک")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\p{P}\s\u200c\u200e\u200f]/gu, "");
}

export const spoken = (en: string) => en.replace(/\s*\((?:n|v|adj|adv)\)$/i, "");
const meanings = (word: Word) => word.fa.split(/[،,؛;/]/).map(normalize).filter(Boolean);
const overlap = (left: Word, right: Word) => meanings(left).some((meaning) => meanings(right).includes(meaning));

export function shuffle<T>(items: readonly T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

type Single = { kind: "flash" | "choice" | "type" | "listen"; word: Word; reverse: boolean; options: Word[]; revisit?: boolean };
type PairGroup = { kind: "match"; words: Word[]; translations: Word[] };
export type Exercise = Single | PairGroup | { kind: "learn"; words: Word[] };
export type Attempt = { word: Word; rating: Rating };

function conflicts(left: Word, right: Word) {
  return overlap(left, right) || normalize(spoken(left.en)) === normalize(spoken(right.en));
}

function adaptiveDrill(review: Review | undefined, index: number) {
  if (review && (review.missed || review.level >= 2)) return "type";
  return (["choice", "flash", "type"] as const)[index % 3];
}

function createMatchingExercises(words: Word[], limit: number): PairGroup[] {
  const roundSize = 5;
  const remaining = [...words];
  const rounds: Word[][] = [];
  let slots = limit;

  while (slots >= 2 && remaining.length >= 2) {
    const available = Math.min(slots, remaining.length);
    // Split a remainder of six into two rounds so there is no one-word round.
    const size = available === roundSize + 1 ? roundSize - 1 : Math.min(roundSize, available);
    const first = remaining.shift()!;
    const group = [first];

    for (let index = 0; index < remaining.length && group.length < size;) {
      const candidate = remaining[index];
      if (group.some((word) => conflicts(word, candidate))) {
        index++;
      } else {
        group.push(candidate);
        remaining.splice(index, 1);
      }
    }

    if (group.length < 2) continue;
    const last = remaining[0];
    if (remaining.length === 1 && slots > group.length && group.length >= 3) {
      const partnerIndex = group.findIndex((word) => !conflicts(word, last));
      if (partnerIndex >= 0) {
        const [partner] = group.splice(partnerIndex, 1);
        rounds.push(group, [last, partner]);
        break;
      }
    }

    rounds.push(group);
    slots -= group.length;
  }
  return rounds.map((group) => ({ kind: "match", words: group, translations: shuffle(group) }));
}

export function createExercises(deck: Deck, data: StudyData, settings: StudySettings, retry?: Word[]) {
  const { reviews } = data;
  const today = Date.now();
  const all = shuffle(deck.words);
  const due = all.filter((word) => reviews[word.id] && reviews[word.id].due <= today)
    .sort((a, b) => reviews[a.id].due - reviews[b.id].due);
  const fresh = all.filter((word) => !reviews[word.id]);
  const sources: Record<Scope, Word[]> = {
    daily: [...due, ...fresh.slice(0, 6)],
    due,
    all,
    new: fresh,
    mistakes: all.filter((word) => reviews[word.id]?.missed),
  };
  const candidates = retry ?? sources[settings.scope];
  const mode = settings.mode;
  if (mode === "match") return createMatchingExercises(candidates, settings.limit);

  const words = candidates.slice(0, settings.limit);
  const exercises: Exercise[] = [];
  const firstReverse = settings.direction === "mixed" && startingDirection(data.activity, today) === "fa-en";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (mode === "smart" && i % 3 === 0) {
      const freshGroup = words.slice(i, i + 3).filter((item) => !reviews[item.id]);
      if (freshGroup.length) exercises.push({ kind: "learn", words: freshGroup });
    }
    let kind: Single["kind"] = mode === "smart" ? adaptiveDrill(reviews[word.id], i) : mode;
    const reverse = settings.direction === "mixed" ? i % 2 === (firstReverse ? 0 : 1) : settings.direction === "fa-en";
    const options: Word[] = [];
    if (kind === "choice") {
      for (const candidate of all) {
        if (candidate.id === word.id) continue;
        if ([word, ...options].some((item) => conflicts(item, candidate))) continue;
        options.push(candidate);
        if (options.length === 3) break;
      }
      if (!options.length) kind = "type";
    }
    exercises.push({
      kind,
      word,
      reverse,
      options: options.length ? shuffle([...options, word]) : [],
    });
  }
  return exercises;
}

export function checkAnswer(exercise: Single, answer: string, deck: Deck) {
  const key = normalize(answer);
  if (!key) return false;
  const { word, reverse, kind } = exercise;
  if (kind === "listen") return key === normalize(spoken(word.en));
  if (reverse) {
    return deck.words.some((candidate) => normalize(spoken(candidate.en)) === key &&
      (candidate.id === word.id || normalize(candidate.fa) === normalize(word.fa)));
  }
  return [...meanings(word), normalize(word.fa)].includes(key);
}

function csvFields(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  return quoted ? [] : [...fields, field];
}

function importFields(line: string) {
  const csv = csvFields(line);
  const divider = line.includes("\t") ? "\t" : line.includes("|") ? "|" : null;
  if (!divider) return csv;
  // A quoted CSV example can itself contain a pipe or a tab.
  if (csv.length === 3 && csv[2].includes(divider) && !csv[0].includes(divider) && !csv[1].includes(divider)) return csv;
  return line.split(divider);
}

export const isWordEntry = ({ en, fa }: WordEntry) => /[a-z]/i.test(en) && /\p{Script=Arabic}/u.test(fa);

export const wordKey = ({ en, fa }: WordEntry) => normalize(en) + "|" + normalize(fa);

export function parseWords(input: string, existing: readonly WordEntry[] = []) {
  const words: WordEntry[] = [];
  const invalid: number[] = [];
  const seen = new Set(existing.map(wordKey));
  let duplicates = 0;

  input.replace(/^\uFEFF/, "").split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const [en = "", fa = "", note = "", ...extra] = importFields(line).map((field) => field.trim());
    if (index === 0 && /^(en|english|word|انگلیسی)$/i.test(en) && /^(fa|farsi|persian|meaning|فارسی|معنی)$/i.test(fa)) return;
    if (!isWordEntry({ en, fa }) || extra.length || note.length > wordNoteLimit) {
      invalid.push(index + 1);
      return;
    }
    const key = wordKey({ en, fa });
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    words.push({ en, fa, ...(note ? { note } : {}) });
  });
  return { words, invalid, duplicates };
}

export function pronounce(en: string) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(spoken(en));
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export const number = (value: number) => value.toLocaleString("fa-IR");

