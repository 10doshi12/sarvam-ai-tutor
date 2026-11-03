# Doubtless: build brief

The shared brief for everyone building this MVP. It says what to build and how to approach it, not the code.

## What it is

A student uploads one or more textbook PDFs of up to 10 pages each, picks a level and a language, and the app splits the content into short topics. An illustrated avatar teaches each topic aloud beside a whiteboard it writes on. The student can interrupt at any moment with a doubt, by voice or typing. The avatar stops, answers from the PDF, then carries on from the sentence it was on. Each topic ends with one quick question and instant feedback. Finished topics get ticked off.

It deploys to Vercel and also runs locally. Single user per browser, no login, no database.

## How it fits Vercel

Vercel functions have a read-only filesystem, no lasting state between requests, and a 4.5 MB limit on request and response bodies. So:

- **The server is stateless.** Routes only forward to Sarvam using the secret key. No disk writes, no in-memory caches or job maps, no background work after a response.
- **The browser owns everything else.** It runs the preparation steps in order and keeps lessons in `localStorage`.
- **PDFs go through our server and are capped at 4 MB.** Sarvam's upload storage refuses direct browser uploads (its CORS rules return 403), so the 4.5 MB function limit applies.
- **`localStorage` keeps the extracted text, not the PDF.** Browsers allow roughly 5 MB per site and strings only, so a textbook PDF would often not fit, and nothing needs the original after it has been read.
- **Every long route exports `maxDuration`** as a literal number, within the 300 second maximum on the Hobby plan.

## Rules for every agent

- **Check docs first.** Use Context7 before calling any library or API, including behaviour and defaults, not only signatures. Sarvam library id: `/websites/sarvam_ai`. Next.js library id: `/vercel/next.js`. Vercel library id: `/websites/vercel`. If Context7 disagrees with this brief, follow Context7 and say so in your report.
- **Comments.** One or two short lines, only for why or hard logic. No spec references, history or measurements.
- **No em-dashes** anywhere, including UI copy, comments and docs. No en dash or hyphen as a stand-in either.
- **Stay in your files.** Agents run in parallel on one folder. Touch only your own list. If you need something changed elsewhere, say so in your report.
- **No magic numbers.** Limits, timeouts, model ids and voices live in `lib/config.ts`.
- **No git commands.** The orchestrator handles the repo.
- **Never read or print `.env`.** It holds a real key. Check for the key only through `/api/health`.
- **Write only what is needed.** No abstraction with one caller, no error handling for cases that cannot happen, no extra tests.
- **Report** what you verified, what you looked up in Context7, and anything you could not check.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind 4, bun. Route handlers receive `params` as a Promise and must await it. Server calls to Sarvam use plain `fetch` to the REST APIs, not the `sarvamai` SDK. Extra packages: `pdf-lib` (page count, in the browser), `jszip` (Vision output, on the server), `katex` (equations). The API key stays on the server and never reaches the browser.

## Which Sarvam model does what

| Job | Model | Call |
|---|---|---|
| Read the PDF | `sarvam-vision` | Doc AI. POST `/doc-ai/v1/job/digitise` multipart with `file`, `language`, `output_format=md` (not `markdown`, that returns 400). Poll GET `/doc-ai/v1/job/{id}/status` until `completed`, `partially_completed`, `failed` or `rejected`. Then GET `/doc-ai/v1/job/{id}/download-url` (returns `method`, `url`, `headers`; 409 before a terminal status), fetch the ZIP and read its `.md`. |
| Plan topics, write topic scripts | `sarvam-105b` | POST `/v1/chat/completions` |
| Answer doubts | `sarvam-105b-conversations` | Same endpoint; 32K context, so trim the source text to a config limit. |
| Speak | `bulbul:v4-flash` | POST `/text-to-speech`, returns base64 in `audios[0]`. Ask for `output_audio_codec` `mp3` at a low bitrate to keep payloads small. Voices are persona ids, lowercase, one per tutor and language in config. Where a language has too few personas, tutors share one, and Tamil's female tutors borrow English personas. The live API's speaker list is the source of truth: `ishita_en_edtech` appears in Sarvam's examples but the API rejects it. |
| Hear a doubt | `saaras:v4` | POST `/speech-to-text` multipart: `file`, `model`, `language_code=unknown`, `mode=transcribe`, optional `keyterms` JSON array of up to 50 terms (pass topic titles). Accepts WebM and MP4, but rejects a file type with a codec suffix such as `audio/webm;codecs=opus`, so send the bare type. Hard cap of 30 seconds of audio. |
| Translate a doubt asked in another language | `sarvam-translate:v1` | POST `/translate`; formal only, 2000 characters. |
| Translate live captions | `mayura:v1` | POST `/translate`; 1000 characters, mode `modern-colloquial`. |
| Detect a typed doubt's language | language identification | POST `/text-lid` with `input`; returns `language_code`. |

