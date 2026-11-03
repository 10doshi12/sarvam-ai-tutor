"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TIMING } from "@/lib/config";
import type { Lesson, LessonStatus } from "@/lib/types";
import { getLesson, saveLesson } from "@/lib/client/storage";
import { isPreparing } from "@/lib/client/prepare";
import Avatar from "@/components/player/Avatar";
import LessonPlayer from "@/components/player/LessonPlayer";
import Icon from "@/components/ui/Icon";

const STALE_MESSAGE = "Preparation was interrupted. Upload the same PDF again and it will go faster, because the finished work was saved.";

const isPreparingStatus = (status: LessonStatus) => status !== "ready" && status !== "failed";

function load(id: string): Lesson | null {
  const lesson = getLesson(id);
  if (lesson && isPreparingStatus(lesson.status) && !isPreparing(id)) {
    const failed: Lesson = { ...lesson, status: "failed", error: STALE_MESSAGE };
    try {
      saveLesson(failed);
    } catch {
      // Show the failure even if it cannot be saved.
    }
    return failed;
  }
  return lesson;
}

const STAGES: { status: LessonStatus; label: string }[] = [
  { status: "reading", label: "Reading your PDFs" },
  { status: "planning", label: "Planning the topics" },
  { status: "writing", label: "Writing each topic" },
  { status: "voicing", label: "Recording your tutor's voice" },
];

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [mounted, setMounted] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    const first = setTimeout(() => {
      setMounted(true);
      setLesson(load(id));
    });
    const timer = setInterval(() => {
      setLesson((prev) => (prev?.status === "ready" || prev?.status === "failed" ? prev : load(id)));
    }, TIMING.lessonPollMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [id]);

  // Preparation runs in this tab, so closing it stops the work.
  const preparing = lesson !== null && isPreparingStatus(lesson.status);
  useEffect(() => {
    if (!preparing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [preparing]);

  if (!mounted) return <main className="p-10" aria-busy="true" />;

  if (!lesson) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Lesson not found</h1>
        <p>Lessons are kept only in the browser that made them. Upload the PDF again to start a new one.</p>
        <Link href="/" className="nb-btn nb-btn-ghost">
          <Icon name="back" /> Back to home
        </Link>
      </main>
    );
  }

  if (lesson.status === "failed") {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight">This lesson could not be prepared</h1>
        <p data-testid="lesson-error" role="alert" className="rounded-lg border-2 border-danger bg-danger-soft px-3 py-2 font-medium text-danger">
          {lesson.error ?? "Something went wrong."}
        </p>
        <Link href="/" className="nb-btn nb-btn-ghost">
          <Icon name="back" /> Back to home
        </Link>
      </main>
    );
  }

  if (preparing) {
    const at = STAGES.findIndex((stage) => stage.status === lesson.status);
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-6">
        <div className="nb-card h-40 overflow-hidden bg-accent">
          <Avatar speaking={false} mood="thinking" tutor={lesson.tutor} />
        </div>
        <div>
          <h1 className="truncate text-2xl font-bold tracking-tight" title={lesson.title}>
            {lesson.title}
          </h1>
          <p data-testid="lesson-status" aria-live="polite" className="text-muted">
            Step {at + 1} of {STAGES.length}: {STAGES[at].label}
          </p>
        </div>
        <ol className="space-y-2">
          {STAGES.map((stage, i) => {
            const state = i < at ? "done" : i === at ? "current" : "waiting";
            return (
              <li
                key={stage.status}
                data-testid={`prep-${stage.status}`}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-lg border-2 border-ink px-3 py-1.5 font-bold ${state === "current" ? "bg-accent" : state === "done" ? "bg-surface" : "bg-surface text-muted"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink text-xs ${state === "done" ? "bg-ink text-surface" : state === "current" ? "nb-pulse bg-surface" : ""}`}
                >
                  {state === "done" ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">{stage.label}</span>
                {state === "current" && lesson.progress && (
                  <span className="shrink-0 text-sm tabular-nums">
                    {lesson.progress.done} of {lesson.progress.total}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted">
          Please keep this tab open. The whole lesson is being prepared now so it plays without waiting. If you leave, finished work is saved and starting again is faster.
        </p>
      </main>
    );
  }

  return <LessonPlayer lesson={lesson} />;
}
