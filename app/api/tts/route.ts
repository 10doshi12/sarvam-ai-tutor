import { parseLanguage, SarvamError, sarvamErrorResponse, synthesize } from "@/lib/sarvam";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; language?: unknown } | null;
    const language = parseLanguage(body?.language);
    if (typeof body?.text !== "string" || !body.text.trim()) throw new SarvamError(400, "Missing text.");
    const audio = await synthesize(body.text, language);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
