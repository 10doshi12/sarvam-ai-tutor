"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BoardItem, DoubtAnswer, Lesson, Quiz, Step, TopicScript, TutorId } from "@/lib/types";
import { DEFAULT_TUTOR, LANGUAGES, LEVELS, TIMING, TUTORS } from "@/lib/config";
import { getSource, saveLesson } from "@/lib/client/storage";
import { getTopicScript } from "@/lib/client/scripts";
import { type Voice, cancelPrefetch, loadAudio, playBuffer, prefetchAudio, stopAudio, unlockAudio } from "@/lib/client/audio";
import { recordingAvailable, startRecording, type Recording } from "@/lib/client/recorder";
import Avatar, { type Mood } from "./Avatar";
import Captions from "./Captions";
import DoubtPanel from "./DoubtPanel";
import QuizPanel from "./QuizPanel";
import TopicList from "./TopicList";
import Icon from "@/components/ui/Icon";
import Whiteboard, { type BoardEntry } from "./Whiteboard";

type PlayerState = "idle" | "loading" | "speaking" | "listening" | "thinking" | "answering" | "quiz" | "done" | "error";
type Target = "board" | "answer";

const QUESTION_END = /[?？]\s*$/;
const EXCITED_END = /[!！]\s*$/;
const MISSED = "I didn't catch that. Try again or type your doubt.";

const firstOpenTopic = (lesson: Lesson) => {
  const i = lesson.topics.findIndex((t) => !t.done);
  return i === -1 ? 0 : i;
};

// How long to show a sentence when its audio is unavailable, based on its length.
const holdFor = (text: string) => Math.max(TIMING.fallbackMinMs, text.length * TIMING.fallbackMsPerChar);

