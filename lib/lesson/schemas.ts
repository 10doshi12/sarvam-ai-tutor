import { chatJson, SARVAM_TIMEOUT } from "@/lib/sarvam";
import { LANGUAGES, LIMITS } from "@/lib/config";
import type { BoardItem, DoubtAnswer, LanguageCode, Level, Quiz, Step, Topic, TopicScript } from "@/lib/types";

const BOARD_KINDS = ["heading", "text", "bullet", "equation", "diagram"] as const;

const boardItemSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...BOARD_KINDS] },
    text: { type: "string" },
    latex: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" } },
        required: ["id", "label"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } },
        required: ["from", "to"],
      },
    },
  },
  required: ["kind"],
};

const stepSchema = {
  type: "object",
  properties: {
    say: { type: "string" },
    clearBoard: { type: "boolean" },
    board: { type: "array", items: boardItemSchema },
  },
  required: ["say", "board"],
};

export const planSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, summary: { type: "string" } },
        required: ["title", "summary"],
      },
    },
  },
  required: ["title", "topics"],
};

export const scriptSchema = {
  type: "object",
  properties: {
    steps: { type: "array", items: stepSchema },
    quiz: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        correctIndex: { type: "integer" },
        explanation: { type: "string" },
      },
      required: ["question", "options", "correctIndex", "explanation"],
    },
  },
  required: ["steps", "quiz"],
};

export const doubtSchema = {
  type: "object",
  properties: { question: { type: "string" }, steps: { type: "array", items: stepSchema } },
  required: ["question", "steps"],
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function normalizeBoardItem(raw: unknown): BoardItem | null {
  if (!isObj(raw)) return null;
  const kind = str(raw.kind) as BoardItem["kind"];
  if (!BOARD_KINDS.includes(kind)) return null;
  const text = str(raw.text);
  if (kind === "equation") {
    const latex = str(raw.latex);
    return latex ? { kind, latex, ...(text ? { text } : {}) } : null;
  }
  if (kind === "diagram") {
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
      .filter(isObj)
      .map((n) => ({ id: str(n.id), label: str(n.label) }))
      .filter((n) => n.id && n.label);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (Array.isArray(raw.edges) ? raw.edges : [])
      .filter(isObj)
      .map((e) => ({ from: str(e.from), to: str(e.to), label: str(e.label) }))
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => (e.label ? e : { from: e.from, to: e.to }));
    return nodes.length >= 2 ? { kind, nodes, edges, ...(text ? { text } : {}) } : null;
  }
  return text ? { kind, text } : null;
}

export function normalizeSteps(raw: unknown, max: number): Step[] {
  const steps = (Array.isArray(raw) ? raw : []).filter(isObj).flatMap<Step>((s) => {
    const say = str(s.say);
    if (!say) return [];
    const board = (Array.isArray(s.board) ? s.board : [])
      .map(normalizeBoardItem)
      .filter((b): b is BoardItem => b !== null);
    return [{ say, clearBoard: s.clearBoard === true, board }];
  });
  if (!steps.length) throw new Error("The model returned no usable steps.");
  return steps.slice(0, max);
}

function normalizeQuiz(raw: unknown): Quiz {
  if (!isObj(raw)) throw new Error("The model returned no quiz.");
  const options = (Array.isArray(raw.options) ? raw.options : []).map(str).filter(Boolean);
  const question = str(raw.question);
  if (!question || options.length < 2) throw new Error("The quiz was incomplete.");
  const idx = Number(raw.correctIndex);
  const correctIndex = Number.isFinite(idx) ? Math.min(Math.max(Math.trunc(idx), 0), options.length - 1) : 0;
  return { question, options, correctIndex, explanation: str(raw.explanation) };
}

export function normalizePlan(raw: unknown, fallbackTitle: string): { title: string; topics: Topic[] } {
  if (!isObj(raw)) throw new Error("The model returned no plan.");
  const topics = (Array.isArray(raw.topics) ? raw.topics : [])
    .filter(isObj)
    .map((t, i) => ({
      id: `t${i + 1}`,
      title: str(t.title),
      summary: str(t.summary),
      done: false,
      quizCorrect: null,
    }))
    .filter((t) => t.title)
    .slice(0, LIMITS.maxTopics)
    .map((t, i) => ({ ...t, id: `t${i + 1}` }));
  if (!topics.length) throw new Error("The model returned no topics.");
  return { title: str(raw.title) || fallbackTitle, topics };
}

export function normalizeScript(raw: unknown, topicId: string): TopicScript {
  if (!isObj(raw)) throw new Error("The model returned no script.");
  return { topicId, steps: normalizeSteps(raw.steps, LIMITS.maxStepsPerTopic), quiz: normalizeQuiz(raw.quiz) };
}

export function normalizeDoubt(raw: unknown, fallbackQuestion: string): Omit<DoubtAnswer, "heardLanguage"> {
  if (!isObj(raw)) throw new Error("The model returned no answer.");
  return { question: str(raw.question) || fallbackQuestion, steps: normalizeSteps(raw.steps, LIMITS.maxDoubtSteps) };
}

/** Calls the model, validates by hand, and retries with the problem appended. */
export async function chatValidated<T>(
  args: Omit<Parameters<typeof chatJson>[0], "user"> & { user: string },
  normalize: (raw: unknown) => T,
  check: (value: T) => string | null = () => null,
): Promise<T> {
  let user = args.user;
  // A usable reply in the wrong language still beats failing the lesson once tries run out.
  let usable: { value: T } | null = null;
  for (let attempt = 1; ; attempt++) {
    let problem: string | null;
    try {
      const value = normalize(await chatJson<unknown>({ ...args, user }));
      const complaint = check(value);
      if (!complaint) return value;
      usable = { value };
      problem = complaint;
    } catch (err) {
      // A timeout says nothing about the prompt, so it is retried unchanged.
      const status = (err as { status?: number }).status;
      if (status && status !== SARVAM_TIMEOUT) throw err;
      if (attempt >= LIMITS.chatAttempts && !usable) throw err;
      problem = status ? null : (err as Error).message;
    }
    if (attempt >= LIMITS.chatAttempts && usable) return usable.value;
    if (problem) user = `${args.user}\n\nYour previous reply was rejected: ${problem} Reply again with complete, valid JSON.`;
  }
}

const LEVELS: Level[] = ["school", "college", "expert"];

export function asTopic(v: unknown): Topic | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  if (!id || !title) return null;
  return { id, title, summary: str(v.summary), done: v.done === true, quizCorrect: typeof v.quizCorrect === "boolean" ? v.quizCorrect : null };
}

/** Validates the fields every lesson route shares; returns an error Response when invalid. */
export async function readLessonBody(
  req: Request,
): Promise<{ body: Obj; source: string; level: Level; language: LanguageCode } | Response> {
  const bad = (m: string) => Response.json({ error: m }, { status: 400 });
  const body: unknown = await req.json().catch(() => null);
  if (!isObj(body)) return bad("Send a JSON body.");
  const source = typeof body.source === "string" ? body.source : "";
  if (!source.trim()) return bad("The book text is empty.");
  if (source.length > LIMITS.maxSourceChars) return bad("The book text is too long.");
  if (!LEVELS.includes(body.level as Level)) return bad("Pick a valid level.");
  if (!LANGUAGES.some((l) => l.code === body.language)) return bad("Pick a valid language.");
  return { body, source, level: body.level as Level, language: body.language as LanguageCode };
}
