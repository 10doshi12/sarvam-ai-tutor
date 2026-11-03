import "server-only";
import { postJson } from "./http";

type ChatResponse = { choices?: { message?: { content?: string | null } }[] };

// Models sometimes wrap JSON in a code fence even under json_schema.
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// One chat call that returns parsed JSON. The caller decides whether to try again.
export async function chatJson<T>(args: {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: object;
  maxTokens: number;
}): Promise<T> {
  const res = await postJson<ChatResponse>("/v1/chat/completions", {
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    max_tokens: args.maxTokens,
    reasoning_effort: null,
    response_format: {
      type: "json_schema",
      json_schema: { name: args.schemaName, schema: args.schema },
    },
  });
  const content = res.choices?.[0]?.message?.content;
  try {
    if (!content) throw new Error("the reply was empty");
    return JSON.parse(stripFences(content)) as T;
  } catch (err) {
    throw new Error(`Sarvam returned an unreadable reply (${(err as Error).message}). Please try again.`);
  }
}