export default function LessonPlayer({ lesson: initial }: { lesson: Lesson }) {
  const [state, setStateRaw] = useState<PlayerState>("idle");
  const [lesson, setLesson] = useState(initial);
  const [topicIdx, setTopicIdx] = useState(() => firstOpenTopic(initial));
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [answer, setAnswer] = useState<{ question: string; entries: BoardEntry[] } | null>(null);
  const [caption, setCaption] = useState("");
  const [quiz, setQuiz] = useState<{ quiz: Quiz; selected: number | null } | null>(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [mic, setMic] = useState<"recording" | "unavailable">("unavailable");
  const [started, setStarted] = useState(false);
  const [errorText, setErrorText] = useState("");

  const stateRef = useRef<PlayerState>("idle");
  const lessonRef = useRef(initial);
  // Bumped on every interrupt; any async work holding an older value must stop quietly.
  const tokenRef = useRef(0);
  const cursor = useRef({ topic: 0, step: 0 });
  const scriptRef = useRef<TopicScript | null>(null);
  const boardRef = useRef<BoardEntry[]>([]);
  const answerRef = useRef<BoardEntry[]>([]);
  const stepStartBoard = useRef<BoardEntry[]>([]);
  const doubtRef = useRef<{ say: string; snapshot: BoardEntry[] } | null>(null);
  const recRef = useRef<Recording | null>(null);
  const questionRef = useRef("");
  const keyCounter = useRef(0);
  const cancelHold = useRef<(() => void) | null>(null);

  const setState = (s: PlayerState) => {
    stateRef.current = s;
    setStateRaw(s);
  };
  const alive = (t: number) => tokenRef.current === t;
  // Read from the ref so a tutor change applies to the next sentence of a lesson already running.
  const voice = (): Voice => ({ language: lessonRef.current.language, tutor: lessonRef.current.tutor ?? DEFAULT_TUTOR });

  const hold = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        cancelHold.current = null;
        resolve();
      }, ms);
      cancelHold.current = () => {
        window.clearTimeout(timer);
        cancelHold.current = null;
        resolve();
      };
    });

  const makeEntries = (items: BoardItem[], totalMs: number): BoardEntry[] => {
    const per = totalMs / Math.max(1, items.length);
    return items.map((item, i) => ({ key: `e${keyCounter.current++}`, item, delayMs: i * per, durationMs: per }));
  };

  // Plays one step: fetch speech, write its board items while it plays, wait for the end.
  const playStep = async (step: Step, t: number, target: Target, ahead: string[] = []) => {
    if (target === "board") stepStartBoard.current = boardRef.current;
    setCaption(step.say);
    let buffer: AudioBuffer | null = null;
    try {
      buffer = await loadAudio(step.say, voice());
    } catch {
      buffer = null;
    }
    if (!alive(t)) return;
    // Sarvam answers parallel calls slowly, so the current sentence goes first.
    prefetchAudio(ahead, voice(), TIMING.maxConcurrentTts);
    const ms = buffer ? buffer.duration * 1000 : holdFor(step.say);
    const ref = target === "board" ? boardRef : answerRef;
    const next = [...(step.clearBoard ? [] : ref.current), ...makeEntries(step.board, ms)];
    ref.current = next;
    if (target === "board") setBoard(next);
    else setAnswer((a) => (a ? { ...a, entries: next } : a));
    if (buffer) await playBuffer(buffer).ended;
    else await hold(ms);
  };

  const speakOnly = async (say: string, t: number) => {
    setCaption(say);
    try {
      const buffer = await loadAudio(say, voice());
      if (!alive(t)) return;
      await playBuffer(buffer).ended;
    } catch {
      if (alive(t)) await hold(holdFor(say));
    }
  };

  const finishTopic = async (correct: boolean, t: number) => {
    const topics = lessonRef.current.topics.map((x, i) =>
      i === cursor.current.topic ? { ...x, done: true, quizCorrect: correct } : x,
    );
    const updated = { ...lessonRef.current, topics };
    lessonRef.current = updated;
    setLesson(updated);
    try {
      saveLesson(updated);
    } catch {
      // Progress stays in memory for this session if storage is full.
    }
    if (!alive(t)) return;
    const nextIdx = cursor.current.topic + 1;
    if (nextIdx < topics.length) {
      await beginTopic(nextIdx);
    } else {
      setQuiz(null);
      setState("done");
    }
  };

  const runSteps = async (t: number) => {
    const script = scriptRef.current;
    if (!script) return;
    while (alive(t) && cursor.current.step < script.steps.length) {
      const idx = cursor.current.step;
      setState("speaking");
      const ahead = script.steps.slice(idx + 1, idx + 1 + TIMING.prefetchSteps).map((s) => s.say);
      await playStep(script.steps[idx], t, "board", ahead);
      if (!alive(t)) return;
      cursor.current.step = idx + 1;
    }
    if (!alive(t)) return;
    if (script.quiz?.options?.length) {
      setQuiz({ quiz: script.quiz, selected: null });
      setState("quiz");
    } else {
      await finishTopic(true, t);
    }
  };

  async function beginTopic(index: number) {
    const t = ++tokenRef.current;
    const topic = lessonRef.current.topics[index];
    cursor.current = { topic: index, step: 0 };
    doubtRef.current = null;
    boardRef.current = [];
    stepStartBoard.current = [];
    answerRef.current = [];
    setTopicIdx(index);
    setBoard([]);
    setAnswer(null);
    setQuiz(null);
    setCaption("");
    setNotice(null);
    setState("loading");
    try {
      const script = await getTopicScript(lessonRef.current, topic);
      if (!alive(t)) return;
      scriptRef.current = script;
      if (script.steps[0]) await loadAudio(script.steps[0].say, voice()).catch(() => undefined);
      if (!alive(t)) return;
    } catch (e) {
      if (!alive(t)) return;
      setErrorText(e instanceof Error ? e.message : "Could not load this topic.");
      setState("error");
      return;
    }
    const following = lessonRef.current.topics[index + 1];
    if (following) void getTopicScript(lessonRef.current, following).catch(() => undefined);
    await runSteps(t);
  }

  const onStart = () => {
    void unlockAudio();
    setStarted(true);
    const from = lessonRef.current.topics.every((x) => x.done) ? 0 : topicIdx;
    void beginTopic(from);
  };

  const pickQuiz = async (i: number) => {
    if (!quiz || quiz.selected !== null) return;
    void unlockAudio();
    const t = ++tokenRef.current;
    setQuiz({ ...quiz, selected: i });
    await speakOnly(quiz.quiz.explanation, t);
    if (!alive(t)) return;
    await finishTopic(i === quiz.quiz.correctIndex, t);
  };

  const onQuizNext = () => {
    if (!quiz || quiz.selected === null) return;
    const t = ++tokenRef.current;
    stopAudio();
    cancelHold.current?.();
    void finishTopic(quiz.selected === quiz.quiz.correctIndex, t);
  };

  const onPickTutor = (tutor: TutorId) => {
    const updated = { ...lessonRef.current, tutor };
    lessonRef.current = updated;
    setLesson(updated);
    cancelPrefetch();
    try {
      saveLesson(updated);
    } catch {
      // The choice stays in memory for this session if storage is full.
    }
  };

  // Jumps to any topic, abandoning whatever is playing or being asked.
  const onPickTopic = (index: number) => {
    void unlockAudio();
    setStarted(true);
    stopAudio();
    cancelPrefetch();
    cancelHold.current?.();
    recRef.current?.cancel();
    recRef.current = null;
    setText("");
    setCanRetry(false);
    void beginTopic(index);
  };

  // Drops the answer, restores the board as it was, and replays the interrupted step from its start.
  const resumeLesson = () => {
    const d = doubtRef.current;
    doubtRef.current = null;
    answerRef.current = [];
    setAnswer(null);
    setNotice(null);
    setCanRetry(false);
    setText("");
    if (d) {
      boardRef.current = d.snapshot;
      setBoard(d.snapshot);
    }
    void runSteps(++tokenRef.current);
  };

  const endMic = () => {
    recRef.current?.cancel();
    recRef.current = null;
  };

  const askDoubt = async (question: string, t: number) => {
    const d = doubtRef.current;
    if (!d) return;
    questionRef.current = question;
    setNotice(null);
    setCanRetry(false);
    setState("thinking");
    let result: DoubtAnswer;
    try {
      const source = getSource(lessonRef.current.id);
      if (!source) throw new Error("The book text for this lesson is missing. Please upload the PDF again.");
      const res = await fetch("/api/doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          level: lessonRef.current.level,
          language: lessonRef.current.language,
          topic: lessonRef.current.topics[cursor.current.topic],
          currentSay: d.say,
          question,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "Could not answer that. Please try again.");
      result = data as DoubtAnswer;
    } catch (e) {
      if (!alive(t)) return;
      setNotice(e instanceof Error ? e.message : "Could not answer that. Please try again.");
      setCanRetry(true);
      setMic("unavailable");
      setText(question);
      setState("listening");
      return;
    }
    if (!alive(t)) return;
    answerRef.current = [];
    setAnswer({ question: result.question || question, entries: [] });
    setState("answering");
    for (const step of result.steps) {
      await playStep(step, t, "answer");
      if (!alive(t)) return;
    }
    resumeLesson();
  };

  const missed = (t: number) => {
    setNotice(MISSED);
    setState("listening");
    void startMic(t);
  };

  const transcribe = async (blob: Blob, filename: string, t: number) => {
    setState("thinking");
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      form.append("keyterms", JSON.stringify(lessonRef.current.topics.map((x) => x.title)));
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "Could not hear that.");
      if (!alive(t)) return;
      const heard = String(data.transcript ?? "").trim();
      if (heard) {
        await askDoubt(heard, t);
        return;
      }
      missed(t);
    } catch (e) {
      if (!alive(t)) return;
      setNotice(e instanceof Error ? e.message : "Could not hear that.");
      setState("listening");
      void startMic(t);
    }
  };

  async function startMic(t: number) {
    if (!recordingAvailable()) {
      setMic("unavailable");
      return;
    }
    try {
      const rec: Recording = await startRecording({
        maxMs: TIMING.maxRecordingMs,
        silenceMs: TIMING.silenceStopMs,
        silenceLevel: TIMING.silenceRms,
        onAutoStop: (audio) => {
          if (recRef.current !== rec || !alive(t)) return;
          recRef.current = null;
          if (audio) void transcribe(audio.blob, audio.filename, t);
          else missed(t);
        },
      });
      if (!alive(t) || recRef.current || stateRef.current !== "listening") {
        rec.cancel();
        return;
      }
      recRef.current = rec;
      setMic("recording");
    } catch {
      setMic("unavailable");
      setNotice("The microphone is not available, so type your doubt instead.");
    }
  }

  const onAsk = () => {
    void unlockAudio();
    const was = stateRef.current;
    if (was !== "speaking" && was !== "answering") return;
    const t = ++tokenRef.current;
    stopAudio();
    cancelHold.current?.();
    if (!doubtRef.current) {
      const say = scriptRef.current?.steps[cursor.current.step]?.say ?? caption;
      doubtRef.current = { say, snapshot: stepStartBoard.current };
    }
    answerRef.current = [];
    setAnswer(null);
    setText("");
    setNotice(null);
    setCanRetry(false);
    setMic("unavailable");
    setState("listening");
    void startMic(t);
  };

  const onSend = async () => {
    const t = tokenRef.current;
    const typed = text.trim();
    if (typed) {
      endMic();
      setText("");
      await askDoubt(typed, t);
      return;
    }
    const rec = recRef.current;
    if (!rec) {
      setNotice("Speak or type your doubt first.");
      return;
    }
    recRef.current = null;
    const audio = await rec.stop();
    if (!alive(t)) return;
    if (audio) await transcribe(audio.blob, audio.filename, t);
    else missed(t);
  };

  const onCancelDoubt = () => {
    endMic();
    resumeLesson();
  };

  useEffect(() => {
    const open = lessonRef.current;
    const topic = open.topics[firstOpenTopic(open)];
    if (!topic) return;
    getTopicScript(open, topic)
      .then((s) => {
        const says = s.steps.slice(0, TIMING.prefetchSteps).map((x) => x.say);
        prefetchAudio(says, voice(), TIMING.maxConcurrentTts);
      })
      .catch(() => undefined)
      // Writes the other topics one by one so switching to them is instant.
      .then(async () => {
        for (const other of open.topics) await getTopicScript(open, other).catch(() => undefined);
      });
  }, []);

  useEffect(
    () => () => {
      tokenRef.current++;
      stopAudio();
      cancelHold.current?.();
      recRef.current?.cancel();
    },
    [],
  );

  const speaking = state === "speaking" || state === "answering" || state === "quiz";
  const doubtOpen = state === "listening" || state === "thinking";
  const mood: Mood =
    state === "listening"
      ? "listening"
      : state === "thinking" || state === "loading"
        ? "thinking"
        : state === "done"
          ? "happy"
          : quiz && quiz.selected !== null
            ? quiz.selected === quiz.quiz.correctIndex
              ? "happy"
              : "concerned"
            : QUESTION_END.test(caption)
              ? "asking"
              : EXCITED_END.test(caption)
                ? "excited"
                : "neutral";
  const langName = LANGUAGES.find((l) => l.code === lesson.language)?.name ?? lesson.language;
  const anyDone = lesson.topics.some((x) => x.done);
  const allDone = lesson.topics.every((x) => x.done);

  return (
    <div data-state={state} className="flex min-h-dvh flex-col gap-4 p-3 pb-24 sm:p-4 sm:pb-24 lg:h-dvh lg:min-h-0 lg:pb-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/" aria-label="Back to my lessons" className="nb-btn nb-btn-ghost nb-btn-icon">
          <Icon name="back" />
        </Link>
        <h1 className="min-w-0 flex-1 basis-[calc(100%-60px)] truncate text-lg font-bold tracking-tight sm:basis-0 sm:text-xl" title={lesson.title}>
          {lesson.title}
        </h1>
        <span className="nb-chip">{LEVELS.find((l) => l.value === lesson.level)?.name ?? lesson.level}</span>
        <span className="nb-chip">{langName}</span>
        <select
          data-testid="tutor-select"
          aria-label="Tutor"
          value={lesson.tutor ?? DEFAULT_TUTOR}
          onChange={(e) => onPickTutor(e.target.value as TutorId)}
          className="nb-field w-28 py-1 text-sm"
        >
          {TUTORS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
        <div className="flex min-h-0 flex-col gap-4">
          <section className="nb-board relative min-h-[46dvh] flex-1 overflow-hidden lg:min-h-0">
            <Whiteboard entries={board} />

            {answer && (
              <div className="glass-dark absolute inset-3 z-10 flex flex-col overflow-hidden">
                <div className="border-b-2 border-chalk px-4 py-2 text-sm">
                  <span className="font-bold text-chalk-accent">Your doubt: </span>
                  {answer.question}
                </div>
                <div className="min-h-0 flex-1">
                  <Whiteboard entries={answer.entries} variant="answer" />
                </div>
              </div>
            )}

            {quiz && <QuizPanel quiz={quiz.quiz} selected={quiz.selected} onPick={(i) => void pickQuiz(i)} onNext={onQuizNext} />}

            {state === "idle" && (
              <div className="absolute inset-0 z-10 board-scrim flex items-center justify-center p-5">
                <div className="glass flex max-w-sm flex-col items-center gap-4 p-6 text-center">
                  <p className="text-xl font-bold tracking-tight text-balance">
                    {anyDone && !allDone ? "Welcome back. Pick up where you left off." : "Your tutor is ready."}
                  </p>
                  <button type="button" data-testid="start-button" onClick={onStart} className="nb-btn nb-btn-primary w-full">
                    {anyDone && !allDone ? "Continue lesson" : allDone ? "Start again" : "Start lesson"} <Icon name="arrow" />
                  </button>
                </div>
              </div>
            )}

            {state === "loading" && (
              <div className="absolute inset-0 z-10 board-scrim flex items-center justify-center p-5" role="status">
                <div className="glass flex items-center gap-3 px-5 py-3 font-bold">
                  <span className="nb-pulse size-3 rounded-sm bg-ink" aria-hidden="true" />
                  Getting this topic ready
                </div>
              </div>
            )}

            {state === "done" && (
              <div className="absolute inset-0 z-10 board-scrim flex items-center justify-center p-5">
                <div className="glass flex max-w-sm flex-col items-center gap-3 p-6 text-center">
                  <p className="text-2xl font-bold tracking-tight">Lesson complete</p>
                  <p className="text-muted">You finished all {lesson.topics.length} topics.</p>
                  <Link href="/" className="nb-btn nb-btn-primary w-full">
                    Back to my lessons
                  </Link>
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="absolute inset-0 z-10 board-scrim flex items-center justify-center p-5" role="alert">
                <div className="glass flex max-w-md flex-col items-center gap-4 p-6 text-center">
                  <p className="font-medium">{errorText}</p>
                  <button type="button" onClick={() => void beginTopic(cursor.current.topic)} className="nb-btn nb-btn-primary w-full">
                    Try again
                  </button>
                </div>
              </div>
            )}
          </section>

          <Captions text={caption} options={LANGUAGES.map((l) => ({ code: l.code, name: l.name }))} lessonLanguage={lesson.language} />
        </div>

        <aside className="contents lg:flex lg:min-h-0 lg:flex-col lg:gap-4">
          {/* On small screens the tutor sits above the board instead of below the fold. */}
          <div className="nb-card order-first h-40 shrink-0 overflow-hidden bg-accent lg:order-none lg:h-[clamp(170px,30dvh,290px)]">
            <Avatar speaking={speaking} mood={mood} tutor={lesson.tutor ?? DEFAULT_TUTOR} />
          </div>
          <TopicList topics={lesson.topics} current={topicIdx} started={started} onPick={onPickTopic} />
          {/* Fixed on small screens so a doubt is always one tap away. */}
          <div className="fixed inset-x-3 bottom-3 z-30 shrink-0 sm:inset-x-4 lg:static">
            {doubtOpen ? (
              <DoubtPanel
                phase={state === "thinking" ? "thinking" : "listening"}
                mic={mic}
                text={text}
                notice={notice}
                canRetry={canRetry}
                onText={setText}
                onSend={() => void onSend()}
                onCancel={onCancelDoubt}
                onRetry={() => void askDoubt(questionRef.current, tokenRef.current)}
              />
            ) : (
              <button
                type="button"
                data-testid="ask-button"
                disabled={state !== "speaking" && state !== "answering"}
                onClick={onAsk}
                className="nb-btn nb-btn-accent w-full text-lg"
              >
                <Icon name="mic" /> Ask a doubt
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
