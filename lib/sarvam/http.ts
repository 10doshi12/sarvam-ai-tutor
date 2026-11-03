import "server-only";
import { LANGUAGES, SARVAM_BASE_URL, TIMING } from "@/lib/config";
import type { LanguageCode } from "@/lib/types";
import { SarvamError, SARVAM_TIMEOUT } from "./errors";

const MISSING_KEY =
  "SARVAM_API_KEY is not set. Add it to .env for local runs, or to the Vercel project settings.";

export function hasApiKey(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}

const isTimeout = (e: unknown) => ["TimeoutError", "AbortError"].includes((e as { name?: string }).name ?? "");
const tooSlow = () => new SarvamError(SARVAM_TIMEOUT, "Sarvam took too long to answer. Please try again.");

// Error bodies come as {error:{message}}, {detail} or {message} depending on the API.
function errorText(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const inner = b.error && typeof b.error === "object" ? (b.error as Record<string, unknown>).message : b.error;
    for (const v of [inner, b.detail, b.message]) if (typeof v === "string" && v) return v;
  }
  return fallback;
}

// Calls a Sarvam path with the API key; throws SarvamError on network or HTTP failure.
export async function sarvamFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new SarvamError(500, MISSING_KEY);
  let res: Response;
  try {
    res = await fetch(`${SARVAM_BASE_URL}${path}`, {
      signal: AbortSignal.timeout(TIMING.sarvamCallMs),
      ...init,
      headers: { ...(init.headers as Record<string, string>), "api-subscription-key": key },
    });
  } catch (e) {
    if (isTimeout(e)) throw tooSlow();
    throw new SarvamError(502, "Could not reach Sarvam. Check the network and try again.");
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new SarvamError(res.status, errorText(body, `Sarvam returned HTTP ${res.status}.`));
  }
  return res;
}

export async function sarvamJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  // The time limit also covers reading the body, which can stall after the headers arrive.
  try {
    return (await (await sarvamFetch(path, init)).json()) as T;
  } catch (e) {
    throw isTimeout(e) ? tooSlow() : e;
  }
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return sarvamJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function parseLanguage(value: unknown): LanguageCode {
  const found = LANGUAGES.find((l) => l.code === value);
  if (!found) throw new SarvamError(400, "Unsupported lesson language.");
  return found.code;
}