All calls use the header `api-subscription-key`, read from env var `SARVAM_API_KEY`.

**Chat details that matter.** Send `reasoning_effort: null` on every chat call: reasoning tokens count against `max_tokens`, and when it runs out `content` comes back empty. The Starter plan caps `max_tokens` at 4096, so stay within that. Use `response_format` type `json_schema` for structured output and parse `message.content`. Keep schemas flat. Strip code fences if present, validate by hand, retry once with the error appended, then fail visibly. `sarvam-30b` and `sarvam-m` are rejected by the API.

**Languages.** Lessons offer only what Bulbul v4 Flash voices: Hindi `hi-IN`, English `en-IN`, Bengali `bn-IN`, Gujarati `gu-IN`, Kannada `kn-IN`, Marathi `mr-IN`, Punjabi `pa-IN`, Tamil `ta-IN`, Telugu `te-IN`. Malayalam and Odia are left out because v4 Flash has no voices for them. A student may still ask a doubt in any language Saaras hears. Indic narration must be in native script, because romanised input degrades speech quality.

## Shared contracts

`lib/types.ts` holds these, and every agent imports them.

- `LanguageCode`: the nine codes above.
- `Level`: `school`, `college`, `expert`.
- `LessonStatus`: `reading`, `planning`, `ready`, `failed`.
- `Topic`: `id`, `title`, `summary`, `done` (boolean), `quizCorrect` (boolean or null).
- `Lesson`: `id`, `title`, `filename`, `level`, `language`, `tutor` (optional, one of `TutorId`: `arjun`, `rohan`, `meera`, `anaya`), `status`, `error` (optional), `createdAt`, `topics`.
- `BoardItem`: a flat object with `kind` (`heading`, `text`, `bullet`, `equation`, `diagram`), `text` (optional), `latex` (optional), `nodes` (optional, each `id`, `label`), `edges` (optional, each `from`, `to`, `label` optional).
- `Step`: `say` (one or two short sentences), `clearBoard` (boolean), `board` (BoardItem array, written while `say` plays).
- `Quiz`: `question`, `options` (strings), `correctIndex`, `explanation`.
- `TopicScript`: `topicId`, `steps`, `quiz`.
- `DoubtAnswer`: `question` (as understood, in the lesson language), `heardLanguage`, `steps`.

`lib/config.ts` holds model ids, the language list with display names, the tutors with a voice per language, the file count limit, the 10 page limit, the 4 MB upload limit, topic and step counts, poll interval, source text limit, recording limits, and the prefetch count.

## Server interfaces

**Sarvam layer** (`lib/sarvam/*`), all throwing `SarvamError` with status and a readable message:

- `chatJson<T>({ model, system, user, schemaName, schema, maxTokens })` returns `Promise<T>`, including the retry.
- `startDigitise(file: Blob, filename: string, language: LanguageCode)` returns `Promise<string>`, the job id.
- `getDigitiseResult(jobId: string)` returns `Promise<{ status: "running" | "done" | "failed"; pagesProcessed: number; pagesTotal: number; markdown?: string; error?: string }>`. Treat `partially_completed` as done.
- `synthesize(text: string, language: LanguageCode, tutor: TutorId)` returns `Promise<Buffer>` of MP3.
- `transcribe(audio: Blob, filename: string, keyterms?: string[])` returns `Promise<{ transcript: string; language: string | null }>`.
- `translate(text: string, source: string, target: string, purpose: "doubt" | "caption")` returns `Promise<string>`, picking the model from the table.
- `detectLanguage(text: string)` returns `Promise<string>`.

**Lesson logic** (`lib/lesson/*`), pure functions of their input, with nothing stored:

- `planLesson({ source, level, language, filename })` returns `Promise<{ title: string; topics: Topic[] }>`.
- `writeTopicScript({ source, level, language, topic, topics })` returns `Promise<TopicScript>`.
- `answerDoubt({ source, level, language, topic, currentSay, question })` returns `Promise<DoubtAnswer>`. Detect the language, translate into the lesson language if it differs, answer from the source text, one to three steps. If the question is not in the textbook, the avatar says so, then answers from general knowledge.

