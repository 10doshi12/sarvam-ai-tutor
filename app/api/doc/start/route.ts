import { LIMITS } from "@/lib/config";
import { parseLanguage, SarvamError, sarvamErrorResponse, startDigitise } from "@/lib/sarvam";

export const maxDuration = 60;

const PDF_MAGIC = "%PDF";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const language = parseLanguage(form.get("language"));
    if (!(file instanceof File)) throw new SarvamError(400, "Attach a PDF file.");
    if (file.size > LIMITS.maxPdfBytes) throw new SarvamError(413, "This PDF is too large.");
    const head = await file.slice(0, PDF_MAGIC.length).text();
    if (head !== PDF_MAGIC) throw new SarvamError(400, "That file is not a PDF.");
    return Response.json({ jobId: await startDigitise(file, file.name, language) });
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
