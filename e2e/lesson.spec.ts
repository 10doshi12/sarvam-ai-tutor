import { expect, test, type Page } from "@playwright/test";
import { languageProblem } from "../lib/lesson/language";
import { joinDocuments, shareSource } from "../lib/lesson/source";
import { makeLongPdf, makePhotosynthesisPdf, makeVolcanoPdf } from "./fixtures/make-pdf";

// WebKit under Playwright has no fake microphone, so the mic path is not covered.

const MINUTE = 60_000;
const READY_TIMEOUT = 5 * MINUTE;
const STEP_TIMEOUT = 2 * MINUTE;

const state = (page: Page) => page.locator("[data-state]").first();

async function uploadPdf(page: Page, name: string, buffer: Buffer) {
  await page.goto("/");
  await page.getByTestId("upload-file").setInputFiles({ name, mimeType: "application/pdf", buffer });
  await page.getByTestId("upload-level").selectOption("school");
  await page.getByTestId("upload-language").selectOption("en-IN");
  await page.getByTestId("upload-textbook-language").selectOption("en-IN");
  await page.getByTestId("upload-submit").click();
}

test("full journey: upload, teach, interrupt, answer, resume, reload", async ({ page }) => {
  await uploadPdf(page, "photosynthesis.pdf", await makePhotosynthesisPdf());

  await expect(page.getByTestId("topic-item").first()).toBeVisible({ timeout: READY_TIMEOUT });
  await expect(page.getByTestId("start-button")).toBeEnabled();
  await page.getByTestId("start-button").click();

  await expect(state(page)).toHaveAttribute("data-state", "speaking", { timeout: STEP_TIMEOUT });
  await expect(page.getByTestId("board")).not.toBeEmpty({ timeout: STEP_TIMEOUT });
  await expect(page.getByTestId("caption")).not.toBeEmpty();
  const interruptedCaption = (await page.getByTestId("caption").innerText()).trim();

  // Record every state the player passes through, since thinking can be brief.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __states: string[] }).__states = seen;
    const el = document.querySelector("[data-state]")!;
    seen.push(el.getAttribute("data-state")!);
    new MutationObserver(() => {
      const s = el.getAttribute("data-state")!;
      if (seen[seen.length - 1] !== s) seen.push(s);
    }).observe(el, { attributes: true, attributeFilter: ["data-state"] });
  });

  await page.getByTestId("ask-button").click();
  await expect(state(page)).not.toHaveAttribute("data-state", "speaking");

  await page.getByTestId("doubt-input").fill("Why are leaves green?");
  await page.getByTestId("doubt-send").click();

  await expect(state(page)).toHaveAttribute("data-state", "answering", { timeout: STEP_TIMEOUT });
  await expect(state(page)).toHaveAttribute("data-state", "speaking", { timeout: STEP_TIMEOUT });

  const seen = await page.evaluate(() => (window as unknown as { __states: string[] }).__states);
  expect(seen.indexOf("thinking")).toBeGreaterThan(-1);
  expect(seen.indexOf("answering")).toBeGreaterThan(seen.indexOf("thinking"));

  await expect(page.getByTestId("caption")).toHaveText(interruptedCaption, { timeout: STEP_TIMEOUT });

  await page.reload();
  await expect(page.getByTestId("topic-item").first()).toBeVisible();
  await expect(page.getByTestId("start-button")).toBeVisible();
  const stored = await page.evaluate(() => Object.keys(localStorage).length);
  expect(stored).toBeGreaterThan(0);
});

test("an 11-page PDF is refused before any upload request", async ({ page }) => {
  const uploadCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/doc/start")) uploadCalls.push(req.url());
  });

  await uploadPdf(page, "too-long.pdf", await makeLongPdf(11));

  await expect(page.getByText(/(10|ten)[\s-]*pages?/i).first()).toBeVisible();
  expect(uploadCalls).toEqual([]);
});

