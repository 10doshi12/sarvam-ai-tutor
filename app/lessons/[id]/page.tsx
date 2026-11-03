"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TIMING } from "@/lib/config";
import type { Lesson } from "@/lib/types";
import { getLesson, saveLesson } from "@/lib/client/storage";
import { isPreparing } from "@/lib/client/prepare";
import LessonPlayer from "@/components/player/LessonPlayer";

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
      <main className="mx-auto max-w-xl space-y-3 px-4 py-16">
        <h1 className="text-2xl font-bold">Lesson not found</h1>
        <p>Lessons are kept only in the browser that made them. Upload the PDF again to start a new one.</p>
        <Link href="/" className="text-accent underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (lesson.status === "failed") {
    return (
      <main className="mx-auto max-w-xl space-y-3 px-4 py-16">
        <h1 className="text-2xl font-bold">This lesson could not be prepared</h1>
        <p data-testid="lesson-error" role="alert">
          {lesson.error ?? "Something went wrong."}
        </p>
        <Link href="/" className="text-accent underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (lesson.status !== "ready") {
    return (
      <main className="mx-auto max-w-xl space-y-3 px-4 py-16">
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <p data-testid="lesson-status" aria-live="polite">
          {STATUS_TEXT[lesson.status]}
        </p>
      </main>
    );
  }

  return <LessonPlayer lesson={lesson} />;
}
