// Models, voices and limits. Safe to import from the browser and the server.
import type { LanguageCode, Level } from "./types";

export const MODELS = {
  vision: "sarvam-vision",
  chat: "sarvam-105b",
  doubt: "sarvam-105b-conversations",
  speech: "bulbul:v4-flash",
  hearing: "saaras:v4",
  doubtTranslate: "sarvam-translate:v1",
  captionTranslate: "mayura:v1",
} as const;

export const SARVAM_BASE_URL = "https://api.sarvam.ai";

// Ids come from the live API's speaker list, which is the source of truth over the docs' examples.
export const LANGUAGES: { code: LanguageCode; name: string; voice: string }[] = [
  { code: "en-IN", name: "English", voice: "simran_en_edtech" },
  { code: "hi-IN", name: "हिन्दी (Hindi)", voice: "ishita_hi_edtech" },
  { code: "bn-IN", name: "বাংলা (Bengali)", voice: "roopa_bn_conversational" },
  { code: "gu-IN", name: "ગુજરાતી (Gujarati)", voice: "pooja_gu_conversational" },
  { code: "kn-IN", name: "ಕನ್ನಡ (Kannada)", voice: "chaitra_kn_narration" },
  { code: "mr-IN", name: "मराठी (Marathi)", voice: "ishita_mr_conversational" },
  { code: "pa-IN", name: "ਪੰਜਾਬੀ (Punjabi)", voice: "harpreet_pa_narration" },
  { code: "ta-IN", name: "தமிழ் (Tamil)", voice: "vijay_ta_narration" },
  { code: "te-IN", name: "తెలుగు (Telugu)", voice: "kavitha_te_narration" },
];

export const LEVELS: { value: Level; name: string }[] = [
  { value: "school", name: "School" },
  { value: "college", name: "College" },
  { value: "expert", name: "Expert" },
];

export const LIMITS = {
  maxPdfFiles: 5,
  maxPdfPages: 10,
  // Vercel rejects function bodies over 4.5 MB, and Sarvam's upload storage refuses browser uploads.
  maxPdfBytes: 4 * 1024 * 1024,
  maxSourceChars: 120_000,
  doubtSourceChars: 24_000,
  minTopics: 3,
  maxTopics: 6,
  minStepsPerTopic: 3,
  maxStepsPerTopic: 5,
  maxDoubtSteps: 3,
  // The Starter plan caps max_tokens at 4096.
  planMaxTokens: 1500,
  scriptMaxTokens: 4000,
  doubtMaxTokens: 1000,
  maxTtsChars: 2500,
  doubtTranslateChars: 2000,
  captionTranslateChars: 1000,
  maxKeyterms: 50,
} as const;

export const TIMING = {
  docPollMs: 3000,
  docPollTimeoutMs: 280_000,
  lessonPollMs: 800,
  prefetchSteps: 3,
  // Sarvam answers parallel calls slowly, so sentences are fetched one at a time.
  maxConcurrentTts: 1,
  // A clip counts as finished this long after its length, even if the browser never says so.
  audioEndGraceMs: 800,
  // Stays under Saaras's 30 second cap.
  maxRecordingMs: 25_000,
  silenceStopMs: 1500,
  silenceRms: 0.012,
  // Reading pace used when a step's audio fails to play.
  fallbackMsPerChar: 60,
  fallbackMinMs: 1500,
} as const;

export const SPEECH = {
  codec: "mp3",
  sampleRate: 24000,
  pace: 1.3,
  bitrate: "64k",
} as const;
