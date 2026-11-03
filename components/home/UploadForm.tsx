"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, LEVELS, LIMITS, TUTORS } from "@/lib/config";
import type { LanguageCode, Level, TutorId } from "@/lib/types";
import { prepareLesson } from "@/lib/client/prepare";
import Avatar from "@/components/player/Avatar";
import Icon from "@/components/ui/Icon";

const sizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function UploadForm({ tutor, onTutor }: { tutor: TutorId; onTutor: (t: TutorId) => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
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
      const id = await prepareLesson(files, { level, language, textbookLanguage, tutor });
      router.push(`/lessons/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  // Picks add to the list, so files can be chosen one at a time or from different folders.
  function addFiles(picked: File[]) {
    setError(null);
    setFiles((current) => [
      ...current,
      ...picked.filter((p) => !current.some((c) => c.name === p.name && c.size === p.size)),
    ]);
  }

  return (
    <form onSubmit={submit} className="nb-card flex flex-col gap-3 p-4 lg:col-span-3">
      <label
        data-drop
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink px-4 py-3 text-center transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink ${dragging ? "bg-accent" : "hover:bg-accent/40"}`}
      >
        <Icon name="upload" size={22} />
        <span className="font-bold">Drop your PDFs here, or click to choose</span>
        <span className="text-sm text-muted">
          Up to {LIMITS.maxPdfFiles} files, {LIMITS.maxPdfPages} pages and {LIMITS.maxPdfBytes / (1024 * 1024)} MB each
        </span>
        <input
          data-testid="upload-file"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="max-h-28 space-y-2 overflow-y-auto">
          {files.map((f, i) => (
            <li key={`${f.name}:${f.size}`} data-testid="upload-file-item" className="flex items-center gap-3 rounded-lg border-2 border-ink bg-paper py-1 pr-1 pl-3 text-sm">
              <Icon name="file" size={18} />
              <span className="min-w-0 flex-1 truncate font-medium" title={f.name}>
                {f.name}
              </span>
              <span className="shrink-0 text-muted">{sizeLabel(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((current) => current.filter((_, at) => at !== i))}
                className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-danger-soft"
              >
                <Icon name="x" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend className="nb-label mb-1">Your tutor</legend>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {TUTORS.map((t) => (
            <label
              key={t.id}
              className={`cursor-pointer overflow-hidden rounded-lg border-2 border-ink text-center text-sm font-bold transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink ${tutor === t.id ? "bg-accent" : "bg-surface hover:bg-accent/40"}`}
            >
              <input
                data-testid={`upload-tutor-${t.id}`}
                type="radio"
                name="tutor"
                value={t.id}
                checked={tutor === t.id}
                onChange={() => onTutor(t.id)}
                className="sr-only"
              />
              <span className="block h-20">
                <Avatar speaking={false} mood={tutor === t.id ? "happy" : "neutral"} tutor={t.id} />
              </span>
              <span className="block border-t-2 border-ink py-0.5">{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="nb-label">Level</span>
          <select data-testid="upload-level" className="nb-field" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="nb-label">Teach me in</span>
          <select data-testid="upload-language" className="nb-field" value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="nb-label">Book is in</span>
          <select
            data-testid="upload-textbook-language"
            className="nb-field"
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
        <p role="alert" className="rounded-lg border-2 border-danger bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button data-testid="upload-submit" type="submit" disabled={busy} className="nb-btn nb-btn-primary w-full">
        {busy ? (
          "Checking your PDFs..."
        ) : (
          <>
            Make my lesson <Icon name="arrow" />
          </>
        )}
      </button>
    </form>
  );
}
