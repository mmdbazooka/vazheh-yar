import { builtInDecks } from "./decks";
import { starter, type Deck, type Review, type StudyData, type Word } from "./study";

const backupFormat = "vazheyar-backup";
const backupVersion = 1;
const builtInCollections = [starter, ...builtInDecks];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isWord(value: unknown): value is Word {
  return isRecord(value) && isText(value.id) && isText(value.en) && isText(value.fa);
}

function isWordList(value: unknown): value is Word[] {
  return Array.isArray(value) && value.every(isWord);
}

function isDeck(value: unknown): value is Deck {
  return isRecord(value) && isText(value.id) && isText(value.name) && isWordList(value.words);
}

function isReview(value: unknown): value is Review {
  return isRecord(value) &&
    typeof value.level === "number" && Number.isInteger(value.level) && value.level >= 0 &&
    typeof value.due === "number" && Number.isFinite(value.due) && value.due >= 0 &&
    typeof value.missed === "boolean";
}

function isAddedWords(value: unknown): value is StudyData["addedWords"] {
  return isRecord(value) && Object.values(value).every(isWordList);
}

function isStudyData(value: unknown): value is StudyData {
  if (!isRecord(value) ||
    !Array.isArray(value.decks) || !value.decks.every(isDeck) ||
    !isAddedWords(value.addedWords) ||
    !isRecord(value.reviews) || !Object.values(value.reviews).every(isReview) ||
    !isText(value.deckId) ||
    (value.theme !== null && value.theme !== "light" && value.theme !== "dark")) return false;

  const decks = [...builtInCollections, ...value.decks];
  const deckIds = new Set(decks.map(({ id }) => id));
  const words = [...decks.flatMap(({ words }) => words), ...Object.values(value.addedWords).flat()];
  return deckIds.size === decks.length && new Set(words.map(({ id }) => id)).size === words.length;
}

export function createBackup(data: StudyData) {
  const date = new Date().toISOString();
  return {
    filename: "vazheyar-backup-" + date.slice(0, 10) + ".json",
    content: JSON.stringify({ format: backupFormat, version: backupVersion, exportedAt: date, data }, null, 2),
  };
}

export function parseBackup(content: string): StudyData {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("فایل JSON معتبر نیست.");
  }
  if (!isRecord(value) || value.format !== backupFormat) {
    throw new Error("فایل پشتیبان واژه‌یار را انتخاب کن.");
  }
  if (value.version !== backupVersion) {
    throw new Error("این نسخه از فایل پشتیبان در این برنامه پشتیبانی نمی‌شود.");
  }
  if (!isStudyData(value.data)) {
    throw new Error("داده‌های فایل پشتیبان ناقص یا نامعتبرند.");
  }
  const { decks, addedWords, reviews, theme, deckId } = value.data;
  return { decks, addedWords, reviews, theme, deckId };
}
