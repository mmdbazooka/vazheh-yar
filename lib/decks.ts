import { isWordEntry, starter, wordKey, type Deck, type StudyData, type Word, type WordEntry } from "./study";
import coding from "./vocabulary/coding.json";
import web from "./vocabulary/web.json";
import backend from "./vocabulary/backend.json";
import tooling from "./vocabulary/tooling.json";
import everyday from "./vocabulary/everyday.json";
import conversation from "./vocabulary/conversation.json";
import practical from "./vocabulary/practical.json";
import chat from "./vocabulary/chat.json";
import work from "./vocabulary/work.json";
import meetings from "./vocabulary/meetings.json";
import phrasal from "./vocabulary/phrasal.json";
import reading from "./vocabulary/reading.json";

type DeckSource = Omit<Deck, "words"> & { words: Omit<Deck["words"][number], "id">[] };

function makeGroup(label: string, sources: DeckSource[]) {
  const decks = sources.map(({ id, name, words }) => {
    const deckId = "built-in:" + id;
    return {
      id: deckId,
      name,
      words: words.map((word) => ({ ...word, id: deckId + ":" + word.en })),
    };
  });
  return { label, decks };
}

export const builtInGroups = [
  makeGroup("برنامه‌نویسی", [...coding, ...web, ...backend, ...tooling]),
  makeGroup("انگلیسی روزمره", [...everyday, ...conversation, ...practical]),
  makeGroup("چت و پیام", chat),
  makeGroup("محیط کار و جلسه", [...work, ...meetings]),
  makeGroup("تمرین پیشرفته", [...phrasal, ...reading]),
];

export const builtInDecks = builtInGroups.flatMap(({ decks }) => decks);

export function getDecks(data: StudyData) {
  return [starter, ...builtInDecks, ...data.decks].map((deck) => {
    const additions = data.addedWords[deck.id];
    return additions?.length ? { ...deck, words: [...deck.words, ...additions] } : deck;
  });
}

export type LibraryChange =
  | { kind: "rename-deck"; name: string }
  | { kind: "delete-deck" }
  | { kind: "edit-word"; wordId: string; entry: WordEntry }
  | { kind: "delete-word"; wordId: string };

export function changeLibrary(data: StudyData, deckId: string, change: LibraryChange):
  { data: StudyData; message: string } | { error: string } {
  const personal = data.decks.find((deck) => deck.id === deckId);
  const additions = data.addedWords[deckId] ?? [];

  if (change.kind === "rename-deck" || change.kind === "delete-deck") {
    if (!personal) return { error: "فقط مجموعه‌های شخصی قابل تغییر یا حذف‌اند." };
    if (change.kind === "rename-deck") {
      const name = change.name.trim();
      if (!name || name.length > 60) return { error: "یک نام بین ۱ تا ۶۰ نویسه وارد کن." };
      const decks = data.decks.map((deck) => deck.id === deckId ? { ...deck, name } : deck);
      return { data: { ...data, decks }, message: "نام مجموعه تغییر کرد." };
    }

    const addedWords = { ...data.addedWords };
    delete addedWords[deckId];
    const reviews = { ...data.reviews };
    for (const { id } of [...personal.words, ...additions]) delete reviews[id];
    return {
      data: {
        ...data,
        decks: data.decks.filter((deck) => deck.id !== deckId),
        deckId: data.deckId === deckId ? starter.id : data.deckId,
        addedWords,
        reviews,
      },
      message: "مجموعه حذف شد.",
    };
  }

  const { wordId } = change;
  const original = personal?.words.find((word) => word.id === wordId) ?? additions.find((word) => word.id === wordId);
  if (!original) return { error: "این واژه در میان واژه‌های شخصی مجموعه پیدا نشد." };

  let replacement: Word | undefined;
  if (change.kind === "edit-word") {
    const entry = { en: change.entry.en.trim(), fa: change.entry.fa.trim() };
    if (!isWordEntry(entry)) return { error: "واژهٔ انگلیسی و معنی فارسی را وارد کن." };
    const deck = getDecks(data).find((item) => item.id === deckId);
    if (deck?.words.some((word) => word.id !== wordId && wordKey(word) === wordKey(entry))) {
      return { error: "این واژه با همین معنی از قبل در مجموعه هست." };
    }
    replacement = { ...entry, id: wordId };
  }

  function updateWords(words: Word[]) {
    return words.flatMap((word) => word.id !== wordId ? [word] : replacement ? [replacement] : []);
  }
  const decks = personal ? data.decks.map((deck) =>
    deck.id === deckId ? { ...deck, words: updateWords(deck.words) } : deck) : data.decks;
  const updatedAdditions = updateWords(additions);
  const addedWords = { ...data.addedWords };
  if (updatedAdditions.length) addedWords[deckId] = updatedAdditions;
  else delete addedWords[deckId];
  const reviews = { ...data.reviews };
  if (change.kind === "delete-word") delete reviews[wordId];

  return {
    data: { ...data, decks, addedWords, reviews },
    message: change.kind === "edit-word" ? "واژه ویرایش شد." : "واژه حذف شد.",
  };
}
