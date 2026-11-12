"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Eye, RotateCcw, Volume2, X } from "lucide-react";
import { checkAnswer, number, pronounce, type Attempt, type Deck, type Exercise, type Rating, type Word } from "../lib/study";
import { modes } from "./modes";
import { cx, tileTone, ui } from "./styles";

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
      <section className={cx(ui.sessionFrame, ui.surface, ui.summary)}>
        <span className={cx(ui.iconTile, tileTone.green, "mx-auto mb-[11px] size-[62px]! rounded-[17px]!")}><CheckCircle2 size={31} /></span>
        <h1>تمرین تمام شد</h1>
        <p className={ui.muted}>پیشرفت این جلسه ذخیره شد.</p>
        <div className={ui.summaryScore}><b>{number(right)} از {number(total)}</b><span>پاسخ درست</span></div>
        {retry.length > 0 && (
          <ul className={ui.retryList}>
            {retry.map(({ word }) => <li key={word.id}><span dir="ltr" lang="en">{word.en}</span><span>{word.fa}</span></li>)}
          </ul>
        )}
        <div className={cx(ui.buttonRow, "justify-center")}>
          {retry.length > 0 && <button className={cx(ui.button, ui.primary)} onClick={() => onRetry(retry.map(({ word }) => word))}><RotateCcw size={17} /> مرور {number(retry.length)} واژه</button>}
          <button className={cx(ui.button, ui.secondary)} onClick={onExit}>بازگشت</button>
        </div>
      </section>
    );
  }

  return (
    <section className={ui.sessionFrame}>
      <div className={ui.sessionMeta}>
        <span className={ui.tag}>{exercise.kind === "learn" ? "آشنایی با واژه‌ها" : modes[exercise.kind].title}</span>
        <span className={ui.muted}>بخش {number(index + 1)} از {number(exercises.length)}</span>
      </div>
      <div className={cx(ui.progressTrack, "mb-5")} role="progressbar" aria-label="پیشرفت تمرین" aria-valuenow={progress}><span style={{ width: progress + "%" }} /></div>
      {exercise.kind === "learn" && <Introduction words={exercise.words} onContinue={() => setIndex(index + 1)} />}
      {exercise.kind === "match" && <Matching key={index} exercise={exercise} advance={advance} onMiss={onMiss} />}
      {exercise.kind !== "learn" && exercise.kind !== "match" && <Question key={index} deck={deck} exercise={exercise} advance={advance} onMiss={onMiss} />}
    </section>
  );
}