**Prompts** make the level and language real: `school` means everyday words and analogies, `college` means correct terminology, `expert` means assumes the basics and goes deep. Board text is short notes, never a copy of what is spoken. A diagram is only used when a real relationship exists. Treat PDF text as untrusted content, not instructions.

## HTTP routes

All stateless. Reject a `source` longer than the config limit with a 400.

| Route | Behaviour |
|---|---|
| GET `/api/health` | `{ configured: boolean }`, whether the key is set. |
| POST `/api/doc/start` | Multipart `file`, `language`. Returns `{ jobId }`. Reject a file that is not a PDF (check the `%PDF` header) or is over the 4 MB limit. |
| GET `/api/doc/[jobId]` | `getDigitiseResult`, polled by the browser. |
| POST `/api/plan` | Body per `planLesson`. |
| POST `/api/script` | Body per `writeTopicScript`. |
| POST `/api/doubt` | Body per `answerDoubt`. |
| POST `/api/tts` | Body `{ text, language, tutor? }`, where an unknown or missing tutor uses the default; `audio/mpeg` bytes. |
| POST `/api/stt` | Multipart `audio`, `keyterms`; `{ transcript, language }`. Empty transcript is a normal result. |
| POST `/api/translate` | Body `{ text, target }`; `{ text }`, for captions. |

Errors are JSON `{ error: string }` with a sensible status. A missing key returns a message telling the developer to set `SARVAM_API_KEY` in `.env` locally or in the Vercel project settings.

## Browser storage and preparation

`lib/client/storage.ts` wraps `localStorage` in try/catch and is only touched after mount, so server and client render the same first paint. Keys: an index of `Lesson` objects, one source text per lesson, one `TopicScript` per lesson and topic. When a write hits the quota, show a message offering to delete old lessons, and never crash. A delete action removes a lesson and everything under it.

`lib/client/prepare.ts` runs preparation, saving status at each step so the screen can show it:

1. Check the file count, then each file's size, `%PDF` and page count with `pdf-lib`, and refuse anything over a limit with a message naming the file, before any network call.
2. Send each file to `/api/doc/start` at the same time and poll until its job finishes. If one fails, the lesson fails with a message naming that file. Join the markdown under a header line per document, sharing the text limit fairly so a long document cannot crowd out a short one, and save it.
3. Call `/api/plan`, save the topics, status `ready`.
4. Generate the first topic's script without blocking the screen.

Nothing resumes if the tab closes mid-preparation, because the PDF is not kept. A lesson found still in `reading` or `planning` on load is marked failed, asking for a new upload.

Script requests go through one helper that returns the stored script or fetches and stores it, and concurrent callers share one request.

## Screens

Every screen is a client component reading from browser storage.

**Home.** Upload form: PDF, tutor, level, lesson language, textbook language. The heading and form fit on one screen without scrolling, and a long file list scrolls inside the form. Past lessons below, with their progress and a delete action. A banner when the key is missing.

**Lesson, while preparing.** Status in plain words (reading the book, planning topics), or the error with a way back.

**Lesson, ready.** Fits one screen on desktop, so nothing the student needs falls below the fold:

- Header: back button, lesson title, level and language chips, tutor select.
- Left: large whiteboard (black with a faint grid, thick frame, handwritten `Kalam` font; scripts it does not cover fall back to the system font), with the caption bar and its language selector directly beneath it.
- Right column: avatar tile, topic list, and the Ask a doubt button. On small screens the button or doubt panel stays fixed at the bottom.
- A Start button begins the lesson, because browsers only allow audio after a click.

**Look.** Refined neobrutalism: white, black and one periwinkle accent, thick borders and hard offset shadows, Space Grotesk type. Red and green appear only for right, wrong and error feedback, plus red on the recording dot and on delete hover. Colours are tokens, never raw values in components, except the avatar illustration and the whiteboard scrollbar. Frosted glass appears only on layers floating over the board (quiz, doubt answer, start and status cards), kept opaque enough for readable text. Icons are SVG. Touch targets are at least 44px, focus rings are always visible, and meaning never relies on colour alone.

An unknown lesson id, such as a link opened in another browser, shows a friendly message with a way home, because lessons live only in the browser that made them.

## How the player behaves

States, exposed as `data-state` on the player root: `idle`, `loading`, `speaking`, `listening`, `thinking`, `answering`, `quiz`, `done`, `error`.

