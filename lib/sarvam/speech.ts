import "server-only";
import { LIMITS, MODELS, SPEECH, TUTORS } from "@/lib/config";
import type { LanguageCode, TutorId } from "@/lib/types";
import { SarvamError } from "./errors";
import { postJson, sarvamJson } from "./http";

export async function synthesize(text: string, language: LanguageCode, tutor: TutorId): Promise<Buffer> {
  const voice = TUTORS.find((t) => t.id === tutor)?.voices[language];
  if (!voice) throw new SarvamError(400, "Unsupported tutor or language.");
  const r = await postJson<{ audios?: string[] }>("/text-to-speech", {
    text: text.slice(0, LIMITS.maxTtsChars),
    language_code: language,
    model: MODELS.speech,
    speaker: voice,
    output_audio_codec: SPEECH.codec,
    pace: SPEECH.pace,
    output_audio_bitrate: SPEECH.bitrate,
  });
  if (!r.audios?.[0]) throw new SarvamError(502, "Sarvam returned no audio.");
  return Buffer.from(r.audios[0], "base64");
}

export async function transcribe(
  audio: Blob,
  filename: string,
  keyterms?: string[],
): Promise<{ transcript: string; language: string | null }> {
  const form = new FormData();
  // Sarvam rejects a type with a codec suffix, such as audio/webm;codecs=opus.
  form.append("file", new Blob([audio], { type: audio.type.split(";")[0] }), filename);
  form.append("model", MODELS.hearing);
  form.append("mode", "transcribe");
  form.append("language_code", "unknown");
  if (keyterms?.length) form.append("keyterms", JSON.stringify(keyterms.slice(0, LIMITS.maxKeyterms)));
  const r = await sarvamJson<{ transcript?: string; language_code?: string | null }>("/speech-to-text", {
    method: "POST",
    body: form,
  });
  return { transcript: (r.transcript ?? "").trim(), language: r.language_code ?? null };
}
