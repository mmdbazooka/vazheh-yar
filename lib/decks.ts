import type { Deck } from "./study";
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
