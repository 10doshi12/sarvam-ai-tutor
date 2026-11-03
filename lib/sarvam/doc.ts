import "server-only";
import JSZip from "jszip";
import { TIMING } from "@/lib/config";
import type { LanguageCode } from "@/lib/types";
import { SarvamError } from "./errors";
import { namedTimeout, sarvamJson } from "./http";

type StatusResponse = { status: string; usage?: { pages_processed?: number; pages_total?: number } };
type DownloadResponse = { method: string; url: string; headers?: Record<string, string> };

export async function startDigitise(file: Blob, filename: string, language: LanguageCode): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("language", language);
  form.append("output_format", "md");
  const r = await sarvamJson<{ job_id: string }>("/doc-ai/v1/job/digitise", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(TIMING.docUploadMs),
  });
  return r.job_id;
}

// The output ZIP holds the markdown beside per-page metadata and a manifest.
async function readMarkdown(jobId: string): Promise<string> {
  const dl = await sarvamJson<DownloadResponse>(`/doc-ai/v1/job/${encodeURIComponent(jobId)}/download-url`);
  const bytes = await fetch(dl.url, { method: dl.method, headers: dl.headers, signal: AbortSignal.timeout(TIMING.sarvamCallMs) })
    .then((res) => {
      if (!res.ok) throw new SarvamError(502, "Could not download the read result from Sarvam.");
      return res.arrayBuffer();
    })
    .catch((e) => {
      throw namedTimeout(e);
    });
  const zip = await JSZip.loadAsync(bytes);
  const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".md"));
  if (!entry) throw new SarvamError(502, "Sarvam returned no text for this PDF.");
  return entry.async("string");
}

export async function getDigitiseResult(jobId: string): Promise<{
  status: "running" | "done" | "failed";
  pagesProcessed: number;
  pagesTotal: number;
  markdown?: string;
  error?: string;
}> {
  const s = await sarvamJson<StatusResponse>(`/doc-ai/v1/job/${encodeURIComponent(jobId)}/status`);
  const pagesProcessed = s.usage?.pages_processed ?? 0;
  const pagesTotal = s.usage?.pages_total ?? 0;
  if (s.status === "completed" || s.status === "partially_completed") {
    return { status: "done", pagesProcessed, pagesTotal, markdown: await readMarkdown(jobId) };
  }
  if (s.status === "failed" || s.status === "rejected") {
    return { status: "failed", pagesProcessed, pagesTotal, error: "Sarvam could not read this PDF." };
  }
  return { status: "running", pagesProcessed, pagesTotal };
}
