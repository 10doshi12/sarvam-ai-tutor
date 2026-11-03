import { DEFAULT_TUTOR, TUTORS } from "@/lib/config";
import type { TutorId } from "@/lib/types";
import { parseLanguage, SarvamError, sarvamErrorResponse, synthesize } from "@/lib/sarvam";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; language?: unknown; tutor?: unknown } | null;
    const language = parseLanguage(body?.language);
    if (typeof body?.text !== "string" || !body.text.trim()) throw new SarvamError(400, "Missing text.");
    const tutor = TUTORS.some((t) => t.id === body.tutor) ? (body.tutor as TutorId) : DEFAULT_TUTOR;
    const audio = await synthesize(body.text, language, tutor);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
