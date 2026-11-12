"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, BookOpen, Check, ChevronDown, CircleCheck, Clock3, House,
  Layers3, LibraryBig, ListRestart, Moon, Plus, Search, Sparkles, Sun, Volume2, X,
} from "lucide-react";
import {
  createExercises, defaultData, isKnown, manualReview, normalize, number, parseWords, pronounce, starter,
  storageKey, updateReview, wordKey, type Attempt, type Deck, type Exercise, type Mode, type StudyData,
  type StudySettings, type Word, type WordEntry,
} from "../lib/study";
import { builtInGroups, getDecks } from "../lib/decks";
import { Dropdown } from "./dropdown";
import { modes } from "./modes";
import { cx, tileTone, ui } from "./styles";
import { Session } from "./session";

type View = "home" | "practice" | "words" | "mistakes" | "import" | "append" | "session";
type Filter = "all" | "new" | "due" | "known" | "mistakes";
const initialSettings: StudySettings = { mode: "smart", scope: "daily", direction: "mixed", limit: 10 };

const navigation = [
  { id: "home", title: "خانه", shortTitle: "خانه", icon: House },
  { id: "practice", title: "تمرین", shortTitle: "تمرین", icon: Layers3 },
  { id: "words", title: "کتابخانهٔ واژه‌ها", shortTitle: "واژه‌ها", icon: LibraryBig },
  { id: "mistakes", title: "اشتباه‌های من", shortTitle: "اشتباه‌ها", icon: ListRestart },
  { id: "import", title: "افزودن مجموعه", shortTitle: "افزودن", icon: Plus },
] as const;

function readStudyData(): StudyData {
  const saved = localStorage.getItem(storageKey);
  return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
}