test("speech round trip: tts then stt keeps the words", async ({ request }) => {
  const sentence = "Plants use sunlight, water and carbon dioxide to make their own food.";

  const tts = await request.post("/api/tts", { data: { text: sentence, language: "en-IN" } });
  expect(tts.ok()).toBeTruthy();
  expect(tts.headers()["content-type"]).toContain("audio/mpeg");
  const mp3 = await tts.body();
  expect(mp3.length).toBeGreaterThan(1000);

  const stt = await request.post("/api/stt", {
    multipart: {
      audio: { name: "speech.mp3", mimeType: "audio/mpeg;codecs=mp3", buffer: mp3 },
      keyterms: JSON.stringify(["sunlight", "carbon dioxide"]),
    },
  });
  expect(stt.ok()).toBeTruthy();
  const { transcript } = (await stt.json()) as { transcript: string };
  expect(transcript.toLowerCase()).toMatch(/sunlight|plants|carbon|food/);
});

test("the quiz closes and moves on even if audio never reports finishing", async ({ page }) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const topic = (n: number) => ({ id: `t${n}`, title: `Topic ${n}`, summary: "Plants.", done: false, quizCorrect: null });
  const script = {
    topicId: "t1",
    steps: [{ say: "Plants make food.", clearBoard: false, board: [{ kind: "text", text: "Food" }] }],
    quiz: { question: "What do plants make?", options: ["Food", "Rocks"], correctIndex: 0, explanation: "Plants make food." },
  };
  await page.addInitScript(
    ([lessonId, lessonTopics, topicScript]) => {
      // A clip that starts but never ends is the failure this guards against.
      AudioBufferSourceNode.prototype.start = function () {};
      localStorage.setItem(
        "sc:lessons",
        JSON.stringify([
          { id: lessonId, title: "Quiz", filename: "q.pdf", level: "school", language: "en-IN", status: "ready", createdAt: new Date().toISOString(), topics: lessonTopics },
        ]),
      );
      localStorage.setItem(`sc:source:${lessonId}`, "Plants make food.");
      localStorage.setItem(`sc:script:${lessonId}:t1`, JSON.stringify(topicScript));
      localStorage.setItem(`sc:script:${lessonId}:t2`, JSON.stringify({ ...topicScript, topicId: "t2" }));
    },
    [id, [topic(1), topic(2)], script] as const,
  );

  await page.goto(`/lessons/${id}`);
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("quiz-option").first()).toBeVisible({ timeout: STEP_TIMEOUT });
  await page.getByTestId("quiz-option").first().click();

  await expect(page.getByTestId("quiz-option")).toHaveCount(0, { timeout: MINUTE });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sc:lessons")!)[0].topics[0].done);
  expect(saved).toBe(true);
});

test("clicking a topic switches to it straight away", async ({ page }) => {
  const id = "33333333-3333-4333-8333-333333333333";
  const script = (topicId: string, say: string) => ({
    topicId,
    steps: [{ say, clearBoard: false, board: [{ kind: "text", text: say }] }],
    quiz: { question: "Ready?", options: ["Yes", "No"], correctIndex: 0, explanation: "Good." },
  });
  const topic = (n: number) => ({ id: `t${n}`, title: `Topic ${n}`, summary: "Plants.", done: false, quizCorrect: null });
  await page.addInitScript(
    ([lessonId, lessonTopics, one, two]) => {
      localStorage.setItem(
        "sc:lessons",
        JSON.stringify([
          { id: lessonId, title: "Topics", filename: "t.pdf", level: "school", language: "en-IN", status: "ready", createdAt: new Date().toISOString(), topics: lessonTopics },
        ]),
      );
      localStorage.setItem(`sc:source:${lessonId}`, "Plants make food.");
      localStorage.setItem(`sc:script:${lessonId}:t1`, JSON.stringify(one));
      localStorage.setItem(`sc:script:${lessonId}:t2`, JSON.stringify(two));
    },
    [id, [topic(1), topic(2)], script("t1", "Roots drink water from the soil."), script("t2", "Leaves catch the morning sunlight.")] as const,
  );

  await page.goto(`/lessons/${id}`);
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("caption")).toContainText("Roots", { timeout: STEP_TIMEOUT });

  await page.getByTestId("topic-item").nth(1).click();
  await expect(page.getByTestId("caption")).toContainText("Leaves", { timeout: STEP_TIMEOUT });
  await expect(page.getByTestId("board")).toContainText("Leaves");
});

