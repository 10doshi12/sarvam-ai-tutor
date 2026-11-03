import type { Lesson, LanguageCode, Level, Topic, TopicScript, TutorId } from "@/lib/types";
import { LIMITS, TIMING } from "@/lib/config";
import { getLesson, saveLesson, saveSource } from "./storage";
import { joinDocuments } from "@/lib/lesson/source";
import { speechBytes } from "./audio";
import { cached, pruneCache } from "./cache";
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
    const text = await cached("doc", [await file.arrayBuffer(), language], async () =>
      readMarkdown(await startJob(file, language)),
    );
    return { name: file.name, text };
  } catch (e) {
    throw new Error(`${file.name}: ${e instanceof Error ? e.message : "could not be read."}`);
  }
}

async function planLesson(source: string, opts: PrepareOptions, filename: string): Promise<{ title: string; topics: Topic[] }> {
  return cached("plan", [source, opts.level, opts.language, filename], async () => {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, level: opts.level, language: opts.language, filename }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not plan the lesson."));
    return (await res.json()) as { title: string; topics: Topic[] };
  });
}

async function inPool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Runs one phase's items, saving progress for the screen after each one.
async function runPhase<T>(id: string, items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let done = 0;
  update(id, { progress: { done, total: items.length } });
  await inPool(items, limit, async (item) => {
    await work(item);
    update(id, { progress: { done: ++done, total: items.length } });
  });
}

// The last two phases are best effort: the player fetches anything missing when it is needed.
async function writeAndVoice(id: string, lesson: Lesson, opts: PrepareOptions): Promise<void> {
  const scripts = new Map<string, TopicScript>();
  update(id, { status: "writing" });
  await runPhase(id, lesson.topics, TIMING.maxConcurrentScripts, async (topic) => {
    const script = await getTopicScript(lesson, topic).catch(() => null);
    if (script) scripts.set(topic.id, script);
  });

  const lines = lesson.topics.flatMap((t) => {
    const script = scripts.get(t.id);
    return script ? [...script.steps.map((s) => s.say), script.quiz.explanation] : [];
  });
  update(id, { status: "voicing" });
  await runPhase(id, [...new Set(lines)], TIMING.maxConcurrentVoicing, async (line) => {
    await speechBytes(line, { language: opts.language, tutor: opts.tutor }).catch(() => undefined);
  });
}

async function run(id: string, files: File[], opts: PrepareOptions): Promise<void> {
  try {
    const docs: { name: string; text: string }[] = [];
    await runPhase(id, files, files.length, async (file) => {
      docs[files.indexOf(file)] = await readDocument(file, opts.textbookLanguage);
    });
    const source = joinDocuments(docs, LIMITS.maxSourceChars);
    saveSource(id, source);
    const lesson = update(id, { status: "planning", progress: undefined });

    const plan = await planLesson(source, opts, lesson.filename);
    const planned = update(id, { title: plan.title, topics: plan.topics, error: undefined });
    await writeAndVoice(id, planned, opts);
    update(id, { status: "ready", progress: undefined });
    void pruneCache();
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
