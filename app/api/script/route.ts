import { sarvamErrorResponse } from "@/lib/sarvam";
import type { Topic } from "@/lib/types";
import { writeTopicScript } from "@/lib/lesson/script";
import { asTopic, readLessonBody } from "@/lib/lesson/schemas";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const r = await readLessonBody(req);
    if (r instanceof Response) return r;
    const topic = asTopic(r.body.topic);
    const topics = (Array.isArray(r.body.topics) ? r.body.topics : []).map(asTopic).filter((t): t is Topic => t !== null);
    if (!topic) return Response.json({ error: "Send the topic to teach." }, { status: 400 });
    return Response.json(
      await writeTopicScript({ source: r.source, level: r.level, language: r.language, topic, topics }),
    );
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
