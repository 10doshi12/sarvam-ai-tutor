import { getAudioContext } from "./audio";

export interface RecordedAudio {
  blob: Blob;
  filename: string;
}

export interface Recording {
  stop: () => Promise<RecordedAudio | null>;
  cancel: () => void;
}

export interface RecordOptions {
  maxMs: number;
  silenceMs: number;
  silenceLevel: number;
  onAutoStop: (audio: RecordedAudio | null) => void;
}

// WebKit records MP4 and Chromium WebM, so take the first one this browser supports.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
const POLL_MS = 100;

export function recordingAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export async function startRecording(opts: RecordOptions): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const meter = ctx.createAnalyser();
  meter.fftSize = 512;
  source.connect(meter);
  const samples = new Uint8Array(meter.fftSize);

  let discard = false;
  let result: Promise<RecordedAudio | null> | null = null;
  let timers: number[] = [];

  const cleanup = () => {
    timers.forEach((t) => window.clearInterval(t));
    timers = [];
    window.clearTimeout(limitTimer);
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };

  const finish = (): Promise<RecordedAudio | null> => {
    if (result) return result;
    result = new Promise((resolve) => {
      const done = () => {
        cleanup();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        resolve(discard || blob.size === 0 ? null : { blob, filename: `doubt.${extensionFor(type)}` });
      };
      if (recorder.state === "inactive") done();
      else {
        recorder.onstop = done;
        recorder.stop();
      }
    });
    return result;
  };

  const auto = () => void finish().then(opts.onAutoStop);

  let heardSpeech = false;
  let quietSince = 0;
  timers.push(
    window.setInterval(() => {
      meter.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      const level = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (level >= opts.silenceLevel) {
        heardSpeech = true;
        quietSince = 0;
      } else if (heardSpeech) {
        quietSince ||= now;
        if (now - quietSince >= opts.silenceMs) auto();
      }
    }, POLL_MS),
  );
  const limitTimer = window.setTimeout(auto, opts.maxMs);

  recorder.start();
  return {
    stop: finish,
    cancel: () => {
      discard = true;
      void finish();
    },
  };
}
