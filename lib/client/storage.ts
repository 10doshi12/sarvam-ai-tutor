import type { Lesson, TopicScript } from "@/lib/types";

// Browser-only persistence. Every call is safe if localStorage throws or is missing.
const LESSONS_KEY = "sc:lessons";
const sourceKey = (id: string) => `sc:source:${id}`;
const scriptKey = (id: string, topicId: string) => `sc:script:${id}:${topicId}`;

export class StorageFullError extends Error {
  constructor() {
    super("Browser storage is full. Delete an old lesson and try again.");
    this.name = "StorageFullError";
  }
}

function isQuota(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014)
  );
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (isQuota(e)) throw new StorageFullError();
    throw new Error("This browser is not letting the app save lessons.");
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listLessons(): Lesson[] {
  const data = readJson<Lesson[]>(LESSONS_KEY);
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLesson(id: string): Lesson | null {
  return listLessons().find((l) => l.id === id) ?? null;
}

export function saveLesson(lesson: Lesson): void {
  const all = listLessons().filter((l) => l.id !== lesson.id);
  write(LESSONS_KEY, JSON.stringify([lesson, ...all]));
}

export function deleteLesson(id: string): void {
  const lesson = getLesson(id);
  try {
    write(LESSONS_KEY, JSON.stringify(listLessons().filter((l) => l.id !== id)));
  } catch {
    return;
  }
  remove(sourceKey(id));
  for (const t of lesson?.topics ?? []) remove(scriptKey(id, t.id));
}

export function getSource(id: string): string | null {
  return read(sourceKey(id));
}

export function saveSource(id: string, text: string): void {
  write(sourceKey(id), text);
}

export function getScript(id: string, topicId: string): TopicScript | null {
  return readJson<TopicScript>(scriptKey(id, topicId));
}

export function saveScript(id: string, script: TopicScript): void {
  write(scriptKey(id, script.topicId), JSON.stringify(script));
}
