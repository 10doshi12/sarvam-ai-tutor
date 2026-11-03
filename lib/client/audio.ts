import { TIMING } from "@/lib/config";
import { cached } from "./cache";
import type { LanguageCode, TutorId } from "@/lib/types";

export type Voice = { language: LanguageCode; tutor: TutorId };

// One shared Web Audio context, analyser and playback slot for the whole session.
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let levelData: Uint8Array<ArrayBuffer> | null = null;
let current: { source: AudioBufferSourceNode; stop: () => void } | null = null;

const cache = new Map<string, Promise<AudioBuffer>>();
const waiting: Array<() => void> = [];
let activePrefetch = 0;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(ctx.destination);
    levelData = new Uint8Array(analyser.fftSize);
  }
  return ctx;
}

// Call synchronously inside a click so the browser lets audio start.
export function unlockAudio(): Promise<void> {
  const c = getAudioContext();
  return c.state === "running" ? Promise.resolve() : c.resume();
}

// Loudness 0..1 of whatever is playing right now.
export function getLevel(): number {
  if (!analyser || !levelData) return 0;
  analyser.getByteTimeDomainData(levelData);
  let sum = 0;
  for (let i = 0; i < levelData.length; i++) {
    const v = (levelData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / levelData.length);
}

// Fetches a sentence's MP3 once per device, so preparation can record it ahead of time.
export function speechBytes(text: string, { language, tutor }: Voice): Promise<ArrayBuffer> {
  return cached("speech", [tutor, language, text], async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, tutor }),
    });
    if (!res.ok) throw new Error("Speech failed");
    return res.arrayBuffer();
  });
}

async function fetchAndDecode(text: string, voice: Voice): Promise<AudioBuffer> {
  return getAudioContext().decodeAudioData(await speechBytes(text, voice));
}

const keyOf = (text: string, v: Voice) => `${v.tutor}:${v.language}:${text}`;

// Shared by prefetch and playback so a replay costs nothing.
export function loadAudio(text: string, voice: Voice): Promise<AudioBuffer> {
  const key = keyOf(text, voice);
  let hit = cache.get(key);
  if (!hit) {
    hit = fetchAndDecode(text, voice);
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

export function prefetchAudio(texts: string[], voice: Voice, maxParallel: number): void {
  for (const text of texts) {
    if (cache.has(keyOf(text, voice))) continue;
    const run = () => {
      activePrefetch++;
      loadAudio(text, voice)
        .catch(() => undefined)
        .finally(() => {
          activePrefetch--;
          waiting.shift()?.();
        });
    };
    if (activePrefetch < maxParallel) run();
    else waiting.push(run);
  }
}

export function cancelPrefetch(): void {
  waiting.length = 0;
}

export function stopAudio(): void {
  current?.stop();
  current = null;
}

// `ended` resolves true only when the clip finished by itself, false when stopped.
export function playBuffer(buffer: AudioBuffer): { ended: Promise<boolean> } {
  stopAudio();
  const c = getAudioContext();
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(analyser!);
  let finish: (v: boolean) => void = () => undefined;
  const ended = new Promise<boolean>((resolve) => (finish = resolve));
  let stopped = false;
  const finishNaturally = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(watchdog);
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already finished.
    }
    source.disconnect();
    if (current === slot) current = null;
    finish(true);
  };
  // A suspended context never fires onended, so the lesson must not depend on it alone.
  const watchdog = window.setTimeout(finishNaturally, buffer.duration * 1000 + TIMING.audioEndGraceMs);
  const slot = {
    source,
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(watchdog);
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
      finish(false);
    },
  };
  source.onended = finishNaturally;
  current = slot;
  source.start();
  return { ended };
}
