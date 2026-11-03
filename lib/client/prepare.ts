import type { Lesson, LanguageCode, Level, Topic, TutorId } from "@/lib/types";
import { LIMITS, TIMING } from "@/lib/config";
import { getLesson, saveLesson, saveSource } from "./storage";
import { joinDocuments } from "@/lib/lesson/source";
import { getTopicScript } from "./scripts";

export interface PrepareOptions {
  level: Level;
  language: LanguageCode;
  textbookLanguage: LanguageCode;
  tutor: TutorId;
}

// Lessons being prepared in this tab. Lives at module level so it survives page navigation.
const running = new Set<string>();

export function isPreparing(id: string): boolean {
  return running.has(id);
}

async function validatePdf(file: File): Promise<void> {
  if (file.size > LIMITS.maxPdfBytes) {
    throw new Error(`${file.name} is larger than ${LIMITS.maxPdfBytes / (1024 * 1024)} MB. Please upload a smaller file.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== "%PDF-") throw new Error(`${file.name} is not a PDF. Please choose PDF files only.`);
  const { PDFDocument } = await import("pdf-lib");
  let pages: number;
  try {
    pages = (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new Error(`${file.name} could not be opened. It may be damaged or password protected.`);
  }
  if (pages > LIMITS.maxPdfPages) {
    throw new Error(`${file.name} has ${pages} pages. Each PDF can have ${LIMITS.maxPdfPages} pages or fewer.`);
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? fallback;
}

async function startJob(file: File, language: LanguageCode): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  const res = await fetch("/api/doc/start", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res, "Could not start reading the PDF."));
  return ((await res.json()) as { jobId: string }).jobId;
}

async function readMarkdown(jobId: string): Promise<string> {
  const deadline = Date.now() + TIMING.docPollTimeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/doc/${jobId}`);
    if (!res.ok) throw new Error(await readError(res, "Could not check on the PDF."));
    const job = (await res.json()) as { status: "running" | "done" | "failed"; markdown?: string; error?: string };
    if (job.status === "failed") throw new Error(job.error ?? "The book could not be read.");
    if (job.status === "done") {
      if (!job.markdown?.trim()) throw new Error("No text could be found in this PDF.");
      return job.markdown;
    }
    await new Promise((r) => setTimeout(r, TIMING.docPollMs));
  }
  throw new Error("Reading the book took too long. Please try again.");
}

function update(id: string, patch: Partial<Lesson>): Lesson {
  const current = getLesson(id);
  if (!current) throw new Error("This lesson was deleted.");
  const next = { ...current, ...patch };
  saveLesson(next);
  return next;
}

async function readDocument(file: File, language: LanguageCode): Promise<{ name: string; text: string }> {
  try {
    return { name: file.name, text: await readMarkdown(await startJob(file, language)) };
  } catch (e) {
    throw new Error(`${file.name}: ${e instanceof Error ? e.message : "could not be read."}`);
  }
}

async function run(id: string, files: File[], opts: PrepareOptions): Promise<void> {
  try {
    const docs = await Promise.all(files.map((f) => readDocument(f, opts.textbookLanguage)));
    const source = joinDocuments(docs, LIMITS.maxSourceChars);
    saveSource(id, source);
    const lesson = update(id, { status: "planning" });

    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, level: opts.level, language: opts.language, filename: lesson.filename }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not plan the lesson."));
    const plan = (await res.json()) as { title: string; topics: Topic[] };
    const ready = update(id, { status: "ready", title: plan.title, topics: plan.topics, error: undefined });
    if (ready.topics[0]) getTopicScript(ready, ready.topics[0]).catch(() => {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    try {
      update(id, { status: "failed", error: message });
    } catch {
      // The lesson was deleted or storage is unavailable, so there is nothing to mark.
    }
  } finally {
    running.delete(id);
  }
}

export async function prepareLesson(files: File[], opts: PrepareOptions): Promise<string> {
  if (files.length > LIMITS.maxPdfFiles) throw new Error(`Please choose ${LIMITS.maxPdfFiles} PDFs or fewer.`);
  for (const file of files) await validatePdf(file);
  const first = files[0].name.replace(/\.pdf$/i, "");
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  saveLesson({
    id,
    title: files.length > 1 ? `${first} + ${files.length - 1} more` : first,
    filename: files.map((f) => f.name).join(", "),
    level: opts.level,
    language: opts.language,
    tutor: opts.tutor,
    status: "reading",
    createdAt: new Date().toISOString(),
    topics: [],
  });
  running.add(id);
  void run(id, files, opts);
  return id;
}
