"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Eye, Lightbulb, RotateCcw, Volume2, X } from "lucide-react";
import { checkAnswer, number, pronounce, spoken, type Attempt, type Deck, type Exercise, type Rating, type Review, type Word } from "../lib/study";
import { durationLabel, type AnswerContext } from "../lib/activity";
import { modes } from "./modes";
import { cx, tileTone, ui } from "./styles";

export type AnswerReceipt = { time: number; before?: Review; rating: Rating };
export type GradeAnswer = (attempt: Attempt, context: AnswerContext, replacing?: AnswerReceipt) => AnswerReceipt;

function units(item: Exercise) {
  return item.kind === "learn" ? 0 : item.kind === "match" ? item.words.length : 1;
}

export function Session({ deck, exercises, adaptive, onGrade, onComplete, onRetry, onExit, onDashboard }: {
  deck: Deck;
  exercises: Exercise[];
  adaptive: boolean;
  onGrade: GradeAnswer;
  onComplete: () => number;
  onRetry: (words: Word[]) => void;
  onExit: () => void;
  onDashboard: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [queue, setQueue] = useState(exercises);
  const [recovered, setRecovered] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const exercise = queue[index];
  const total = queue.reduce((count, item) => count + units(item), 0);
  const completed = queue.slice(0, index).reduce((count, item) => count + units(item), 0);
  const progress = total ? Math.round(completed / total * 100) : 0;

  function advance(results: Attempt[]) {
    let next = queue;
    if ("revisit" in exercise && exercise.revisit) {
      if (results[0].rating === 2) setRecovered((ids) => [...ids, results[0].word.id]);
    } else {
      setAttempts((previous) => [...previous, ...results]);
      if (adaptive && exercise.kind !== "match" && exercise.kind !== "learn" && results[0].rating < 2) {
        let position = index + 1;
        let gap = 0;
        while (position < queue.length && gap < 2) gap += units(queue[position++]);
        const recall: Exercise = { kind: "type", word: exercise.word, reverse: exercise.reverse, options: [], revisit: true };
        next = [...queue.slice(0, position), recall, ...queue.slice(position)];
        setQueue(next);
      }
    }
    if (index + 1 === next.length) setDuration(onComplete());
    setIndex(index + 1);
  }

  if (!exercise) {
    const right = attempts.filter(({ rating }) => rating === 2).length;
    const retry = attempts.filter(({ word, rating }) => rating !== 2 && !recovered.includes(word.id));
    return (
      <section className={cx(ui.sessionFrame, ui.surface, ui.summary)}>
        <span className={cx(ui.iconTile, tileTone.green, "mx-auto mb-[11px] size-[62px]! rounded-[17px]!")}><CheckCircle2 size={31} /></span>
        <h1>تمرین تمام شد</h1>
        <p className={ui.muted}>پیشرفت این جلسه ذخیره شد.</p>
        <div className="my-4 grid grid-cols-2 gap-2">
          <div className={ui.summaryScore}><b>{number(right)} از {number(attempts.length)}</b><span>پاسخ درست در تلاش اول</span></div>
          <div className={ui.summaryScore}><b>{durationLabel(duration)}</b><span>زمان ثبت‌شدهٔ این تمرین</span></div>
        </div>
        {recovered.length > 0 && <p className="mb-3 text-(--accent)">{number(recovered.length)} واژه را در تلاش دوباره به یاد آوردی.</p>}
        {retry.length > 0 && (
          <>
            <h2 className="text-[16px]">واژه‌هایی که مرور بیشتری می‌خواهند</h2>
            <ul className={ui.retryList}>
              {retry.map(({ word }) => <li key={word.id}><span dir="ltr" lang="en">{word.en}</span><span>{word.fa}</span></li>)}
            </ul>
          </>
        )}
        <div className={cx(ui.buttonRow, "justify-center")}>
          {retry.length > 0 && <button className={cx(ui.button, ui.primary)} onClick={() => onRetry(retry.map(({ word }) => word))}><RotateCcw size={17} /> مرور {number(retry.length)} واژه</button>}
          <button className={cx(ui.button, retry.length ? ui.secondary : ui.primary)} onClick={onDashboard}>دیدن داشبورد</button>
          <button className={cx(ui.button, ui.secondary)} onClick={onExit}>بازگشت</button>
        </div>
      </section>
    );
  }

  return (
    <section className={ui.sessionFrame}>
      <div className={ui.sessionMeta}>
        <span className={ui.tag}>{exercise.kind === "learn" ? "آشنایی با واژه‌ها" : "revisit" in exercise && exercise.revisit ? "یادآوری دوباره" : modes[exercise.kind].title}</span>
        <span className={ui.muted}>بخش {number(index + 1)} از {number(queue.length)}</span>
      </div>
      <div className={cx(ui.progressTrack, "mb-5")} role="progressbar" aria-label="پیشرفت تمرین" aria-valuenow={progress}><span style={{ width: progress + "%" }} /></div>
      {exercise.kind === "learn" && <Introduction words={exercise.words} onContinue={() => setIndex(index + 1)} />}
      {exercise.kind === "match" && <Matching key={index} exercise={exercise} advance={advance} onGrade={onGrade} />}
      {exercise.kind !== "learn" && exercise.kind !== "match" && <Question key={index} deck={deck} exercise={exercise} advance={advance} onGrade={onGrade} />}
    </section>
  );
}

function Introduction({ words, onContinue }: { words: Word[]; onContinue: () => void }) {
  const [audioError, setAudioError] = useState(false);
  const [showMeanings, setShowMeanings] = useState(true);

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
            <span>{showMeanings ? word.fa : "•••"}</span>
          </li>
        ))}
      </ul>
      {audioError && <p className={ui.errorText} role="status">پخش تلفظ در این مرورگر در دسترس نیست.</p>}
      <div className={cx(ui.buttonRow, "justify-center")}>
        <button className={cx(ui.button, ui.primary)} onClick={onContinue}>شروع سؤال‌ها <ArrowLeft size={17} /></button>
        <button className={cx(ui.button, ui.secondary)} aria-pressed={!showMeanings} onClick={() => setShowMeanings(!showMeanings)}>{showMeanings ? "پنهان کردن معنی‌ها" : "نمایش معنی‌ها"}</button>
      </div>
    </div>
  );
}

