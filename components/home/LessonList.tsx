"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/config";
import type { Lesson } from "@/lib/types";
import { deleteLesson, listLessons } from "@/lib/client/storage";

function progress(l: Lesson): string {
  if (l.status === "failed") return "Could not be prepared";
  if (l.status !== "ready") return "Preparing";
  const done = l.topics.filter((t) => t.done).length;
  return `${done} of ${l.topics.length} topics done`;
}

export default function LessonList() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLessons(listLessons()));
    return () => clearTimeout(timer);
  }, []);

  if (!lessons || lessons.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Your lessons</h2>
      <ul className="space-y-2">
        {lessons.map((l) => (
          <li
            key={l.id}
            data-testid="lesson-item"
            className="flex items-center justify-between gap-3 rounded-md border border-ink/15 bg-white/60 px-4 py-3"
          >
            <Link href={`/lessons/${l.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.title}</span>
              <span className="block text-sm text-ink/70">
                {LANGUAGES.find((x) => x.code === l.language)?.name} · {l.level} · {progress(l)}
              </span>
            </Link>
            <button
              type="button"
              aria-label={`Delete ${l.title}`}
              className="text-sm text-accent underline"
              onClick={() => {
                deleteLesson(l.id);
                setLessons(listLessons());
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
