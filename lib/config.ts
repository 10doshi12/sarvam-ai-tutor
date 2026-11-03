// Models, voices and limits. Safe to import from the browser and the server.
import type { LanguageCode, Level, TutorId } from "./types";

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

export const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: "en-IN", name: "English" },
  { code: "hi-IN", name: "हिन्दी (Hindi)" },
  { code: "bn-IN", name: "বাংলা (Bengali)" },
  { code: "gu-IN", name: "ગુજરાતી (Gujarati)" },
  { code: "kn-IN", name: "ಕನ್ನಡ (Kannada)" },
  { code: "mr-IN", name: "मराठी (Marathi)" },
  { code: "pa-IN", name: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ta-IN", name: "தமிழ் (Tamil)" },
  { code: "te-IN", name: "తెలుగు (Telugu)" },
];

// Ids come from the live API's speaker list, which is the source of truth over the docs' examples.
// Some languages have few personas, so tutors can share a voice there, and Tamil's female tutors borrow English personas.
export const TUTORS: { id: TutorId; name: string; voices: Record<LanguageCode, string> }[] = [
  {
    id: "arjun",
    name: "Arjun",
    voices: {
      "en-IN": "shubh_en_narration",
      "hi-IN": "aditya_hi_conversational",
      "bn-IN": "arnab_bn_conversation",
      "gu-IN": "bhavik_gu_conversation",
      "kn-IN": "chetan_kn_conversation",
      "mr-IN": "nilesh_mr_conversation",
      "pa-IN": "anand_pa_conversation",
      "ta-IN": "vijay_ta_narration",
      "te-IN": "tarun_te_narration",
    },
  },
  {
    id: "rohan",
    name: "Rohan",
    voices: {
      "en-IN": "kalpit_en_edtech",
      "hi-IN": "kabir_hi_conversational",
      "bn-IN": "bimal_bn_suspense",
      "gu-IN": "bhavik_gu_conversation",
      "kn-IN": "chetan_kn_conversation",
      "mr-IN": "soham_mr_narration",
      "pa-IN": "jaspal_pa_banking",
      "ta-IN": "gokul_ta_narration",
      "te-IN": "tarun_te_narration",
    },
  },
  {
    id: "meera",
    name: "Meera",
    voices: {
      "en-IN": "simran_en_edtech",
      "hi-IN": "ishita_hi_edtech",
      "bn-IN": "roopa_bn_conversational",
      "gu-IN": "pooja_gu_conversational",
      "kn-IN": "chaitra_kn_narration",
      "mr-IN": "ishita_mr_conversational",
      "pa-IN": "harpreet_pa_narration",
      "ta-IN": "simran_en_edtech",
      "te-IN": "kavitha_te_narration",
    },
  },
  {
    id: "anaya",
    name: "Anaya",
    voices: {
      "en-IN": "ritu_en_edtech",
      "hi-IN": "ritu_hi_edtech",
      "bn-IN": "roopa_bn_conversational",
      "gu-IN": "pooja_gu_customer",
      "kn-IN": "suchitra_kn_narration",
      "mr-IN": "neha_mr_narration",
      "pa-IN": "harpreet_pa_narration",
      "ta-IN": "ritu_en_edtech",
      "te-IN": "pooja_te_conversation",
    },
  },
];

export const DEFAULT_TUTOR: TutorId = "arjun";

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