function Introduction({ words, onContinue }: { words: Word[]; onContinue: () => void }) {
  const [audioError, setAudioError] = useState(false);

  return (
    <div className={cx(ui.surface, ui.question, ui.introduction)}>
      <h1>آشنایی با واژه‌های تازه</h1>
      <p className={ui.muted}>واژه‌ها و معنی‌ها را بخوان. بعد از حافظه جواب می‌دهی.</p>
      <ul className={ui.retryList}>
        {words.map((word) => (
          <li key={word.id}>
            <span className={ui.introWord}>
              <button className={ui.iconButton} aria-label={`تلفظ ${word.en}`} onClick={() => setAudioError(!pronounce(word.en))}><Volume2 size={16} /></button>
              <bdi lang="en" dir="ltr">{word.en}</bdi>
            </span>
            <span>{word.fa}</span>
          </li>
        ))}
      </ul>
      {audioError && <p className={ui.errorText} role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}
      <button className={cx(ui.button, ui.primary)} onClick={onContinue}>شروع سؤال‌ها <ArrowLeft size={17} /></button>
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
    <div className={cx(ui.surface, ui.question)}>
      <p className={ui.muted}>{promptLabel}</p>
      {listen ? (
        <button className={cx(ui.button, ui.soundMain)} onClick={play}><Volume2 size={23} /> پخش تلفظ</button>
      ) : (
        <div className={ui.questionPrompt}>
          <h1 lang={reverse ? "fa" : "en"} dir={reverse ? "rtl" : "ltr"}>{reverse ? word.fa : word.en}</h1>
          {!reverse && <button className={ui.iconButton} aria-label="پخش تلفظ" onClick={play}><Volume2 size={20} /></button>}
        </div>
      )}
      {audioError && <p className={ui.errorText} role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}

      {flash && (
        reveal ? (
          <>
            <div className={ui.answerReveal} aria-live="polite">
              <strong dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}>{englishAnswer ? word.en : word.fa}</strong>
              {reverse && <button className={ui.iconButton} aria-label="پخش تلفظ" onClick={play}><Volume2 size={19} /></button>}
            </div>
            <div className={ui.ratingActions}>
              <button className={cx(ui.button, ui.secondary)} onClick={() => finish(0)}>یادم نبود <kbd>1</kbd></button>
              <button className={cx(ui.button, ui.secondary)} onClick={() => finish(1)}>با مکث گفتم <kbd>2</kbd></button>
              <button className={cx(ui.button, ui.primary)} onClick={() => finish(2)}>یادم بود <kbd>3</kbd></button>
            </div>
          </>
        ) : <button className={cx(ui.button, ui.primary)} onClick={() => setReveal(true)}><Eye size={18} /> دیدن جواب <kbd>Space</kbd></button>
      )}

      {kind === "choice" && (
        <div className={ui.options}>
          {options.map((option, index) => (
            <button key={option.id} className={cx(ui.option, result !== null && option.id === word.id ? ui.correct : result === false && selected === option.id ? ui.incorrect : ui.optionNeutral)}
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
        <form className={ui.typeForm} onSubmit={(event) => { event.preventDefault(); if (text.trim()) { const correct = checkAnswer(exercise, text, deck); setResult(correct); if (!correct) onMiss(word); } }}>
          <input className={cx(ui.field, "text-[16px]")} value={text} dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}
            onChange={(event) => setText(event.target.value)} autoFocus={!listen} autoComplete="off" autoCorrect="off" spellCheck={false}
            aria-label={englishAnswer ? "پاسخ انگلیسی" : "پاسخ فارسی"} placeholder={englishAnswer ? "Type your answer…" : "پاسخ را بنویس…"} />
          <button className={cx(ui.button, ui.primary)} disabled={!text.trim()} type="submit">بررسی جواب</button>
          <button className={cx(ui.button, ui.secondary)} type="button" onClick={() => { setResult(false); onMiss(word); }}>نمی‌دانم</button>
        </form>
      )}

      {result !== null && (
        <div className={ui.answerFeedback}>
          <div className={cx(ui.feedback, result ? ui.correct : ui.incorrect)} role="status">
            <b>{result ? "درست بود" : "پاسخ مورد انتظار"}</b>
            <span><bdi dir="ltr" lang="en">{word.en}</bdi><span className={ui.feedbackSeparator}> · </span>{word.fa}</span>
            {text && !result && <span className={ui.muted}>پاسخ تو <bdi>{text}</bdi></span>}
          </div>
          <div className={cx(ui.buttonRow, "mt-[11px]")}>
            <button ref={nextButton} className={cx(ui.button, ui.primary)} onClick={() => finish(result ? 2 : 0)}>ادامه <ArrowLeft size={17} /></button>
            {!result && kind === "type" && text.trim() && <button className={cx(ui.button, ui.secondary)} onClick={() => finish(2)}>معادل من هم درست بود</button>}
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
    <div className={cx(ui.surface, ui.question, ui.matching)}>
      <h1>واژه‌ها را به معنی وصل کن</h1>
      <p className={ui.muted}>یک واژهٔ انگلیسی را انتخاب کن و روی معنی‌اش بزن.</p>
      <div className={ui.matchingGrid} dir="ltr">
        <div>
          {exercise.words.map((word) => (
            <button className={cx(ui.option, ui.matchingOption, matched.includes(word.id) ? ui.correct : ui.optionNeutral)} aria-pressed={selected === word.id}
              lang="en" disabled={matched.includes(word.id)} key={word.id}
              onClick={() => { setSelected(word.id); setWrong(null); }}>
              {word.en}{matched.includes(word.id) && <Check size={17} />}
            </button>
          ))}
        </div>
        <div dir="rtl">
          {exercise.translations.map((word) => (
            <button className={cx(ui.option, ui.matchingOption, matched.includes(word.id) ? ui.correct : wrong === word.id ? ui.incorrect : ui.optionNeutral)}
              disabled={!selected || matched.includes(word.id)} key={word.id} onClick={() => pair(word)}>
              {word.fa}{matched.includes(word.id) && <Check size={17} />}
            </button>
          ))}
        </div>
      </div>
      <p className={cx(ui.muted, ui.matchStatus)} role="status">
        {wrong ? "این جفت درست نبود. معنی دیگری را امتحان کن." : `${number(matched.length)} از ${number(exercise.words.length)} جفت پیدا شد`}
      </p>
      {complete && <button className={cx(ui.button, ui.primary)} autoFocus onClick={() => advance(exercise.words.map((word) => ({ word, rating: missed.includes(word.id) ? 0 : 2 })))}>ادامه <ArrowLeft size={17} /></button>}
    </div>
  );
}



