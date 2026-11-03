import { sarvamErrorResponse } from "@/lib/sarvam";
import { planLesson } from "@/lib/lesson/plan";
import { readLessonBody } from "@/lib/lesson/schemas";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const r = await readLessonBody(req);
    if (r instanceof Response) return r;
    const filename = typeof r.body.filename === "string" && r.body.filename ? r.body.filename : "lesson.pdf";
    return Response.json(await planLesson({ source: r.source, level: r.level, language: r.language, filename }));
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
