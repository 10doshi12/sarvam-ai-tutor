import { LIMITS, MODELS } from "@/lib/config";
import type { LanguageCode, Level, Topic } from "@/lib/types";
import { planPrompts } from "./prompts";
import { chatValidated, normalizePlan, planSchema } from "./schemas";

export async function planLesson(a: {
  source: string;
  level: Level;
  language: LanguageCode;
  filename: string;
}): Promise<{ title: string; topics: Topic[] }> {
  const { system, user } = planPrompts(a);
  return chatValidated(
    { model: MODELS.chat, system, user, schemaName: "lesson_plan", schema: planSchema, maxTokens: LIMITS.planMaxTokens },
    (raw) => normalizePlan(raw, a.filename.replace(/\.pdf$/i, "")),
  );
}