function Question({ deck, exercise, advance, onGrade }: {
  deck: Deck;
  exercise: Exclude<Exercise, { kind: "match" | "learn" }>;
  advance: (results: Attempt[]) => void;
  onGrade: GradeAnswer;
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
  const [hint, setHint] = useState(false);
  const receipt = useRef<AnswerReceipt | undefined>(undefined);
  const nextButton = useRef<HTMLButtonElement>(null);

  function record(rating: Rating) {
    if (receipt.current?.rating === rating) return;
    const direction = listen ? undefined : reverse ? "fa-en" : "en-fa";
    receipt.current = onGrade({ word, rating }, { drill: kind, revisit: exercise.revisit, direction }, receipt.current);
  }

  function respond(correct: boolean) {
    if (receipt.current) return;
    record(correct ? (hint ? 1 : 2) : 0);
    setResult(correct);
  }

  function choose(option: Word) {
    setSelected(option.id);
    respond(option.id === word.id);
  }

  function finish(rating: Rating) {
    record(rating);
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
        finish((Number(key) - 1) as Rating);
      } else if (kind === "choice" && result === null && /^[1-4]$/.test(key) && options[Number(key) - 1]) {
        event.preventDefault();
        const option = options[Number(key) - 1];
        choose(option);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance, flash, reveal, kind, result, options, word, onGrade]);

  function play() {
    setAudioError(!pronounce(word.en));
  }

  const promptLabel = listen ? "صدا را پخش کن و چیزی را که شنیدی بنویس."
    : flash ? "جواب را در ذهن بگو، بعد کارت را برگردان."
    : englishAnswer ? "معادل انگلیسی این عبارت چیست؟" : "معنی فارسی این واژه چیست؟";
  const target = (englishAnswer ? spoken(word.en) : word.fa.split(/[،,؛;/]/)[0]).trim();

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
        <>
        <form className={ui.typeForm} onSubmit={(event) => { event.preventDefault(); if (text.trim()) respond(checkAnswer(exercise, text, deck)); }}>
          <input className={cx(ui.field, "text-[16px]")} value={text} dir={englishAnswer ? "ltr" : "rtl"} lang={englishAnswer ? "en" : "fa"}
            onChange={(event) => setText(event.target.value)} autoFocus={!listen} autoComplete="off" autoCorrect="off" spellCheck={false}
            aria-label={englishAnswer ? "پاسخ انگلیسی" : "پاسخ فارسی"} placeholder={englishAnswer ? "Type your answer…" : "پاسخ را بنویس…"} />
          <button className={cx(ui.button, ui.primary)} disabled={!text.trim()} type="submit">بررسی جواب</button>
          <button className={cx(ui.button, ui.secondary)} type="button" onClick={() => respond(false)}>نمی‌دانم</button>
        </form>
        {target.length > 1 && <div className="mt-3 text-start text-[13px]">
          {hint ? <p className={ui.muted} role="status">حرف اول «<bdi>{Array.from(target)[0]}</bdi>» است و پاسخ {number(target.split(/\s+/).length)} کلمه دارد.</p>
            : <button className={ui.textButton} onClick={() => setHint(true)}><Lightbulb size={15} /> راهنمای حرف اول</button>}
        </div>}
        </>
      )}

      {result !== null && (
        <div className={ui.answerFeedback}>
          <div className={cx(ui.feedback, result ? ui.correct : ui.incorrect)} role="status">
            <b>{result ? hint ? "با راهنما درست گفتی" : "درست بود" : "پاسخ مورد انتظار"}</b>
            <span><bdi dir="ltr" lang="en">{word.en}</bdi><span className={ui.feedbackSeparator}> · </span>{word.fa}</span>
            {text && !result && <span className={ui.muted}>پاسخ تو <bdi>{text}</bdi></span>}
          </div>
          <div className={cx(ui.buttonRow, "mt-[11px]")}>
            <button ref={nextButton} className={cx(ui.button, ui.primary)} onClick={() => finish(receipt.current!.rating)}>ادامه <ArrowLeft size={17} /></button>
            {!result && kind === "type" && text.trim() && <button className={cx(ui.button, ui.secondary)} onClick={() => finish(hint ? 1 : 2)}>معادل من هم درست بود</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Matching({ exercise, advance, onGrade }: {
  exercise: Extract<Exercise, { kind: "match" }>;
  advance: (results: Attempt[]) => void;
  onGrade: GradeAnswer;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const complete = matched.length === exercise.words.length;

  function pair(word: Word) {
    if (!selected) return;
    if (word.id === selected) {
      if (!missed.includes(selected)) onGrade({ word, rating: 2 }, { drill: "match" });
      setMatched([...matched, word.id]);
      setSelected(null);
      setWrong(null);
    } else {
      if (!missed.includes(selected)) {
        setMissed([...missed, selected]);
        const missedWord = exercise.words.find((item) => item.id === selected);
        if (missedWord) onGrade({ word: missedWord, rating: 0 }, { drill: "match" });
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



