import type { Lesson, Topic, TopicScript } from "@/lib/types";
import { cached } from "./cache";
import { getScript, getSource, saveScript } from "./storage";

// Scripts kept for this session so a full storage never loses one.
const session = new Map<string, TopicScript>();
const inFlight = new Map<string, Promise<TopicScript>>();

async function fetchScript(lesson: Lesson, topic: Topic): Promise<TopicScript> {
  const source = getSource(lesson.id);
  if (!source) throw new Error("The book text for this lesson is missing. Please upload the PDF again.");
  // Keyed on what the writing depends on, not on progress fields that change as the student learns.
  const titles = lesson.topics.map((t) => t.title).join("\n");
  return cached("script", [source, lesson.level, lesson.language, topic.id, topic.title, titles], async () => {
    const res = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        level: lesson.level,
        language: lesson.language,
        topic,
        topics: lesson.topics,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error ?? "Could not write this topic. Please try again.");
    return data as TopicScript;
  });
}

export function getTopicScript(lesson: Lesson, topic: Topic): Promise<TopicScript> {
  const key = `${lesson.id}:${topic.id}`;
  const cached = session.get(key) ?? getScript(lesson.id, topic.id);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchScript(lesson, topic)
    .then((script) => {
      session.set(key, script);
      try {
        saveScript(lesson.id, script);
      } catch {
        // The session copy still serves this script.
      }
      return script;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
