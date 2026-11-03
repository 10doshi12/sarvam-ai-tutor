"use client";

import { useEffect, useRef } from "react";
import { getLevel } from "@/lib/client/audio";

export type Mood = "neutral" | "asking" | "excited" | "listening" | "thinking" | "happy" | "concerned";

type Pose = { brow: number; browInner: number; browSkew: number; lid: number; smile: number; roll: number; gazeX: number; gazeY: number };

const POSES: Record<Mood, Pose> = {
  neutral: { brow: 0, browInner: 0, browSkew: 0, lid: 1, smile: 0.3, roll: 0, gazeX: 0, gazeY: 0 },
  asking: { brow: 3, browInner: 0, browSkew: 3, lid: 1.08, smile: 0.2, roll: 5, gazeX: 0, gazeY: 0 },
  excited: { brow: 4, browInner: 0, browSkew: 0, lid: 1.12, smile: 0.8, roll: -2, gazeX: 0, gazeY: 0 },
  listening: { brow: 1.5, browInner: 0.5, browSkew: 1, lid: 1.02, smile: 0.35, roll: 6, gazeX: 0, gazeY: 0.2 },
  thinking: { brow: 1.5, browInner: 1, browSkew: 4, lid: 0.82, smile: -0.05, roll: -4, gazeX: 0.8, gazeY: -0.9 },
  happy: { brow: 2.5, browInner: 0, browSkew: 0, lid: 0.72, smile: 1, roll: 3, gazeX: 0, gazeY: 0 },
  concerned: { brow: 0.5, browInner: 3.5, browSkew: 0, lid: 0.95, smile: -0.35, roll: -3, gazeX: 0, gazeY: 0.3 },
};

const BLINK_EVERY_MS = 3400;
const BLINK_FOR_MS = 130;
const LOUD_GAIN = 7;
const EASE = 0.09;
const HAND_HIDDEN = 95;

const SKIN_MID = "#d9a077";

