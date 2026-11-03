"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TIMING } from "@/lib/config";
import type { Lesson } from "@/lib/types";
import { getLesson, saveLesson } from "@/lib/client/storage";
import { isPreparing } from "@/lib/client/prepare";
import Avatar from "@/components/player/Avatar";
import LessonPlayer from "@/components/player/LessonPlayer";
import Icon from "@/components/ui/Icon";

const STALE_MESSAGE = "Preparation was interrupted. Please upload the PDF again.";

function load(id: string): Lesson | null {
  const lesson = getLesson(id);
  if (lesson && (lesson.status === "reading" || lesson.status === "planning") && !isPreparing(id)) {
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

const STAGES = ["reading", "planning"] as const;

const STATUS_TEXT: Record<string, string> = {
  reading: "Reading your PDFs. This can take a minute.",
  planning: "Planning the topics.",
};

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

  if (lesson.status !== "ready") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
        <div className="nb-card aspect-[16/10] overflow-hidden bg-accent">
          <Avatar speaking={false} mood="thinking" tutor={lesson.tutor} />
        </div>
        <div className="space-y-2">
          <h1 className="truncate text-2xl font-bold tracking-tight" title={lesson.title}>
            {lesson.title}
          </h1>
          <p data-testid="lesson-status" aria-live="polite" className="text-muted">
            {STATUS_TEXT[lesson.status]}
          </p>
        </div>
        <ol className="flex gap-2" aria-hidden="true">
          {STAGES.map((stage, i) => {
            const at = STAGES.indexOf(lesson.status as (typeof STAGES)[number]);
            return (
              <li
                key={stage}
                className={`h-3 flex-1 rounded-sm border-2 border-ink ${i < at ? "bg-ink" : i === at ? "nb-pulse bg-accent" : "bg-surface"}`}
              />
            );
          })}
        </ol>
      </main>
    );
  }

  return <LessonPlayer lesson={lesson} />;
}