test("several PDFs picked one at a time become one lesson built from all of them", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("upload-file");
  await input.setInputFiles({ name: "plants.pdf", mimeType: "application/pdf", buffer: await makePhotosynthesisPdf() });
  await input.setInputFiles({ name: "volcanoes.pdf", mimeType: "application/pdf", buffer: await makeVolcanoPdf() });
  await expect(page.getByTestId("upload-file-item")).toHaveCount(2);
  await page.getByTestId("upload-submit").click();

  await expect(page.getByTestId("topic-item").first()).toBeVisible({ timeout: READY_TIMEOUT });
  const source = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sc:source:"))!;
    return localStorage.getItem(key)!;
  });
  expect(source).toMatch(/photosynthesis/i);
  expect(source).toMatch(/volcano/i);
});

test("too many PDFs are refused before any upload request", async ({ page }) => {
  const uploadCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/doc/start")) uploadCalls.push(req.url());
  });
  const buffer = await makeVolcanoPdf();
  const files = Array.from({ length: 6 }, (_, i) => ({ name: `part-${i}.pdf`, mimeType: "application/pdf", buffer }));

  await page.goto("/");
  await page.getByTestId("upload-file").setInputFiles(files);
  await page.getByTestId("upload-submit").click();

  await expect(page.getByText("5 PDFs or fewer")).toBeVisible();
  expect(uploadCalls).toEqual([]);
});

test("a long document cannot crowd a short one out, even when trimmed twice", () => {
  const docs = [
    { name: "long.pdf", text: "x".repeat(5000) },
    { name: "short.pdf", text: "The short document." },
  ];

  const lessonText = joinDocuments(docs, 3000);
  const doubtText = shareSource(lessonText, 1000);

  for (const text of [lessonText, doubtText]) {
    expect(text).toContain("The short document.");
    expect(text).toContain("=== Document: long.pdf ===");
  }
  expect(lessonText.length).toBeLessThanOrEqual(3000);
  expect(doubtText.length).toBeLessThanOrEqual(1000);
});

test("each tutor speaks with a different voice", async ({ request }) => {
  const text = "Plants make their own food from sunlight.";
  const audio = await Promise.all(
    ["arjun", "rohan", "meera", "anaya"].map(async (tutor) => {
      const res = await request.post("/api/tts", { data: { text, language: "en-IN", tutor } });
      expect(res.ok()).toBeTruthy();
      return (await res.body()).toString("base64");
    }),
  );
  expect(new Set(audio).size).toBe(4);
});

test("a tutor switched inside a lesson is remembered", async ({ page }) => {
  const id = "66666666-6666-4666-8666-666666666666";
  await page.addInitScript((lessonId) => {
    if (localStorage.getItem("sc:lessons")) return;
    localStorage.setItem(
      "sc:lessons",
      JSON.stringify([
        { id: lessonId, title: "Tutors", filename: "t.pdf", level: "school", language: "en-IN", status: "ready", createdAt: new Date().toISOString(), topics: [{ id: "t1", title: "One", summary: "x", done: false, quizCorrect: null }] },
      ]),
    );
    localStorage.setItem(`sc:source:${lessonId}`, "Plants make food.");
    localStorage.setItem(`sc:script:${lessonId}:t1`, JSON.stringify({ topicId: "t1", steps: [{ say: "Hello.", clearBoard: false, board: [] }], quiz: { question: "Ok?", options: ["Yes", "No"], correctIndex: 0, explanation: "Good." } }));
  }, id);

  await page.goto(`/lessons/${id}`);
  await page.getByTestId("tutor-select").selectOption("meera");
  await page.reload();
  await expect(page.getByTestId("tutor-select")).toHaveValue("meera");
});