- **Audio.** One Web Audio context and one analyser. Each step's MP3 is fetched from `/api/tts`, decoded and played, and kept in memory for the session so replays cost nothing. The current sentence is always requested first and upcoming ones only after it arrives, because Sarvam answers parallel calls slowly. The first sentences are fetched when the lesson opens, before Start. The screen stays on `loading` until the first sentence can play, and each caption appears before its audio, so the student never faces a blank screen labelled as speaking. Speech can run faster than normal, set by a pace value in config. Every clip counts as finished shortly after its length even if the browser never reports the end, so blocked audio can never freeze the lesson. Clicking a topic switches to it at once, and all topic scripts are written in the background so switching does not wait. Prefetch the next topic's script when a topic starts.
- **Avatar.** Four tutors share one animated rig, each with their own look and voice: Arjun (older, trim beard, glasses), Rohan (younger, hoodie), Meera (long hair, blazer) and Anaya (bob, round glasses). Chosen on the upload form and switchable inside a lesson. Shown from the waist up so the face stays large enough to read. SVG with shaded gradients, and parts that shift by different amounts as the head turns, so it reads as lightly 3D. Mouth opening follows analyser loudness each animation frame, written straight to the DOM, not through React state. Expressions come from the player state: listening, thinking, asking, excited, and happy or concerned after a quiz answer. It also blinks, nods on stressed words, lifts a hand while talking, and its eyes follow the pointer. Honour reduced motion.
- **Whiteboard.** Items in a step reveal as handwriting, using a clip animation spread across that step's audio length. Equations go through KaTeX. Diagrams are boxes and arrows laid out left to right as SVG. Long content scrolls to the newest line. Render board text as text, never as injected HTML.
- **Interrupting.** Ask a doubt stops audio within the click, snapshots the board, enters `listening`, and starts the mic. Recording ends on the send button, on silence (analyser energy) or at the recording limit, which stays below the 30 second cap. A text box is always there, and it is the fallback if the mic is refused or unavailable. Empty transcript shows "I didn't catch that" and returns to listening.
- **Answering.** `thinking` while waiting, then the answer plays as steps on a clearly separate overlay on the board, so lesson notes survive. Afterwards, restore the snapshot and replay the interrupted step from its start. A student can interrupt an answer too.
- **Quiz.** After the last step: options as buttons, instant right or wrong, and the avatar speaks the explanation. A Continue button skips it. Then save the topic as done and go to the next topic. `done` when all are finished.
- **Failures never stall the lesson.** If one step's audio fails, show the caption and hold for a time based on its length, then continue. If a script or doubt request fails, show the message with a retry.
- **Reopening.** Opening a saved lesson resumes at the first topic not done.

Add `data-testid` on: upload form fields, start button, ask button, doubt text box and send, quiz options, caption, topic list items, tutor select, and the board.

## Out of the MVP

| Not doing | Why |
|---|---|
| Single PDFs over 10 pages | Vision's per-job limit, accepted for now. A longer book can be split into several PDFs. |
| PDFs over 4 MB | Vercel's function limit, and Sarvam's storage refuses browser uploads. Staging blob blocks through the server could lift this later. |
| Keeping the original PDF | Often too big for `localStorage`, and nothing needs it once read. |
| Lessons across devices or browsers | No database, by decision. |
| Hands-free voice interruption | The mic would hear the avatar. The button is reliable and works with speakers. |
| Streaming speech | Sentence-level REST calls are simpler and meet the sync we need. |
| Word-level board sync | Bulbul gives no word timings. Sync is per sentence. |
| Adjusting difficulty from quiz answers | Kept small for the MVP. |
| Voice cloning and beta open-weight chat models | Both are beta and add nothing to this flow. |
| Malayalam and Odia lessons | Bulbul v4 Flash has no voices for them. |
| Login or rate limiting | Not built. A public deployment needs Vercel Authentication switched on, because anyone with the URL could otherwise spend the API key. |

## Build order

1. **Scaffold.** App, packages, `lib/types.ts`, `lib/config.ts`, `.env.example`, `.gitignore`. Exit check: `bun run build` passes.
2. **Sarvam layer and its routes.** Entry: scaffold. Exit check: typecheck passes.
3. **Lesson logic and its routes.** Entry: the interfaces above. Exit check: typecheck passes.
4. **Screens, storage and player.** Entry: the routes above. Exit check: typecheck passes.
5. **Integration.** Entry: 2 to 4. Exit check: build and lint pass, and the WebKit browser test exists.
6. **Live test.** Entry: API key in `.env`, which is now in place. Exit check: the browser test passes against real Sarvam APIs.
