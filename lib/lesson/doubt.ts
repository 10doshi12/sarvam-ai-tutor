import { LIMITS, MODELS } from "@/lib/config";
import { detectLanguage, translate } from "@/lib/sarvam";
import type { DoubtAnswer, LanguageCode, Level, Topic } from "@/lib/types";
import { doubtPrompts } from "./prompts";
import { shareSource } from "./source";
import { chatValidated, doubtSchema, normalizeDoubt } from "./schemas";

export async function answerDoubt(a: {
  source: string;
  level: Level;
  language: LanguageCode;
  topic: Topic;
  currentSay: string;
  question: string;
}): Promise<DoubtAnswer> {
  const raw = a.question.trim().slice(0, LIMITS.doubtTranslateChars);
  // Falls back to the lesson language so a failed detection does not block the answer.
  const heard = await detectLanguage(raw).catch(() => a.language);
  const question = heard === a.language ? raw : await translate(raw, heard, a.language, "doubt");
  const { system, user } = doubtPrompts({
    ...a,
    source: shareSource(a.source, LIMITS.doubtSourceChars),
    question,
  });
  const out = await chatValidated(
    { model: MODELS.doubt, system, user, schemaName: "doubt_answer", schema: doubtSchema, maxTokens: LIMITS.doubtMaxTokens },
    (r) => normalizeDoubt(r, question),
  );
  return { ...out, heardLanguage: heard };
}
