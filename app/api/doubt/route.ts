import { sarvamErrorResponse } from "@/lib/sarvam";
import { answerDoubt } from "@/lib/lesson/doubt";
import { asTopic, readLessonBody } from "@/lib/lesson/schemas";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const r = await readLessonBody(req);
    if (r instanceof Response) return r;
    const topic = asTopic(r.body.topic);
    const question = typeof r.body.question === "string" ? r.body.question.trim() : "";
    if (!topic || !question) return Response.json({ error: "Send the topic and the question." }, { status: 400 });
    const currentSay = typeof r.body.currentSay === "string" ? r.body.currentSay : "";
    return Response.json(
      await answerDoubt({ source: r.source, level: r.level, language: r.language, topic, currentSay, question }),
    );
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
