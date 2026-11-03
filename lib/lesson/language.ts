import { LIMITS } from "@/lib/config";
import type { LanguageCode } from "@/lib/types";

// English is left out because its lessons may freely use any script for quoted terms.
const SCRIPTS: Partial<Record<LanguageCode, RegExp>> = {
  "hi-IN": /\p{Script=Devanagari}/u,
  "mr-IN": /\p{Script=Devanagari}/u,
  "bn-IN": /\p{Script=Bengali}/u,
  "gu-IN": /\p{Script=Gujarati}/u,
  "kn-IN": /\p{Script=Kannada}/u,
  "pa-IN": /\p{Script=Gurmukhi}/u,
  "ta-IN": /\p{Script=Tamil}/u,
  "te-IN": /\p{Script=Telugu}/u,
};

// Models can drift into the textbook's language, so replies are checked rather than trusted.
export function languageProblem(language: LanguageCode, texts: string[]): string | null {
  const script = SCRIPTS[language];
  if (!script) return null;
  const letters = [...texts.join(" ")].filter((c) => /[\p{L}\p{M}]/u.test(c));
  if (!letters.length) return null;
  const share = letters.filter((c) => script.test(c)).length / letters.length;
  if (share >= LIMITS.minLessonScriptShare) return null;
  return "Most of it was not in the requested language and script. Write all of it in that language, keeping only code and essential technical terms in English.";
}
