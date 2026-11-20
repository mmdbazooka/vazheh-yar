import { builtInDecks } from "./decks";
import { activityAt, defaultGoal, drills, goals, type Activity, type Drill } from "./activity";
import { starter, type Deck, type Review, type StudyData, type Word } from "./study";

const backupFormat = "vazheyar-backup";
const backupVersion = 2;
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

type LibraryData = Pick<StudyData, "decks" | "addedWords" | "reviews" | "theme" | "deckId">;
function isLibraryData(value: unknown): value is LibraryData & Record<string, unknown> {
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

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isOutcomes = (counts: unknown) => Array.isArray(counts) && counts.length === 3 && counts.every(isCount);

function isActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, day]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const stamp = Date.parse(key + "T00:00:00Z");
    return Number.isFinite(stamp) && new Date(stamp).toISOString().startsWith(key) &&
      isRecord(day) && isCount(day.milliseconds) && isCount(day.recovered) && isRecord(day.results) &&
      Object.entries(day.results).every(([drill, counts]) => drills.includes(drill as Drill) && isOutcomes(counts)) &&
      isRecord(day.directions) && Object.entries(day.directions).every(([key, counts]) => (key === "en-fa" || key === "fa-en") && isOutcomes(counts));
  });
}

export function createBackup(data: StudyData) {
  const now = Date.now();
  const date = new Date(now).toISOString();
  const { timer, ...saved } = data;
  const snapshot = { ...saved, activity: activityAt(saved.activity, timer, now) };
  return {
    filename: "vazheyar-backup-" + date.slice(0, 10) + ".json",
    content: JSON.stringify({ format: backupFormat, version: backupVersion, exportedAt: date, data: snapshot }, null, 2),
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
  if (value.version !== 1 && value.version !== backupVersion) {
    throw new Error("این نسخه از فایل پشتیبان در این برنامه پشتیبانی نمی‌شود.");
  }
  if (!isLibraryData(value.data)) {
    throw new Error("داده‌های فایل پشتیبان ناقص یا نامعتبرند.");
  }
  const { decks, addedWords, reviews, theme, deckId } = value.data;
  const library = { decks, addedWords, reviews, theme, deckId };
  if (value.version === 1) return { ...library, activity: {}, dailyGoal: defaultGoal, timer: null };
  const { activity, dailyGoal } = value.data;
  if (!isActivity(activity) || typeof dailyGoal !== "number" || !goals.includes(dailyGoal)) {
    throw new Error("تاریخچهٔ مطالعه یا هدف روزانه در فایل پشتیبان نامعتبر است.");
  }
  return { ...library, activity, dailyGoal, timer: null };
}
