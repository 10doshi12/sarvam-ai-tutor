"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, LEVELS, LIMITS } from "@/lib/config";
import type { LanguageCode, Level } from "@/lib/types";
import { prepareLesson } from "@/lib/client/prepare";

const field = "w-full rounded-md border border-ink/25 bg-white px-3 py-2 text-base";

export default function UploadForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<Level>("school");
  const [language, setLanguage] = useState<LanguageCode>("en-IN");
  const [textbookLanguage, setTextbookLanguage] = useState<LanguageCode>("en-IN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Choose at least one PDF first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await prepareLesson(files, { level, language, textbookLanguage });
      router.push(`/lessons/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  // Picks add to the list, so files can be chosen one at a time or from different folders.
  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles((current) => [
      ...current,
      ...picked.filter((p) => !current.some((c) => c.name === p.name && c.size === p.size)),
    ]);
    e.target.value = "";
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-ink/15 bg-white/60 p-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Textbook PDFs (up to {LIMITS.maxPdfFiles} files, {LIMITS.maxPdfPages} pages each)
        </span>
        <input
          data-testid="upload-file"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className={field}
          onChange={addFiles}
        />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}:${f.size}`} data-testid="upload-file-item" className="flex items-center justify-between gap-3">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((current) => current.filter((_, at) => at !== i))}
                className="shrink-0 text-accent underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Level</span>
          <select data-testid="upload-level" className={field} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Lesson language</span>
          <select
            data-testid="upload-language"
            className={field}
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Textbook language</span>
          <select
            data-testid="upload-textbook-language"
            className={field}
            value={textbookLanguage}
            onChange={(e) => setTextbookLanguage(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      <button
        data-testid="upload-submit"
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {busy ? "Checking your PDFs..." : "Make my lesson"}
      </button>
    </form>
  );
}