export default function Home() {
  const [data, setData] = useState<StudyData>(defaultData);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState(initialSettings);
  const [session, setSession] = useState<{ key: number; exercises: Exercise[]; deck: Deck; returnTo: "practice" | "mistakes" } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      setData(readStudyData());
    } catch {
      setStorageError(true);
    }
    setReady(true);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const theme = data.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setStorageError(true);
    }
  }, [data, ready]);

  const decks = getDecks(data);
  const deck = decks.find((item) => item.id === data.deckId) ?? starter;
  const totalWords = decks.reduce((sum, item) => sum + item.words.length, 0);
  const missedEntries = decks.flatMap((item) => item.words
    .filter((word) => data.reviews[word.id]?.missed)
    .map((word) => ({ word, collection: item.name })));
  const missedDeck: Deck = {
    id: "mistakes",
    name: "اشتباه‌های من",
    words: missedEntries.map(({ word }) => word),
  };
  const known = deck.words.filter((word) => isKnown(data.reviews[word.id])).length;
  const fresh = deck.words.filter((word) => !data.reviews[word.id]).length;
  const due = deck.words.filter((word) => data.reviews[word.id]?.due <= now).length;
  const mistakes = deck.words.filter((word) => data.reviews[word.id]?.missed).length;
  const stats = { known, fresh, due, mistakes };
  const dailyCount = Math.min(10, due + Math.min(6, fresh));

  function go(next: View) {
    setView(next);
    setNotice("");
    window.scrollTo(0, 0);
  }

  function start(next: StudySettings, retry?: Word[], source = deck, returnTo: "practice" | "mistakes" = "practice") {
    const exercises = createExercises(source, data, next, retry);
    if (!exercises.length) {
      setNotice(next.mode === "match"
        ? "برای جفت‌کردن، دست‌کم دو واژهٔ متفاوت با معنی‌های متمایز لازم است. گروه دیگری را انتخاب کن."
        : "برای این فیلتر واژه‌ای در صف نیست. گروه دیگری را انتخاب کن.");
      return;
    }
    setSettings(next);
    setSession((previous) => ({ key: (previous?.key ?? 0) + 1, exercises, deck: source, returnTo }));
    go("session");
  }

  function grade(attempts: Attempt[]) {
    setData((previous) => {
      const reviews = { ...previous.reviews };
      for (const { word, rating } of attempts) reviews[word.id] = updateReview(reviews[word.id], rating);
      return { ...previous, reviews };
    });
    setNow(Date.now());
  }

  function markMiss(word: Word) {
    setData((previous) => {
      const review = previous.reviews[word.id] ?? updateReview(undefined, 0);
      return { ...previous, reviews: { ...previous.reviews, [word.id]: { ...review, missed: true } } };
    });
  }

  function toggleKnown(word: Word) {
    setData((previous) => {
      const reviews = { ...previous.reviews };
      reviews[word.id] = isKnown(reviews[word.id])
        ? { level: 0, due: Date.now(), missed: false }
        : manualReview();
      return { ...previous, reviews };
    });
    setNow(Date.now());
  }

  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setData((previous) => ({ ...previous, theme }));
  }

  function saveWords(name: string, words: WordEntry[], deckId?: string) {
    try {
      const previous = readStudyData();
      const target = deckId ? getDecks(previous).find((item) => item.id === deckId) : undefined;
      if (deckId && !target) {
        setNotice("مجموعهٔ مقصد پیدا نشد. مجموعهٔ دیگری را انتخاب کن.");
        return;
      }

      const existing = new Set(target?.words.map(wordKey));
      const additions = words.filter((word) => !existing.has(wordKey(word)))
        .map((word) => ({ ...word, id: crypto.randomUUID() }));
      if (!additions.length) {
        setNotice("این واژه‌ها از قبل در مجموعه هستند.");
        return;
      }

      const id = target?.id ?? crypto.randomUUID();
      const next: StudyData = target
        ? { ...previous, deckId: id, addedWords: { ...previous.addedWords, [id]: [...(previous.addedWords[id] ?? []), ...additions] } }
        : { ...previous, deckId: id, decks: [...previous.decks, { id, name, words: additions }] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
      setStorageError(false);
      openWords();
      setNotice(number(additions.length) + " واژه به «" + (target?.name ?? name) + "» اضافه شد.");
    } catch {
      setNotice("ذخیره در مرورگر انجام نشد. متن واژه‌ها در فرم باقی مانده است.");
    }
  }

  function openWords(next: Filter = "all") {
    setFilter(next);
    go("words");
  }

  return (
    <div className={ui.appShell}>
      <aside className={ui.sidebar}>
        <button className={ui.brand} onClick={() => go("home")}>
          <span className={ui.brandMark}><BookOpen size={23} strokeWidth={2.2} /></span>
          <span><b>واژه‌یار</b><small>دفتر تمرین انگلیسی</small></span>
        </button>

        <nav className={ui.navigation} aria-label="صفحه‌های واژه‌یار">
          {navigation.map(({ id, title, shortTitle, icon: Icon }) => (
            <button className={ui.navButton} key={id} aria-label={title} aria-current={view === id || (id === "words" && view === "append") || (id === "practice" && view === "session") ? "page" : undefined}
              onClick={() => id === "words" ? openWords() : go(id)}><Icon size={19} /><span className={ui.navTitle}>{title}</span><span className={ui.navShortTitle} aria-hidden="true">{shortTitle}</span>{id === "mistakes" && missedEntries.length > 0 && <small className={ui.navCount}>{number(missedEntries.length)}</small>}</button>
          ))}
        </nav>

        <div className={ui.sidebarFooter}>
          <button className={ui.themeToggle} onClick={toggleTheme} aria-label="تغییر حالت روشن و تاریک">
            <Sun className={ui.lightIcon} size={18} /><Moon className={ui.darkIcon} size={18} />
            <span className={ui.lightIcon}>حالت روشن</span><span className={ui.darkIcon}>حالت تاریک</span>
            <span className={ui.themeSwitch}><i /></span>
          </button>
        </div>
      </aside>

      <main>
        <header className={ui.topbar}>
          <div className={cx(ui.container, ui.topbarInner)}>
            <div className="flex min-w-0 phone:flex-1">
              <Dropdown label="مجموعهٔ فعال" icon={LibraryBig} value={deck.id} items={[
                { value: starter.id, label: starter.name },
                ...builtInGroups.map(({ label, decks }) => ({
                  label,
                  options: decks.map(({ id, name }) => ({ value: id, label: name })),
                })),
                ...(data.decks.length ? [{
                  label: "مجموعه‌های من",
                  options: data.decks.map(({ id, name }) => ({ value: id, label: name })),
                }] : []),
              ]} onChange={(deckId) => {
                setData((previous) => ({ ...previous, deckId }));
                setFilter("all");
                setNotice("");
                if (view === "session") go("practice");
              }} />
            </div>
            {view === "session" ? <button className={cx(ui.button, ui.secondary, ui.smallButton)} onClick={() => go(session?.returnTo ?? "practice")}><X size={16} /> پایان تمرین</button>
              : <button className={cx(ui.button, ui.secondary, ui.smallButton)} onClick={() => go("import")}><Plus size={17} /> مجموعهٔ جدید</button>}
          </div>
        </header>

        <div className={cx(ui.container, "pb-11 phone:pb-6", view === "session" ? ui.studyContent : ui.content)}>
          {storageError && <p className={cx(ui.notice, ui.noticeError)} role="alert">ذخیرهٔ محلی مرورگر در دسترس نیست. ممکن است تغییرات پس از بستن صفحه از بین برود.</p>}
          {notice && <p className={ui.notice} role="status">{notice}</p>}

          {view === "home" && (
            <>
              <div className={ui.pageHeading}>
                <h1>میز مطالعه</h1>
                <p>واژه‌های امروزت را مرور کن و چند واژهٔ تازه یاد بگیر.</p>
              </div>

              <details className={cx(ui.surface, ui.deckCatalog)}>
                <summary className={ui.catalogSummary}>
                  <LibraryBig size={19} />
                  <span>همهٔ مجموعه‌ها</span>
                  <span className={ui.catalogCount}>{number(decks.length)} مجموعه · {number(totalWords)} واژه و عبارت</span>
                  <ChevronDown size={17} className={ui.catalogChevron} />
                </summary>
                <div className={ui.catalogGrid}>
                  {decks.map((item) => (
                    <button key={item.id} className={cx(ui.button, ui.secondary, ui.catalogButton)} onClick={() => {
                      setData((previous) => ({ ...previous, deckId: item.id }));
                      openWords();
                    }}>
                      <span>{item.name}</span><small>{number(item.words.length)}</small>
                    </button>
                  ))}
                </div>
              </details>

              <section className={ui.hero} aria-labelledby="daily-title">
                <div className={ui.heroCopy}>
                  <div className={ui.heroLabel}><Sparkles size={15} /> مرور فاصله‌دار</div>
                  <h2 id="daily-title">مرور امروز</h2>
                  <p>{dailyCount
                    ? `${number(dailyCount)} واژه برای این جلسه آماده است.`
                    : "صف امروز خالی است. می‌توانی تمرین آزاد انجام دهی."}</p>
                  <button className={cx(ui.button, ui.heroButton)} disabled={!ready} onClick={() => dailyCount
                    ? start(initialSettings)
                    : go("practice")}>{dailyCount ? "شروع مرور" : "تمرین آزاد"} <ArrowLeft size={19} /></button>
                </div>

                <div className={ui.heroVisual}>
                  <div className={cx(ui.orbit, "w-[278px]")} />
                  <div className={cx(ui.orbit, "w-[196px]")} />
                  <div className={ui.orbitDot} />
                  <div className={ui.progressRing} style={{ background: `conic-gradient(#c5eca8 ${known / deck.words.length * 100}%, #ffffff23 0)` }}>
                    <div className={ui.ringCenter}>
                      <b>{number(Math.round(known / deck.words.length * 100))}٪</b>
                      <span>از مجموعه یاد گرفتی</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className={ui.statsGrid}>
                {([
                  { label: "یادگرفته‌شده", value: known, icon: CircleCheck, tone: "green", filter: "known" },
                  { label: "آمادهٔ مرور", value: due, icon: Clock3, tone: "peach", filter: "due" },
                  { label: "واژهٔ جدید در مجموعهٔ فعال", value: fresh, icon: BookOpen, tone: "blue", filter: "new" },
                ] as const).map(({ label, value, icon: Icon, tone, filter }) => (
                  <button key={label} className={cx(ui.surface, ui.stat)} onClick={() => openWords(filter)}>
                    <span className={cx(ui.iconTile, tileTone[tone], "phone:size-[34px]")}><Icon size={21} /></span>
                    <span><b>{number(value)}</b><small>{label}</small></span>
                  </button>
                ))}
              </div>

              <div className={ui.sectionHeading}>
                <h2>روش‌های تمرین</h2>
                <button className={ui.textButton} onClick={() => go("practice")}>تنظیم تمرین <ArrowLeft size={17} /></button>
              </div>
              <ModeGrid onSelect={(mode) => {
                setSettings({ ...initialSettings, mode, scope: "all" });
                go("practice");
              }} />
            </>
          )}

          {view === "practice" && (
            <>
              <div className={ui.pageHeading}><h1>تمرین واژه‌ها</h1><p>روش تمرین، جهت سؤال و تعداد واژه‌ها را انتخاب کن.</p></div>
              <ModeGrid selected={settings.mode} onSelect={(mode) => setSettings({ ...settings, mode })} />
              <section className={cx(ui.surface, ui.practiceSettings)}>
                <h2>تنظیم جلسه</h2>
                <div className={ui.settingsGrid}>
                  <div className={ui.fieldLabel}>
                    <span>گروه واژه‌ها</span>
                    <Dropdown<StudySettings["scope"]> label="گروه واژه‌ها" value={settings.scope}
                      onChange={(scope) => setSettings({ ...settings, scope })} items={[
                        { value: "daily", label: `مرور امروز (${number(due + Math.min(6, fresh))})` },
                        { value: "all", label: `کل مجموعه (${number(deck.words.length)})` },
                        { value: "new", label: `واژه‌های جدید (${number(fresh)})` },
                        { value: "mistakes", label: `اشتباه‌ها (${number(mistakes)})` },
                      ]} />
                  </div>
                  <div className={ui.fieldLabel}>
                    <span>جهت سؤال</span>
                    <Dropdown<StudySettings["direction"]> label="جهت سؤال" value={settings.direction}
                      disabled={settings.mode === "listen" || settings.mode === "match"}
                      onChange={(direction) => setSettings({ ...settings, direction })} items={[
                        { value: "mixed", label: "هر دو جهت" },
                        { value: "en-fa", label: "انگلیسی به فارسی" },
                        { value: "fa-en", label: "فارسی به انگلیسی" },
                      ]} />
                  </div>
                  <div className={ui.fieldLabel}>
                    <span>تعداد واژه</span>
                    <Dropdown label="تعداد واژه" value={String(settings.limit)}
                      onChange={(limit) => setSettings({ ...settings, limit: Number(limit) })}
                      items={[5, 10, 15, 20, 30].map((count) => ({ value: String(count), label: `${number(count)} واژه` }))} />
                  </div>
                </div>
                <div className={ui.buttonRow}>
                  <button className={cx(ui.button, ui.primary)} disabled={!ready} onClick={() => start(settings)}>شروع تمرین <ArrowLeft size={18} /></button>
                  {mistakes > 0 && <button className={cx(ui.button, ui.secondary)} onClick={() => start({ ...settings, scope: "mistakes" })}><ListRestart size={18} /> مرور اشتباه‌ها</button>}
                </div>
              </section>
            </>
          )}

          {view === "words" && <Library key={deck.id} deck={deck} data={data} stats={stats} filter={filter}
            onFilter={setFilter} onToggle={toggleKnown} onAdd={() => go("append")} now={now}
            onPractice={(word) => start({ ...initialSettings, mode: "flash" }, [word])} />}

          {view === "mistakes" && (
            <>
              <div className={ui.pageHeading}>
                <h1>اشتباه‌های من</h1>
                <p>{number(missedEntries.length)} واژه از همهٔ مجموعه‌ها. با پاسخ درست، واژه از این فهرست خارج می‌شود.</p>
              </div>
              {missedEntries.length > 0 ? (
                <>
                  <div className={cx(ui.buttonRow, "mb-4")}>
                    <button className={cx(ui.button, ui.primary)} onClick={() => start({ ...initialSettings, scope: "mistakes" }, undefined, missedDeck, "mistakes")}>
                      <ListRestart size={18} /> تمرین اشتباه‌ها <ArrowLeft size={18} />
                    </button>
                  </div>
                  <div className={cx(ui.surface, ui.library)}>
                    <table className={ui.wordTable} role="table">
                      <thead className={ui.wordHead} role="rowgroup"><tr role="row"><th className={ui.wordHeader} role="columnheader" scope="col">واژه</th><th className={ui.wordHeader} role="columnheader" scope="col">معنی</th><th className={ui.wordHeader} role="columnheader" scope="col">مجموعه</th><th className={ui.wordHeader} role="columnheader" scope="col">تمرین</th></tr></thead>
                      <tbody className={ui.wordBody} role="rowgroup">
                        {missedEntries.map(({ word, collection }) => (
                          <tr className={ui.wordRow} role="row" key={word.id}>
                            <td className={cx(ui.wordCell, ui.wordTerm)} role="cell"><bdi dir="ltr" lang="en">{word.en}</bdi></td>
                            <td className={cx(ui.wordCell, ui.wordMeaning)} role="cell">{word.fa}</td>
                            <td className={cx(ui.wordCell, ui.wordMeta)} role="cell">{collection}</td>
                            <td className={ui.wordCell} role="cell"><button className={ui.iconButton} aria-label={`فلش‌کارت ${word.en}`} title="باز کردن فلش‌کارت"
                              onClick={() => start({ ...initialSettings, mode: "flash" }, [word], missedDeck, "mistakes")}><BookOpen size={17} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <div className={cx(ui.surface, ui.emptyState)}>فعلاً واژه‌ای برای مرور اشتباه‌ها نداری.</div>}
            </>
          )}

          {(view === "import" || view === "append") && (
            <ImportDeck key={view} target={view === "append" ? deck : undefined} onSave={saveWords} onCancel={openWords} />
          )}

          {view === "session" && session && <Session key={session.key} deck={session.deck} exercises={session.exercises}
            onGrade={grade} onMiss={markMiss} onExit={() => go(session.returnTo)} onRetry={(words) => start(settings, words, session.deck, session.returnTo)} />}
        </div>
      </main>
    </div>
  );
}

function ModeGrid({ selected, onSelect }: { selected?: Mode; onSelect: (mode: Mode) => void }) {
  const keys: Mode[] = selected
    ? ["smart", "flash", "choice", "type", "listen", "match"]
    : ["flash", "choice", "type", "listen", "match"];
  return (
    <div className={ui.modeGrid}>
      {keys.map((id) => {
        const { title, description, icon: Icon, tone } = modes[id];
        return (
          <button key={id} className={cx(ui.surface, ui.modeCard)} aria-pressed={selected ? selected === id : undefined} onClick={() => onSelect(id)}>
            <span className={cx(ui.iconTile, tileTone[tone])}><Icon size={21} /></span>
            <span><b>{title}</b><small>{description}</small></span>
            {selected === id ? <Check size={18} className={ui.modeArrow} /> : <ArrowLeft size={17} className={ui.modeArrow} />}
          </button>
        );
      })}
    </div>
  );
}

function Library({ deck, data, stats, filter, onFilter, onToggle, onAdd, onPractice, now }: {
  deck: Deck;
  data: StudyData;
  stats: Record<"known" | "fresh" | "due" | "mistakes", number>;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onToggle: (word: Word) => void;
  onAdd: () => void;
  onPractice: (word: Word) => void;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const [audioError, setAudioError] = useState(false);
  const filters = [
    { id: "all", title: "همه", count: deck.words.length },
    { id: "new", title: "جدید", count: stats.fresh },
    { id: "due", title: "آمادهٔ مرور", count: stats.due },
    { id: "known", title: "یادگرفته‌شده", count: stats.known },
    { id: "mistakes", title: "اشتباه‌ها", count: stats.mistakes },
  ] as const;

  const needle = normalize(query);
  const results = deck.words.filter((word) => {
    const review = data.reviews[word.id];
    if (filter === "new" && review) return false;
    if (filter === "due" && (!review || review.due > now)) return false;
    if (filter === "known" && !isKnown(review)) return false;
    if (filter === "mistakes" && !review?.missed) return false;
    return !needle || normalize(word.en).includes(needle) || normalize(word.fa).includes(needle);
  }).sort((a, b) => a.en.localeCompare(b.en, "en"));

  return (
    <>
      <div className={cx(ui.pageHeading, "flex flex-wrap items-end justify-between gap-3")}>
        <div><h1>کتابخانهٔ واژه‌ها</h1><p className="mt-[5px] text-(--muted)">{deck.name} · {number(deck.words.length)} واژه</p></div>
        <button className={cx(ui.button, ui.primary)} onClick={onAdd}><Plus size={18} /> افزودن واژه</button>
      </div>
      <div className={cx(ui.surface, ui.library)}>
        <div className={ui.libraryControls}>
          <div className={ui.searchBox}><Search size={18} /><input aria-label="جست‌وجوی واژه" value={query} dir="auto"
            placeholder="جست‌وجوی واژه یا معنی…" onChange={(event) => { setQuery(event.target.value); setLimit(24); }} /></div>
          <div className={ui.filters} aria-label="فیلتر واژه‌ها">
            {filters.map(({ id, title, count }) => <button className={ui.filterButton} aria-pressed={id === filter}
              onClick={() => { onFilter(id); setLimit(24); }} key={id}>{title} <small>{number(count)}</small></button>)}
          </div>
        </div>
        {audioError && <p className={cx(ui.notice, ui.noticeError)} role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}
        {results.length === 0 ? <div className={ui.emptyState}>واژه‌ای با این فیلتر پیدا نشد.</div> : (
          <table className={ui.wordTable} role="table">
            <thead className={ui.wordHead} role="rowgroup"><tr role="row"><th className={ui.wordHeader} role="columnheader" scope="col">واژه</th><th className={ui.wordHeader} role="columnheader" scope="col">معنی</th><th className={ui.wordHeader} role="columnheader" scope="col">وضعیت</th><th className={ui.wordHeader} role="columnheader" scope="col">تمرین</th></tr></thead>
            <tbody className={ui.wordBody} role="rowgroup">{results.slice(0, limit).map((word) => {
              const review = data.reviews[word.id];
              const mastered = isKnown(review);
              return (
                <tr className={ui.wordRow} role="row" key={word.id}>
                  <td className={cx(ui.wordCell, ui.wordTerm)} role="cell"><bdi dir="ltr" lang="en">{word.en}</bdi></td>
                  <td className={cx(ui.wordCell, ui.wordMeaning)} role="cell">{word.fa}</td>
                  <td className={cx(ui.wordCell, ui.wordMeta)} role="cell"><button className={ui.wordStatus} onClick={() => onToggle(word)} aria-pressed={mastered}
                    title={mastered ? "بازگرداندن به صف مرور" : "علامت‌گذاری به عنوان یادگرفته‌شده"}>
                    <CircleCheck size={15} /> {mastered ? "یاد گرفتم" : review ? "در حال مرور" : "جدید"}
                  </button></td>
                  <td className={ui.wordCell} role="cell"><div className={ui.tableActions}>
                    <button className={ui.iconButton} aria-label={`تلفظ ${word.en}`} title="پخش تلفظ" onClick={() => setAudioError(!pronounce(word.en))}><Volume2 size={17} /></button>
                    <button className={ui.iconButton} aria-label={`فلش‌کارت ${word.en}`} title="باز کردن فلش‌کارت" onClick={() => onPractice(word)}><BookOpen size={17} /></button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {results.length > limit && <div className={ui.emptyState}><button className={cx(ui.button, ui.secondary)} onClick={() => setLimit(limit + 24)}>نمایش واژه‌های بیشتر</button></div>}
      </div>
    </>
  );
}

function ImportDeck({ target, onSave, onCancel }: {
  target?: Deck;
  onSave: (name: string, words: WordEntry[], deckId?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [fileError, setFileError] = useState(false);
  const parsed = useMemo(() => parseWords(input, target?.words), [input, target?.words]);
  const canSave = Boolean((target || name.trim()) && parsed.words.length && !parsed.invalid.length);

  return (
    <>
      <div className={ui.pageHeading}>
        <h1>{target ? "افزودن واژه" : "افزودن مجموعه"}</h1>
        {target && <p>مجموعهٔ مقصد «{target.name}»</p>}
        <p>واژه‌ها را بچسبان یا فایل متنی، CSV یا TSV را انتخاب کن.</p>
      </div>
      <form className={cx(ui.surface, ui.importPanel)} onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSave(name.trim(), parsed.words, target?.id);
      }}>
        {!target && <label className={cx(ui.fieldLabel, ui.importLabel)}>نام مجموعه<input className={ui.field} value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً واژه‌های کلاس" required maxLength={60} /></label>}
        <label className={cx(ui.fieldLabel, ui.importLabel)}>واژه‌ها
          <textarea className={cx(ui.field, "resize-y")} dir="ltr" value={input} onChange={(event) => { setInput(event.target.value); setFileError(false); }}
            placeholder={"curious | کنجکاو\nsteady | ثابت، پایدار\nlook up | جست‌وجو کردن"} rows={8} spellCheck={false} />
        </label>
        <p className={cx(ui.muted, ui.importHelp)}>در هر سطر، اول انگلیسی و بعد فارسی را بنویس. برای جداسازی از <bdi>|</bdi>، تب یا ویرگول CSV استفاده کن.</p>
        <div className={ui.buttonRow}>
          <label className={cx(ui.button, ui.secondary, ui.fileButton)}><ArrowDownToLine size={17} /> انتخاب فایل
            <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const contents = await file.text();
                  setFileError(false);
                  if (!target) setName((previous) => previous || file.name.replace(/\.[^.]+$/, "").slice(0, 60));
                  setInput(contents);
                } catch {
                  setFileError(true);
                }
              }} />
          </label>
          <button className={cx(ui.button, ui.primary)} disabled={!canSave}>{target ? "افزودن به مجموعه" : "ذخیرهٔ مجموعه"} <ArrowLeft size={17} /></button>
          {target && <button className={cx(ui.button, ui.secondary)} type="button" onClick={onCancel}>بازگشت</button>}
        </div>
        {fileError && <p className={ui.errorText} role="alert">فایل خوانده نشد. می‌توانی متن آن را مستقیم بچسبانی.</p>}
        {parsed.invalid.length > 0 && <p className={ui.errorText} role="alert">قالب سطرهای {parsed.invalid.slice(0, 10).map(number).join("، ")}{parsed.invalid.length > 10 ? " و سطرهای بعدی" : ""} را بررسی کن.</p>}
        {parsed.duplicates > 0 && <p className={ui.muted}>{number(parsed.duplicates)} سطر تکراری در پیش‌نمایش حذف شد.</p>}
        {parsed.words.length > 0 && (
          <div className={ui.importPreview}>
            <h2>پیش‌نمایش {number(parsed.words.length)} واژه</h2>
            <ul className={ui.retryList}>
              {parsed.words.slice(0, 5).map((word, index) => <li key={index}><bdi dir="ltr" lang="en">{word.en}</bdi><span>{word.fa}</span></li>)}
            </ul>
          </div>
        )}
      </form>
    </>
  );
}
