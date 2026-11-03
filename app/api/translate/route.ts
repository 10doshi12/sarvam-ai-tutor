import { SarvamError, sarvamErrorResponse, translate } from "@/lib/sarvam";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; target?: unknown } | null;
    if (typeof body?.text !== "string" || typeof body.target !== "string" || !body.text.trim() || !body.target) {
      throw new SarvamError(400, "Send text and a target language.");
    }
    return Response.json({ text: await translate(body.text, "auto", body.target, "caption") });
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
