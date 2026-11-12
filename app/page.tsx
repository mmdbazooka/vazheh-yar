"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, BookOpen, Check, ChevronDown, CircleCheck, Clock3, House,
  Layers3, LibraryBig, ListRestart, Moon, Plus, Search, Sparkles, Sun, Volume2, X,
} from "lucide-react";
import {
  createExercises, defaultData, isKnown, manualReview, normalize, number, parseWords, pronounce, starter,
  storageKey, updateReview, type Attempt, type Deck, type Exercise, type Mode, type StudyData,
  type StudySettings, type Word,
} from "../lib/study";
import { builtInDecks, builtInGroups } from "../lib/decks";
import { modes } from "./modes";
import { Session } from "./session";

type View = "home" | "practice" | "words" | "mistakes" | "import" | "session";
type Filter = "all" | "new" | "due" | "known" | "mistakes";
const initialSettings: StudySettings = { mode: "smart", scope: "daily", direction: "mixed", limit: 10 };

const navigation = [
  { id: "home", title: "خانه", shortTitle: "خانه", icon: House },
  { id: "practice", title: "تمرین", shortTitle: "تمرین", icon: Layers3 },
  { id: "words", title: "کتابخانهٔ واژه‌ها", shortTitle: "واژه‌ها", icon: LibraryBig },
  { id: "mistakes", title: "اشتباه‌های من", shortTitle: "اشتباه‌ها", icon: ListRestart },
  { id: "import", title: "افزودن مجموعه", shortTitle: "افزودن", icon: Plus },
] as const;

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
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as StudyData;
        setData({ ...defaultData, ...parsed });
      }
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

  const decks = [starter, ...builtInDecks, ...data.decks];
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
      setNotice("برای این فیلتر واژه‌ای در صف نیست. گروه دیگری را انتخاب کن.");
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

  function addDeck(name: string, words: Omit<Word, "id">[]) {
    const id = crypto.randomUUID();
    const added = { id, name, words: words.map((word, index) => ({ ...word, id: id + ":" + index })) };
    setData((previous) => ({ ...previous, decks: [...previous.decks, added], deckId: id }));
    setFilter("all");
    go("words");
    setNotice(`${number(words.length)} واژه به «${name}» اضافه شد.`);
  }

  function openWords(next: Filter = "all") {
    setFilter(next);
    go("words");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go("home")}>
          <span className="brand-mark"><BookOpen size={23} strokeWidth={2.2} /></span>
          <span><b>واژه‌یار</b><small>دفتر تمرین انگلیسی</small></span>
        </button>

        <nav aria-label="صفحه‌های واژه‌یار">
          {navigation.map(({ id, title, shortTitle, icon: Icon }) => (
            <button className="nav-button" key={id} aria-label={title} aria-current={view === id || (id === "practice" && view === "session") ? "page" : undefined}
              onClick={() => id === "words" ? openWords() : go(id)}><Icon size={19} /><span className="nav-title">{title}</span><span className="nav-short-title" aria-hidden="true">{shortTitle}</span>{id === "mistakes" && missedEntries.length > 0 && <small className="nav-count">{number(missedEntries.length)}</small>}</button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="تغییر حالت روشن و تاریک">
            <Sun className="light-icon" size={18} /><Moon className="dark-icon" size={18} />
            <span className="light-icon">حالت روشن</span><span className="dark-icon">حالت تاریک</span>
            <span className="switch"><i /></span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="deck-select">
              <LibraryBig size={17} />
              <select aria-label="مجموعهٔ فعال" value={deck.id} onChange={(event) => {
                const deckId = event.target.value;
                setData((previous) => ({ ...previous, deckId }));
                setFilter("all");
                setNotice("");
                if (view === "session") go("practice");
              }}>
                <option value={starter.id}>{starter.name}</option>
                {builtInGroups.map(({ label, decks }) => (
                  <optgroup key={label} label={label}>
                    {decks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                ))}
                {data.decks.length > 0 && (
                  <optgroup label="مجموعه‌های من">
                    {data.decks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                )}
              </select>
              <ChevronDown size={15} className="select-chevron" />
            </div>
            {view === "session" ? <button className="button secondary small" onClick={() => go(session?.returnTo ?? "practice")}><X size={16} /> پایان تمرین</button>
              : <button className="button secondary small" onClick={() => go("import")}><Plus size={17} /> مجموعهٔ جدید</button>}
          </div>
        </header>

        <div className={`content ${view === "session" ? "study-content" : ""}`}>
          {storageError && <p className="notice error-text" role="alert">ذخیرهٔ محلی مرورگر در دسترس نیست. ممکن است تغییرات پس از بستن صفحه از بین برود.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}

          {view === "home" && (
            <>
              <div className="page-heading">
                <h1>میز مطالعه</h1>
                <p>واژه‌های امروزت را مرور کن و چند واژهٔ تازه یاد بگیر.</p>
              </div>

              <details className="surface deck-catalog">
                <summary>
                  <LibraryBig size={19} />
                  <span>همهٔ مجموعه‌ها</span>
                  <span className="muted">{number(decks.length)} مجموعه · {number(totalWords)} واژه و عبارت</span>
                  <ChevronDown size={17} />
                </summary>
                <div className="catalog-grid">
                  {decks.map((item) => (
                    <button key={item.id} className="button secondary" onClick={() => {
                      setData((previous) => ({ ...previous, deckId: item.id }));
                      openWords();
                    }}>
                      <span>{item.name}</span><small>{number(item.words.length)}</small>
                    </button>
                  ))}
                </div>
              </details>

              <section className="hero" aria-labelledby="daily-title">
                <div className="hero-copy">
                  <div className="hero-label"><Sparkles size={15} /> مرور فاصله‌دار</div>
                  <h2 id="daily-title">مرور امروز</h2>
                  <p>{dailyCount
                    ? `${number(dailyCount)} واژه برای این جلسه آماده است.`
                    : "صف امروز خالی است. می‌توانی تمرین آزاد انجام دهی."}</p>
                  <button className="button hero-button" disabled={!ready} onClick={() => dailyCount
                    ? start(initialSettings)
                    : go("practice")}>{dailyCount ? "شروع مرور" : "تمرین آزاد"} <ArrowLeft size={19} /></button>
                </div>

                <div className="hero-visual">
                  <div className="orbit orbit-outer" />
                  <div className="orbit orbit-inner" />
                  <div className="orbit-dot" />
                  <div className="progress-ring" style={{ background: `conic-gradient(#c5eca8 ${known / deck.words.length * 100}%, #ffffff23 0)` }}>
                    <div>
                      <b>{number(Math.round(known / deck.words.length * 100))}٪</b>
                      <span>از مجموعه یاد گرفتی</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="stats-grid">
                {([
                  { label: "یادگرفته‌شده", value: known, icon: CircleCheck, tone: "green", filter: "known" },
                  { label: "آمادهٔ مرور", value: due, icon: Clock3, tone: "peach", filter: "due" },
                  { label: "واژهٔ جدید در مجموعهٔ فعال", value: fresh, icon: BookOpen, tone: "blue", filter: "new" },
                ] as const).map(({ label, value, icon: Icon, tone, filter }) => (
                  <button key={label} className="surface stat" onClick={() => openWords(filter)}>
                    <span className={`icon-tile ${tone}`}><Icon size={21} /></span>
                    <span><b>{number(value)}</b><small>{label}</small></span>
                  </button>
                ))}
              </div>

              <div className="section-heading">
                <h2>روش‌های تمرین</h2>
                <button className="text-button" onClick={() => go("practice")}>تنظیم تمرین <ArrowLeft size={17} /></button>
              </div>
              <ModeGrid onSelect={(mode) => {
                setSettings({ ...initialSettings, mode, scope: "all" });
                go("practice");
              }} />
            </>
          )}

          {view === "practice" && (
            <>
              <div className="page-heading"><h1>تمرین واژه‌ها</h1><p>روش تمرین، جهت سؤال و تعداد واژه‌ها را انتخاب کن.</p></div>
              <ModeGrid selected={settings.mode} onSelect={(mode) => setSettings({ ...settings, mode })} />
              <section className="surface practice-settings">
                <h2>تنظیم جلسه</h2>
                <div className="settings-grid">
                  <label>گروه واژه‌ها
                    <select value={settings.scope} onChange={(event) => setSettings({ ...settings, scope: event.target.value as StudySettings["scope"] })}>
                      <option value="daily">مرور امروز ({number(due + Math.min(6, fresh))})</option>
                      <option value="all">کل مجموعه ({number(deck.words.length)})</option>
                      <option value="new">واژه‌های جدید ({number(fresh)})</option>
                      <option value="mistakes">اشتباه‌ها ({number(mistakes)})</option>
                    </select>
                  </label>
                  <label>جهت سؤال
                    <select value={settings.direction} disabled={settings.mode === "listen" || settings.mode === "match"}
                      onChange={(event) => setSettings({ ...settings, direction: event.target.value as StudySettings["direction"] })}>
                      <option value="mixed">هر دو جهت</option>
                      <option value="en-fa">انگلیسی به فارسی</option>
                      <option value="fa-en">فارسی به انگلیسی</option>
                    </select>
                  </label>
                  <label>تعداد واژه
                    <select value={settings.limit} onChange={(event) => setSettings({ ...settings, limit: Number(event.target.value) })}>
                      {[5, 10, 15, 20, 30].map((count) => <option value={count} key={count}>{number(count)} واژه</option>)}
                    </select>
                  </label>
                </div>
                <div className="button-row">
                  <button className="button primary" disabled={!ready} onClick={() => start(settings)}>شروع تمرین <ArrowLeft size={18} /></button>
                  {mistakes > 0 && <button className="button secondary" onClick={() => start({ ...settings, scope: "mistakes" })}><ListRestart size={18} /> مرور اشتباه‌ها</button>}
                </div>
              </section>
            </>
          )}

          {view === "words" && <Library key={deck.id} deck={deck} data={data} stats={stats} filter={filter}
            onFilter={setFilter} onToggle={toggleKnown} now={now}
            onPractice={(word) => start({ ...initialSettings, mode: "flash" }, [word])} />}

          {view === "mistakes" && (
            <>
              <div className="page-heading">
                <h1>اشتباه‌های من</h1>
                <p>{number(missedEntries.length)} واژه از همهٔ مجموعه‌ها. با پاسخ درست، واژه از این فهرست خارج می‌شود.</p>
              </div>
              {missedEntries.length > 0 ? (
                <>
                  <div className="button-row mb-4">
                    <button className="button primary" onClick={() => start({ ...initialSettings, scope: "mistakes" }, undefined, missedDeck, "mistakes")}>
                      <ListRestart size={18} /> تمرین اشتباه‌ها <ArrowLeft size={18} />
                    </button>
                  </div>
                  <div className="surface library">
                    <table className="word-table" role="table">
                      <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">واژه</th><th role="columnheader" scope="col">معنی</th><th role="columnheader" scope="col">مجموعه</th><th role="columnheader" scope="col">تمرین</th></tr></thead>
                      <tbody role="rowgroup">
                        {missedEntries.map(({ word, collection }) => (
                          <tr role="row" key={word.id}>
                            <td role="cell"><bdi dir="ltr" lang="en">{word.en}</bdi></td>
                            <td role="cell">{word.fa}</td>
                            <td role="cell">{collection}</td>
                            <td role="cell"><button className="icon-button" aria-label={`فلش‌کارت ${word.en}`} title="باز کردن فلش‌کارت"
                              onClick={() => start({ ...initialSettings, mode: "flash" }, [word], missedDeck, "mistakes")}><BookOpen size={17} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <div className="surface empty-state">فعلاً واژه‌ای برای مرور اشتباه‌ها نداری.</div>}
            </>
          )}

          {view === "import" && <ImportDeck onSave={addDeck} />}

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
    <div className="mode-grid">
      {keys.map((id) => {
        const { title, description, icon: Icon, tone } = modes[id];
        return (
          <button key={id} className="surface mode-card" aria-pressed={selected ? selected === id : undefined} onClick={() => onSelect(id)}>
            <span className={`icon-tile ${tone}`}><Icon size={21} /></span>
            <span className="mode-copy"><b>{title}</b><small>{description}</small></span>
            {selected === id ? <Check size={18} className="mode-arrow" /> : <ArrowLeft size={17} className="mode-arrow" />}
          </button>
        );
      })}
    </div>
  );
}

function Library({ deck, data, stats, filter, onFilter, onToggle, onPractice, now }: {
  deck: Deck;
  data: StudyData;
  stats: Record<"known" | "fresh" | "due" | "mistakes", number>;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onToggle: (word: Word) => void;
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
      <div className="page-heading"><h1>کتابخانهٔ واژه‌ها</h1><p>{deck.name} · {number(deck.words.length)} واژه</p></div>
      <div className="surface library">
        <div className="library-controls">
          <div className="search-box"><Search size={18} /><input aria-label="جست‌وجوی واژه" value={query} dir="auto"
            placeholder="جست‌وجوی واژه یا معنی…" onChange={(event) => { setQuery(event.target.value); setLimit(24); }} /></div>
          <div className="filters" aria-label="فیلتر واژه‌ها">
            {filters.map(({ id, title, count }) => <button className="filter-button" aria-pressed={id === filter}
              onClick={() => { onFilter(id); setLimit(24); }} key={id}>{title} <small>{number(count)}</small></button>)}
          </div>
        </div>
        {audioError && <p className="notice error-text" role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}
        {results.length === 0 ? <div className="empty-state">واژه‌ای با این فیلتر پیدا نشد.</div> : (
          <table className="word-table" role="table">
            <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">واژه</th><th role="columnheader" scope="col">معنی</th><th role="columnheader" scope="col">وضعیت</th><th role="columnheader" scope="col">تمرین</th></tr></thead>
            <tbody role="rowgroup">{results.slice(0, limit).map((word) => {
              const review = data.reviews[word.id];
              const mastered = isKnown(review);
              return (
                <tr role="row" key={word.id}>
                  <td role="cell"><bdi dir="ltr" lang="en">{word.en}</bdi></td>
                  <td role="cell">{word.fa}</td>
                  <td role="cell"><button className={`word-status ${mastered ? "known" : ""}`} onClick={() => onToggle(word)} aria-pressed={mastered}
                    title={mastered ? "بازگرداندن به صف مرور" : "علامت‌گذاری به عنوان یادگرفته‌شده"}>
                    <CircleCheck size={15} /> {mastered ? "یاد گرفتم" : review ? "در حال مرور" : "جدید"}
                  </button></td>
                  <td role="cell"><div className="table-actions">
                    <button className="icon-button" aria-label={`تلفظ ${word.en}`} title="پخش تلفظ" onClick={() => setAudioError(!pronounce(word.en))}><Volume2 size={17} /></button>
                    <button className="icon-button" aria-label={`فلش‌کارت ${word.en}`} title="باز کردن فلش‌کارت" onClick={() => onPractice(word)}><BookOpen size={17} /></button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {results.length > limit && <div className="load-more"><button className="button secondary" onClick={() => setLimit(limit + 24)}>نمایش واژه‌های بیشتر</button></div>}
      </div>
    </>
  );
}

function ImportDeck({ onSave }: { onSave: (name: string, words: Omit<Word, "id">[]) => void }) {
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [fileError, setFileError] = useState(false);
  const parsed = useMemo(() => parseWords(input), [input]);

  return (
    <>
      <div className="page-heading"><h1>افزودن مجموعه</h1><p>واژه‌ها را بچسبان یا فایل متنی، CSV یا TSV را انتخاب کن.</p></div>
      <form className="surface import-panel" onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && parsed.words.length && !parsed.invalid.length) onSave(name.trim(), parsed.words);
      }}>
        <label>نام مجموعه<input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً واژه‌های کلاس" required maxLength={60} /></label>
        <label>واژه‌ها
          <textarea dir="ltr" value={input} onChange={(event) => { setInput(event.target.value); setFileError(false); }}
            placeholder={"curious | کنجکاو\nsteady | ثابت، پایدار\nlook up | جست‌وجو کردن"} rows={8} spellCheck={false} />
        </label>
        <p className="muted import-help">در هر سطر، اول انگلیسی و بعد فارسی را بنویس. برای جداسازی از <bdi>|</bdi>، تب یا ویرگول CSV استفاده کن.</p>
        <div className="button-row">
          <label className="button secondary file-button"><ArrowDownToLine size={17} /> انتخاب فایل
            <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const contents = await file.text();
                  setFileError(false);
                  setName((previous) => previous || file.name.replace(/\.[^.]+$/, "").slice(0, 60));
                  setInput(contents);
                } catch {
                  setFileError(true);
                }
              }} />
          </label>
          <button className="button primary" disabled={!name.trim() || !parsed.words.length || parsed.invalid.length > 0}>ذخیرهٔ مجموعه <ArrowLeft size={17} /></button>
        </div>
        {fileError && <p className="error-text" role="alert">فایل خوانده نشد. می‌توانی متن آن را مستقیم بچسبانی.</p>}
        {parsed.invalid.length > 0 && <p className="error-text" role="alert">قالب سطرهای {parsed.invalid.slice(0, 10).map(number).join("، ")}{parsed.invalid.length > 10 ? " و سطرهای بعدی" : ""} را بررسی کن.</p>}
        {parsed.duplicates > 0 && <p className="muted">{number(parsed.duplicates)} سطر تکراری در پیش‌نمایش حذف شد.</p>}
        {parsed.words.length > 0 && (
          <div className="import-preview">
            <h2>پیش‌نمایش {number(parsed.words.length)} واژه</h2>
            <ul className="retry-list">
              {parsed.words.slice(0, 5).map((word, index) => <li key={index}><bdi dir="ltr" lang="en">{word.en}</bdi><span>{word.fa}</span></li>)}
            </ul>
          </div>
        )}
      </form>
    </>
  );
}
