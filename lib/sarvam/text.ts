import "server-only";
import { LIMITS, MODELS } from "@/lib/config";
import { SarvamError } from "./errors";
import { postJson } from "./http";

// Doubts use the formal model; live captions use the colloquial one.
export async function translate(
  text: string,
  source: string,
  target: string,
  purpose: "doubt" | "caption",
): Promise<string> {
  const doubt = purpose === "doubt";
  const limit = doubt ? LIMITS.doubtTranslateChars : LIMITS.captionTranslateChars;
  if (text.length > limit) throw new SarvamError(400, `Text is longer than ${limit} characters.`);
  const r = await postJson<{ translated_text?: string }>("/translate", {
    input: text,
    source_language_code: source,
    target_language_code: target,
    model: doubt ? MODELS.doubtTranslate : MODELS.captionTranslate,
    mode: doubt ? "formal" : "modern-colloquial",
  });
  if (!r.translated_text) throw new SarvamError(502, "Sarvam returned no translation.");
  return r.translated_text;
}

export async function detectLanguage(text: string): Promise<string> {
  const r = await postJson<{ language_code?: string }>("/text-lid", { input: text.slice(0, 1000) });
  if (!r.language_code) throw new SarvamError(502, "Sarvam could not detect the language.");
  return r.language_code;
}
