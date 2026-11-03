import { LIMITS, MODELS } from "@/lib/config";
import type { LanguageCode, Level, Topic, TopicScript } from "@/lib/types";
import { scriptPrompts } from "./prompts";
import { chatValidated, normalizeScript, scriptSchema } from "./schemas";

export async function writeTopicScript(a: {
  source: string;
  level: Level;
  language: LanguageCode;
  topic: Topic;
  topics: Topic[];
}): Promise<TopicScript> {
  const { system, user } = scriptPrompts(a);
  return chatValidated(
    { model: MODELS.chat, system, user, schemaName: "topic_script", schema: scriptSchema, maxTokens: LIMITS.scriptMaxTokens },
    (raw) => normalizeScript(raw, a.topic.id),
  );
}
