import "server-only";
import { SarvamError } from "./errors";
import { postJson } from "./http";

type ChatResponse = { choices?: { message?: { content?: string | null } }[] };

// Models sometimes wrap JSON in a code fence even under json_schema.
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// Chat call that returns parsed JSON. Retries once with the parse error appended.
export async function chatJson<T>(args: {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: object;
  maxTokens: number;
}): Promise<T> {
  let user = args.user;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await postJson<ChatResponse>("/v1/chat/completions", {
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: user },
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
      lastError = (err as Error).message;
      user = `${args.user}\n\nYour previous reply could not be parsed (${lastError}). Reply again with only valid JSON.`;
    }
  }
  throw new SarvamError(502, `Sarvam returned an unreadable reply (${lastError}). Please try again.`);
}