// Everything that moves is written to the DOM each frame, so React never re-renders for it.
export default function Avatar({ speaking, mood }: { speaking: boolean; mood: Mood }) {
  const mouth = useRef<SVGPathElement>(null);
  const mouthClip = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  const face = useRef<SVGGElement>(null);
  const nose = useRef<SVGGElement>(null);
  const hairBack = useRef<SVGGElement>(null);
  const earL = useRef<SVGGElement>(null);
  const earR = useRef<SVGGElement>(null);
  const body = useRef<SVGGElement>(null);
  const arm = useRef<SVGGElement>(null);
  const eyeL = useRef<SVGGElement>(null);
  const eyeR = useRef<SVGGElement>(null);
  const irisL = useRef<SVGGElement>(null);
  const irisR = useRef<SVGGElement>(null);
  const browL = useRef<SVGPathElement>(null);
  const browR = useRef<SVGPathElement>(null);
  const speakingRef = useRef(speaking);
  const moodRef = useRef(mood);

  useEffect(() => {
    speakingRef.current = speaking;
    moodRef.current = mood;
  }, [speaking, mood]);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pose: Pose = { ...POSES.neutral };
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);

    let frame = 0;
    let open = 0;
    let slowOpen = 0;
    let nod = 0;
    let raise = 0;
    let nextBlink = performance.now() + BLINK_EVERY_MS;

    const tick = (now: number) => {
      const talking = speakingRef.current;
      const target = talking ? Math.min(1, Math.max(0, getLevel() * LOUD_GAIN - 0.05)) : 0;
      open += (target - open) * 0.45;
      slowOpen += (open - slowOpen) * 0.06;

      const wanted = POSES[moodRef.current];
      for (const k of Object.keys(pose) as (keyof Pose)[]) pose[k] += (wanted[k] - pose[k]) * EASE;

      // A sudden rise in loudness reads as stress, so the head nods and the brows lift with it.
      nod += (Math.max(0, open - slowOpen - 0.15) * 7 - nod) * 0.12;

      const yaw = calm ? 0 : Math.sin(now / 2300) * (talking ? 2.6 : 1.4) + pointer.x * 1.2;
      const pitch = calm ? 0 : Math.sin(now / 3100) * 0.9 + nod * 2.2;
      const sway = calm ? 0 : Math.sin(now / 1700) * (talking ? 1.1 : 0.5);

      // Parts nearer the viewer shift further than the head, and parts behind it shift the other way.
      head.current?.setAttribute("transform", `translate(${(yaw * 0.9).toFixed(2)} ${pitch.toFixed(2)}) rotate(${(pose.roll + sway).toFixed(2)} 100 150)`);
      face.current?.setAttribute("transform", `translate(${(yaw * 1.5).toFixed(2)} ${(pitch * 0.8).toFixed(2)})`);
      nose.current?.setAttribute("transform", `translate(${(yaw * 1.1).toFixed(2)} ${(pitch * 0.4).toFixed(2)})`);
      hairBack.current?.setAttribute("transform", `translate(${(-yaw * 0.7).toFixed(2)} ${(-pitch * 0.4).toFixed(2)})`);
      earL.current?.setAttribute("transform", `translate(${(-yaw * 0.9).toFixed(2)} ${(-pitch * 0.3).toFixed(2)})`);
      earR.current?.setAttribute("transform", `translate(${(-yaw * 0.9).toFixed(2)} ${(-pitch * 0.3).toFixed(2)})`);
      body.current?.setAttribute("transform", `translate(${(-yaw * 0.35).toFixed(2)} ${(nod * 0.5).toFixed(2)})`);

      // The hand comes up in slow waves while talking and drops away in silence.
      const wave = talking && !calm ? Math.max(0, Math.sin(now / 1300)) * (0.55 + slowOpen) : 0;
      raise += (Math.min(1, wave) - raise) * 0.05;
      arm.current?.setAttribute("transform", `translate(0 ${(HAND_HIDDEN - raise * HAND_HIDDEN).toFixed(2)}) rotate(${(-8 + raise * 12 + Math.sin(now / 420) * raise * 3).toFixed(2)} 160 200)`);

      if (now > nextBlink + BLINK_FOR_MS) nextBlink = now + BLINK_EVERY_MS + Math.random() * 1800;
      const blinking = !calm && now >= nextBlink;
      const lid = blinking ? 0.06 : pose.lid;
      eyeL.current?.setAttribute("transform", `translate(0 90) scale(1 ${lid.toFixed(3)}) translate(0 -90)`);
      eyeR.current?.setAttribute("transform", `translate(0 90) scale(1 ${lid.toFixed(3)}) translate(0 -90)`);

      const gazeX = (pose.gazeX + pointer.x * 0.5 + yaw * 0.06) * 2.6;
      const gazeY = (pose.gazeY + pointer.y * 0.4) * 1.8;
      const gaze = `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`;
      irisL.current?.setAttribute("transform", gaze);
      irisR.current?.setAttribute("transform", gaze);

      const lift = pose.brow + nod * 1.6;
      const liftL = lift + pose.browSkew;
      const liftR = lift - pose.browSkew * 0.3;
      browL.current?.setAttribute("d", `M66 ${(78 - liftL).toFixed(2)} Q77 ${(72 - liftL).toFixed(2)} 89 ${(78 - liftL - pose.browInner).toFixed(2)}`);
      browR.current?.setAttribute("d", `M111 ${(78 - liftR - pose.browInner).toFixed(2)} Q123 ${(72 - liftR).toFixed(2)} 134 ${(78 - liftR).toFixed(2)}`);

      // Width pulls in as the jaw drops; a small flutter stops it reading as one repeated shape.
      const flutter = talking && !calm ? Math.sin(now / 95) * open * 1.3 : 0;
      const half = 13 + pose.smile * 3.5 - open * 3.5 + flutter;
      const cornerY = 118 - pose.smile * 4.5;
      const upper = 117 - open * 2.5 + pose.smile * 1.5;
      const lower = 118 + open * 17 + pose.smile * 4.5 + 1;
      const d = `M${(100 - half).toFixed(2)} ${cornerY.toFixed(2)} Q100 ${upper.toFixed(2)} ${(100 + half).toFixed(2)} ${cornerY.toFixed(2)} Q100 ${lower.toFixed(2)} ${(100 - half).toFixed(2)} ${cornerY.toFixed(2)}Z`;
      mouth.current?.setAttribute("d", d);
      mouthClip.current?.setAttribute("d", d);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <svg viewBox="0 0 200 200" className="block h-full w-full" role="img" aria-label="Your tutor">
      <defs>
        <radialGradient id="av-bg" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#f6efe0" />
          <stop offset="100%" stopColor="#d9cdb6" />
        </radialGradient>
        <radialGradient id="av-skin" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#f5c9a3" />
          <stop offset="55%" stopColor={SKIN_MID} />
          <stop offset="100%" stopColor="#b1754e" />
        </radialGradient>
        <linearGradient id="av-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a86d48" />
          <stop offset="100%" stopColor="#cc9169" />
        </linearGradient>
        <linearGradient id="av-hair" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4a3226" />
          <stop offset="60%" stopColor="#2a1c15" />
          <stop offset="100%" stopColor="#1a100b" />
        </linearGradient>
        <radialGradient id="av-shirt" cx="42%" cy="20%" r="95%">
          <stop offset="0%" stopColor="#4f83b5" />
          <stop offset="65%" stopColor="#2f5d8a" />
          <stop offset="100%" stopColor="#1e4163" />
        </radialGradient>
        <radialGradient id="av-eye" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dcd6cd" />
        </radialGradient>
        <radialGradient id="av-iris" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#8a5a33" />
          <stop offset="100%" stopColor="#2e1a0d" />
        </radialGradient>
        <radialGradient id="av-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0705a" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#e0705a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="av-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b2412" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b2412" stopOpacity="0" />
        </radialGradient>
        <clipPath id="av-mouth-clip">
          <path ref={mouthClip} d="M87 118 Q100 118 113 118 Q100 122 87 118Z" />
        </clipPath>
        <clipPath id="av-eye-l">
          <ellipse cx="77" cy="90" rx="11" ry="7.5" />
        </clipPath>
        <clipPath id="av-eye-r">
          <ellipse cx="123" cy="90" rx="11" ry="7.5" />
        </clipPath>
      </defs>

      <rect width="200" height="200" fill="url(#av-bg)" />
      <ellipse cx="100" cy="196" rx="84" ry="16" fill="url(#av-shadow)" />

      <g ref={body}>
        <path d="M18 204c3-38 28-58 58-62h48c30 4 55 24 58 62z" fill="url(#av-shirt)" />
        <path d="M76 142l24 26 24-26-6-5H82z" fill="#f4efe6" />
        <path d="M84 136c2 14 30 14 32 0v-6H84z" fill="url(#av-neck)" />
        <ellipse cx="100" cy="137" rx="24" ry="9" fill="url(#av-shadow)" />
      </g>

      <g ref={head}>
        <g ref={hairBack}>
          <path d="M51 90c-6-52 18-72 49-72s55 20 49 72c-2 12-8 19-13 21H64c-5-2-11-9-13-21z" fill="url(#av-hair)" />
        </g>
        <g ref={earL}>
          <ellipse cx="55" cy="95" rx="7" ry="11" fill="#c78d63" />
          <path d="M54 88c-3 4-3 10 0 14" stroke="#a06b45" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
        <g ref={earR}>
          <ellipse cx="145" cy="95" rx="7" ry="11" fill="#bb8259" />
          <path d="M146 88c3 4 3 10 0 14" stroke="#986340" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>

        <path d="M55 88c0-34 20-52 45-52s45 18 45 52c0 32-22 53-45 53s-45-21-45-53z" fill="url(#av-skin)" />

        <g ref={face}>
          <ellipse cx="68" cy="108" rx="13" ry="9" fill="url(#av-blush)" />
          <ellipse cx="132" cy="108" rx="13" ry="9" fill="url(#av-blush)" />

          <ellipse cx="77" cy="82" rx="14" ry="5" fill="#8a5a3a" opacity="0.14" />
          <ellipse cx="123" cy="82" rx="14" ry="5" fill="#8a5a3a" opacity="0.14" />

          <g ref={eyeL}>
            <ellipse cx="77" cy="90" rx="11" ry="7.5" fill="url(#av-eye)" />
            <g clipPath="url(#av-eye-l)">
              <g ref={irisL}>
                <circle cx="77" cy="90" r="6.2" fill="url(#av-iris)" />
                <circle cx="77" cy="90" r="2.9" fill="#0f0805" />
                <circle cx="74.8" cy="87.6" r="1.7" fill="#ffffff" />
              </g>
            </g>
            <path d="M66 89q11-9 22 0" stroke="#22140c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
          <g ref={eyeR}>
            <ellipse cx="123" cy="90" rx="11" ry="7.5" fill="url(#av-eye)" />
            <g clipPath="url(#av-eye-r)">
              <g ref={irisR}>
                <circle cx="123" cy="90" r="6.2" fill="url(#av-iris)" />
                <circle cx="123" cy="90" r="2.9" fill="#0f0805" />
                <circle cx="120.8" cy="87.6" r="1.7" fill="#ffffff" />
              </g>
            </g>
            <path d="M112 89q11-9 22 0" stroke="#22140c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>

          <path ref={browL} d="M66 78 Q77 72 89 78" stroke="#2a1c15" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path ref={browR} d="M111 78 Q123 72 134 78" stroke="#2a1c15" strokeWidth="3.4" fill="none" strokeLinecap="round" />

          <g ref={nose}>
            <path d="M100 88c-2 7-5 13-5 16 0 3 3 4 5 4s6-1 6-4c0-2-1-4-2-6" fill="#b87d55" opacity="0.35" />
            <ellipse cx="98" cy="96" rx="1.8" ry="6" fill="#ffe2c6" opacity="0.5" />
            <path d="M93 105q3 3 7 3t7-3" stroke="#8f5a39" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>

          <path ref={mouth} d="M87 118 Q100 118 113 118 Q100 122 87 118Z" fill="#4f1712" stroke="#a84a3e" strokeWidth="2.4" strokeLinejoin="round" />
          <g clipPath="url(#av-mouth-clip)">
            <rect x="82" y="112" width="36" height="8" rx="2" fill="#f7f2ea" />
            <ellipse cx="100" cy="136" rx="10" ry="9" fill="#b9524a" />
          </g>
        </g>

        <path d="M55 88c-2-34 20-56 45-56s47 22 45 56c-4-16-14-28-27-32-13 8-40 10-52 7-6 6-10 15-11 25z" fill="url(#av-hair)" />
        <path d="M78 42c10-6 28-8 42-2" stroke="#7b5a45" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
      </g>

      <g ref={arm} transform={`translate(0 ${HAND_HIDDEN})`}>
        <path d="M150 210c2-20 6-34 12-42l20 6c-2 14-4 26-4 38z" fill="url(#av-shirt)" />
        <ellipse cx="172" cy="160" rx="13" ry="15" fill="url(#av-skin)" />
        <path d="M162 150l-3-14M169 146l-1-16M176 146l2-15M183 151l4-12" stroke={SKIN_MID} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M160 163l-11-7" stroke={SKIN_MID} strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
