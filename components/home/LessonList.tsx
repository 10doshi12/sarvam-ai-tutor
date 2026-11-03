"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LANGUAGES, LEVELS } from "@/lib/config";
import type { Lesson } from "@/lib/types";
import { deleteLesson, listLessons } from "@/lib/client/storage";
import Icon from "@/components/ui/Icon";

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
    <section className="space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">Your lessons</h2>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l) => {
          const done = l.topics.filter((t) => t.done).length;
          return (
            <li key={l.id} data-testid="lesson-item" className="nb-card relative flex">
              <Link href={`/lessons/${l.id}`} className="flex min-w-0 flex-1 flex-col rounded-[10px] p-4 pr-14 hover:bg-accent/40">
                <span className="block truncate font-bold" title={l.title}>
                  {l.title}
                </span>
                <span className="block text-sm text-muted">
                  {LANGUAGES.find((x) => x.code === l.language)?.name} · {LEVELS.find((x) => x.value === l.level)?.name}
                </span>
                {l.topics.length > 0 && (
                  <span className="mt-auto flex gap-1 pt-4 -mr-10" aria-hidden="true">
                    {l.topics.map((t, i) => (
                      <span key={t.id} className={`h-2 flex-1 rounded-sm border border-ink ${i < done || t.done ? "bg-ink" : "bg-surface"}`} />
                    ))}
                  </span>
                )}
                <span className="mt-2 block text-sm font-medium">{progress(l)}</span>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${l.title}`}
                className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-lg hover:bg-danger-soft"
                onClick={() => {
                  deleteLesson(l.id);
                  setLessons(listLessons());
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
