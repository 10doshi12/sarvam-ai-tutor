import { SarvamError, sarvamErrorResponse, transcribe } from "@/lib/sarvam";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) throw new SarvamError(400, "Missing audio.");
    let keyterms: string[] | undefined;
    const raw = form.get("keyterms");
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) keyterms = parsed.filter((t): t is string => typeof t === "string");
      } catch {
        // Bad keyterms only cost accuracy, so transcribe without them.
      }
    }
    return Response.json(await transcribe(audio, audio.name || "doubt.webm", keyterms));
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
