"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Eye, RotateCcw, Volume2, X } from "lucide-react";
import { checkAnswer, number, pronounce, type Attempt, type Deck, type Exercise, type Rating, type Word } from "../lib/study";
import { modes } from "./modes";

export function Session({ deck, exercises, onGrade, onMiss, onRetry, onExit }: {
  deck: Deck;
  exercises: Exercise[];
  onGrade: (attempts: Attempt[]) => void;
  onMiss: (word: Word) => void;
  onRetry: (words: Word[]) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const exercise = exercises[index];
  const total = exercises.reduce((count, item) => count + (item.kind === "learn" ? 0 : item.kind === "match" ? item.words.length : 1), 0);
  const progress = Math.round(attempts.length / total * 100);

  function advance(results: Attempt[]) {
    onGrade(results);
    setAttempts((previous) => [...previous, ...results]);
    setIndex(index + 1);
  }

  if (!exercise) {
    const right = attempts.filter(({ rating }) => rating === 2).length;
    const retry = attempts.filter(({ rating }) => rating !== 2);
    return (
      <section className="session-frame surface summary">
        <span className="icon-tile green large"><CheckCircle2 size={31} /></span>
        <h1>تمرین تمام شد</h1>
        <p className="muted">پیشرفت این جلسه ذخیره شد.</p>
        <div className="summary-score"><b>{number(right)} از {number(total)}</b><span>پاسخ درست</span></div>
        {retry.length > 0 && (
          <ul className="retry-list">
            {retry.map(({ word }) => <li key={word.id}><span dir="ltr" lang="en">{word.en}</span><span>{word.fa}</span></li>)}
          </ul>
        )}
        <div className="button-row justify-center">
          {retry.length > 0 && <button className="button primary" onClick={() => onRetry(retry.map(({ word }) => word))}><RotateCcw size={17} /> مرور {number(retry.length)} واژه</button>}
          <button className="button secondary" onClick={onExit}>بازگشت</button>
        </div>
      </section>
    );
  }

  return (
    <section className="session-frame">
      <div className="session-meta">
        <span className="tag">{exercise.kind === "learn" ? "آشنایی با واژه‌ها" : modes[exercise.kind].title}</span>
        <span className="muted">بخش {number(index + 1)} از {number(exercises.length)}</span>
      </div>
      <div className="progress-track mb-5" role="progressbar" aria-label="پیشرفت تمرین" aria-valuenow={progress}><span style={{ width: progress + "%" }} /></div>
      {exercise.kind === "learn" && <Introduction words={exercise.words} onContinue={() => setIndex(index + 1)} />}
      {exercise.kind === "match" && <Matching key={index} exercise={exercise} advance={advance} onMiss={onMiss} />}
      {exercise.kind !== "learn" && exercise.kind !== "match" && <Question key={index} deck={deck} exercise={exercise} advance={advance} onMiss={onMiss} />}
    </section>
  );
}

function Introduction({ words, onContinue }: { words: Word[]; onContinue: () => void }) {
  const [audioError, setAudioError] = useState(false);

  return (
    <div className="surface question introduction">
      <h1>آشنایی با واژه‌های تازه</h1>
      <p className="muted">واژه‌ها و معنی‌ها را بخوان. بعد از حافظه جواب می‌دهی.</p>
      <ul className="retry-list">
        {words.map((word) => (
          <li key={word.id}>
            <span className="intro-word">
              <button className="icon-button" aria-label={`تلفظ ${word.en}`} onClick={() => setAudioError(!pronounce(word.en))}><Volume2 size={16} /></button>
              <bdi lang="en" dir="ltr">{word.en}</bdi>
            </span>
            <span>{word.fa}</span>
          </li>
        ))}
      </ul>
      {audioError && <p className="error-text" role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}
      <button className="button primary" onClick={onContinue}>شروع سؤال‌ها <ArrowLeft size={17} /></button>
    </div>
  );
}

function Question({ deck, exercise, advance, onMiss }: {
  deck: Deck;
  exercise: Exclude<Exercise, { kind: "match" | "learn" }>;
  advance: (results: Attempt[]) => void;
  onMiss: (word: Word) => void;
}) {
  const { kind, word, reverse, options } = exercise;
  const listen = kind === "listen";
  const flash = kind === "flash";
  const englishAnswer = reverse || listen;
  const [text, setText] = useState("");
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const [selected, setSelected] = useState("");
  const [audioError, setAudioError] = useState(false);
  const nextButton = useRef<HTMLButtonElement>(null);

  function choose(option: Word) {
    setSelected(option.id);
    setResult(option.id === word.id);
    if (option.id !== word.id) onMiss(word);
  }

  function finish(rating: Rating) {
    advance([{ word, rating }]);
  }

  useEffect(() => {
    if (result !== null) nextButton.current?.focus();
  }, [result]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select"))) return;
      const key = "۱۲۳۴".includes(event.key) ? String("۱۲۳۴".indexOf(event.key) + 1) : event.key;
      if (flash && !reveal && key === " " && !(event.target instanceof HTMLElement && event.target.closest("button"))) {
        event.preventDefault();
        setReveal(true);
      } else if (flash && reveal && ["1", "2", "3"].includes(key)) {
        event.preventDefault();
        advance([{ word, rating: (Number(key) - 1) as Rating }]);
      } else if (kind === "choice" && result === null && /^[1-4]$/.test(key) && options[Number(key) - 1]) {
        event.preventDefault();
        const option = options[Number(key) - 1];
        choose(option);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance, flash, reveal, kind, result, options, word, onMiss]);

  function play() {
    setAudioError(!pronounce(word.en));
  }

  const promptLabel = listen ? "صدا را پخش کن و چیزی را که شنیدی بنویس."
    : flash ? "جواب را در ذهن بگو، بعد کارت را برگردان."
    : englishAnswer ? "معادل انگلیسی این عبارت چیست؟" : "معنی فارسی این واژه چیست؟";

  return (
    <div className="surface question">
      <p className="muted">{promptLabel}</p>
      {listen ? (
        <button className="button sound-main" onClick={play}><Volume2 size={23} /> پخش تلفظ</button>
      ) : (
        <div className="question-prompt">
          <h1 lang={reverse ? "fa" : "en"} dir={reverse ? "rtl" : "ltr"}>{reverse ? word.fa : word.en}</h1>
          {!reverse && <button className="icon-button" aria-label="پخش تلفظ" onClick={play}><Volume2 size={20} /></button>}
        </div>
      )}
      {audioError && <p className="error-text" role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}

      {flash && (
        reveal ? (
          <>
            <div className="answer-reveal" aria-live="polite">
              <strong dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}>{englishAnswer ? word.en : word.fa}</strong>
              {reverse && <button className="icon-button" aria-label="پخش تلفظ" onClick={play}><Volume2 size={19} /></button>}
            </div>
            <div className="rating-actions">
              <button className="button secondary" onClick={() => finish(0)}>یادم نبود <kbd>1</kbd></button>
              <button className="button secondary" onClick={() => finish(1)}>با مکث گفتم <kbd>2</kbd></button>
              <button className="button primary" onClick={() => finish(2)}>یادم بود <kbd>3</kbd></button>
            </div>
          </>
        ) : <button className="button primary" onClick={() => setReveal(true)}><Eye size={18} /> دیدن جواب <kbd>Space</kbd></button>
      )}

      {kind === "choice" && (
        <div className="options">
          {options.map((option, index) => (
            <button key={option.id} className={`option ${result !== null && option.id === word.id ? "correct" : ""} ${result === false && selected === option.id ? "incorrect" : ""}`}
              disabled={result !== null} onClick={() => choose(option)}>
              <kbd>{index + 1}</kbd>
              <span dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}>{englishAnswer ? option.en : option.fa}</span>
              {result !== null && option.id === word.id && <Check size={18} />}
              {result === false && selected === option.id && <X size={18} />}
            </button>
          ))}
        </div>
      )}

      {(kind === "type" || listen) && result === null && (
        <form className="type-form" onSubmit={(event) => { event.preventDefault(); if (text.trim()) { const correct = checkAnswer(exercise, text, deck); setResult(correct); if (!correct) onMiss(word); } }}>
          <input value={text} dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}
            onChange={(event) => setText(event.target.value)} autoFocus={!listen} autoComplete="off" autoCorrect="off" spellCheck={false}
            aria-label={englishAnswer ? "پاسخ انگلیسی" : "پاسخ فارسی"} placeholder={englishAnswer ? "Type your answer…" : "پاسخ را بنویس…"} />
          <button className="button primary" disabled={!text.trim()} type="submit">بررسی جواب</button>
          <button className="button secondary" type="button" onClick={() => { setResult(false); onMiss(word); }}>نمی‌دانم</button>
        </form>
      )}

      {result !== null && (
        <div className="answer-feedback">
          <div className={`feedback ${result ? "correct" : "incorrect"}`} role="status">
            <b>{result ? "درست بود" : "پاسخ مورد انتظار"}</b>
            <span><bdi dir="ltr" lang="en">{word.en}</bdi><span className="feedback-separator"> · </span>{word.fa}</span>
            {text && !result && <span className="muted">پاسخ تو <bdi>{text}</bdi></span>}
          </div>
          <div className="button-row">
            <button ref={nextButton} className="button primary" onClick={() => finish(result ? 2 : 0)}>ادامه <ArrowLeft size={17} /></button>
            {!result && kind === "type" && text.trim() && <button className="button secondary" onClick={() => finish(2)}>معادل من هم درست بود</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Matching({ exercise, advance, onMiss }: {
  exercise: Extract<Exercise, { kind: "match" }>;
  advance: (results: Attempt[]) => void;
  onMiss: (word: Word) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const complete = matched.length === exercise.words.length;

  function pair(word: Word) {
    if (!selected) return;
    if (word.id === selected) {
      setMatched([...matched, word.id]);
      setSelected(null);
      setWrong(null);
    } else {
      if (!missed.includes(selected)) {
        setMissed([...missed, selected]);
        const missedWord = exercise.words.find((item) => item.id === selected);
        if (missedWord) onMiss(missedWord);
      }
      setWrong(word.id);
    }
  }

  return (
    <div className="surface question matching">
      <h1>واژه‌ها را به معنی وصل کن</h1>
      <p className="muted">یک واژهٔ انگلیسی را انتخاب کن و روی معنی‌اش بزن.</p>
      <div className="matching-grid" dir="ltr">
        <div>
          {exercise.words.map((word) => (
            <button className={`option ${matched.includes(word.id) ? "correct" : ""}`} aria-pressed={selected === word.id}
              lang="en" disabled={matched.includes(word.id)} key={word.id}
              onClick={() => { setSelected(word.id); setWrong(null); }}>
              {word.en}{matched.includes(word.id) && <Check size={17} />}
            </button>
          ))}
        </div>
        <div dir="rtl">
          {exercise.translations.map((word) => (
            <button className={`option ${matched.includes(word.id) ? "correct" : ""} ${wrong === word.id ? "incorrect" : ""}`}
              disabled={!selected || matched.includes(word.id)} key={word.id} onClick={() => pair(word)}>
              {word.fa}{matched.includes(word.id) && <Check size={17} />}
            </button>
          ))}
        </div>
      </div>
      <p className="muted match-status" role="status">
        {wrong ? "این جفت درست نبود. معنی دیگری را امتحان کن." : `${number(matched.length)} از ${number(exercise.words.length)} جفت پیدا شد`}
      </p>
      {complete && <button className="button primary" autoFocus onClick={() => advance(exercise.words.map((word) => ({ word, rating: missed.includes(word.id) ? 0 : 2 })))}>ادامه <ArrowLeft size={17} /></button>}
    </div>
  );
}