test("uploading the same PDF again reuses everything, and the phases are shown the first time", async ({ page }) => {
  const paid: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(doc\/start|plan|script|tts)$/.test(new URL(r.url()).pathname)) paid.push(new URL(r.url()).pathname);
  });
  const pdf = await makeVolcanoPdf();

  await uploadPdf(page, "volcanoes.pdf", pdf);
  await expect(page.getByTestId("prep-reading")).toHaveAttribute("data-state", "current");
  for (const phase of ["planning", "writing", "voicing"]) {
    await expect(page.getByTestId(`prep-${phase}`)).toHaveAttribute("data-state", "current", { timeout: READY_TIMEOUT });
  }
  await expect(page.getByTestId("topic-item").first()).toBeVisible({ timeout: READY_TIMEOUT });
  for (const api of ["doc/start", "plan", "script", "tts"]) expect(paid).toContain(`/api/${api}`);

  // Everything the lesson will say was recorded up front, so playing it needs no speech request.
  paid.length = 0;
  await uploadPdf(page, "volcanoes.pdf", pdf);
  await expect(page.getByTestId("topic-item").first()).toBeVisible({ timeout: STEP_TIMEOUT });
  await page.getByTestId("start-button").click();
  await expect(state(page)).toHaveAttribute("data-state", "speaking", { timeout: STEP_TIMEOUT });
  expect(paid).toEqual([]);
});

test("a lesson still opens when writing its topics fails during preparation", async ({ page }) => {
  await page.route("**/api/doc/start", (r) => r.fulfill({ json: { jobId: "job" } }));
  await page.route("**/api/doc/job", (r) => r.fulfill({ json: { status: "done", markdown: "Plants make food." } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({ json: { title: "Plants", topics: [{ id: "t1", title: "Food", summary: "x", done: false, quizCorrect: null }] } }),
  );
  await page.route("**/api/script", (r) => r.fulfill({ status: 500, json: { error: "Busy" } }));

  await uploadPdf(page, "plants.pdf", await makePhotosynthesisPdf());
  await expect(page.getByTestId("topic-item").first()).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByTestId("lesson-error")).toHaveCount(0);
});

test("a lesson asked for in Marathi from a long English book comes back in Marathi", async ({ request }) => {
  const chapter =
    "## Symmetric difference\n\nThe symmetric difference of two sets returns items found in exactly one set.\n\n```python\nprint({1, 2} ^ {2, 3})\n```\n\n" +
    "## Subset checks\n\nA subset check can stop as soon as one item is missing, which saves work on large inputs.\n\n```python\n{1}.issubset({1, 2})\n```\n\n";
  const lesson = { source: `=== Document: sets.pdf ===\n${chapter.repeat(40)}`, level: "college", language: "mr-IN" };

  const planned = await request.post("/api/plan", { data: { ...lesson, filename: "sets.pdf" } });
  expect(planned.ok()).toBeTruthy();
  const plan = (await planned.json()) as { title: string; topics: { id: string; title: string; summary: string }[] };
  expect(languageProblem("mr-IN", [plan.title, ...plan.topics.flatMap((t) => [t.title, t.summary])])).toBeNull();

  const written = await request.post("/api/script", { data: { ...lesson, topic: plan.topics[0], topics: plan.topics } });
  expect(written.ok()).toBeTruthy();
  const script = (await written.json()) as { steps: { say: string }[]; quiz: { question: string; explanation: string } };
  expect(languageProblem("mr-IN", [...script.steps.map((s) => s.say), script.quiz.question, script.quiz.explanation])).toBeNull();
});
