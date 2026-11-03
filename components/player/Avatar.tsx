"use client";

import { useEffect, useId, useRef } from "react";
import { getLevel } from "@/lib/client/audio";
import type { TutorId } from "@/lib/types";

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
const ARM_REST = 34;

type Look = {
  skin: [string, string, string];
  neck: [string, string];
  ear: string;
  earLine: string;
  hair: [string, string, string];
  hairBack: string;
  hairFront: string;
  sheen: string;
  sheenColor: string;
  brow: string;
  browWidth: number;
  lip: string;
  iris: string;
  coat: [string, string];
  trim: [string, string];
  inner: [string, string];
  collar: boolean;
  body: "coat" | "hoodie" | "cardigan";
  glasses: "square" | "round" | null;
  beard: boolean;
  feminine: boolean;
  hand: "phone" | "open";
};

const LOOKS: Record<TutorId, Look> = {
  // Older, trim beard, square glasses, teal coat.
  arjun: {
    skin: ["#fbdcc0", "#eeba94", "#cf9268"],
    neck: ["#b97f58", "#dca67e"],
    ear: "#e3aa82",
    earLine: "#b97f58",
    hair: ["#a4703f", "#7a4d2a", "#54331c"],
    hairBack: "M56 84c-5-40 16-62 44-62s49 22 44 62l-6 14H62z",
    hairFront: "M54 92c-4-14-3-30 5-42-1-4 0-9 4-13 0 3 2 5 4 6 3-9 11-16 20-18-1 3 0 5 2 6 9-6 22-7 32-2 9 4 15 11 18 19 3 2 5 5 6 9 3 9 3 22 0 35-2-9-5-17-9-23-8-3-13-8-16-15-10 7-27 10-43 7-9 6-16 18-23 31z",
    sheen: "M74 44c10-9 25-13 40-9M84 54c12-7 26-10 40-6M66 62c3-7 8-13 14-17",
    sheenColor: "#c49160",
    brow: "#6b4426",
    browWidth: 4.2,
    lip: "#a85a48",
    iris: "#7d8f8b",
    coat: ["#6f8c87", "#465f5c"],
    trim: ["#8fa9a4", "#6a8580"],
    inner: ["#d97c35", "#b85f22"],
    collar: true,
    body: "coat",
    glasses: "square",
    beard: true,
    feminine: false,
    hand: "phone",
  },
  // Younger, clean shaven, short dark hair, hoodie.
  rohan: {
    skin: ["#f3cda6", "#dfa878", "#bd8054"],
    neck: ["#a66f47", "#cb946a"],
    ear: "#d59e72",
    earLine: "#a66f47",
    hair: ["#3a3a40", "#1f1f24", "#0f0f12"],
    hairBack: "M57 82c-4-32 15-52 43-52s47 20 43 52l-4 10H61z",
    hairFront: "M55 88c-2-14 0-28 8-38 9-12 23-17 38-17 19 0 36 12 40 30 2 8 3 17 1 25-2-9-6-16-12-21-9 3-26 2-40-4-7 7-15 10-21 11-7 3-11 7-14 14z",
    sheen: "M72 50c9-8 21-11 34-9M100 44c12-1 24 4 31 13",
    sheenColor: "#5d5d68",
    brow: "#1f1f24",
    browWidth: 3.8,
    lip: "#a4574a",
    iris: "#5a3a22",
    coat: ["#3f4a5e", "#262e3d"],
    trim: ["#57637a", "#3f4a5e"],
    inner: ["#ffffff", "#e6e6ea"],
    collar: false,
    body: "hoodie",
    glasses: null,
    beard: false,
    feminine: false,
    hand: "phone",
  },
  // Long dark hair, navy blazer over a coral blouse.
  meera: {
    skin: ["#f6d2ae", "#e4ae80", "#c2865a"],
    neck: ["#ad7650", "#d29b70"],
    ear: "#dba679",
    earLine: "#ad7650",
    hair: ["#4a3128", "#2c1a14", "#170c08"],
    hairBack: "M50 92c-6-42 18-70 50-70s56 28 50 70c2 26 6 44 14 58-8 8-24 10-36 8l-6-40H78l-6 40c-12 2-28 0-36-8 8-14 12-32 14-58z",
    hairFront: "M54 94c-2-34 18-60 46-60s48 26 46 60c-4-15-10-25-20-31-16 2-34-5-42-15-8 9-23 25-30 46z",
    sheen: "M72 52c6-6 13-11 21-13M108 40c12 2 22 9 28 20",
    sheenColor: "#7a5a4c",
    brow: "#2c1a14",
    browWidth: 3,
    lip: "#b5473f",
    iris: "#4a2c16",
    coat: ["#3c4a7d", "#252f58"],
    trim: ["#52619a", "#3c4a7d"],
    inner: ["#ec8268", "#d4644a"],
    collar: false,
    body: "coat",
    glasses: null,
    beard: false,
    feminine: true,
    hand: "open",
  },
  // Chin-length bob with a fringe, round glasses, white cardigan.
  anaya: {
    skin: ["#fbdfc4", "#efc09a", "#d29a70"],
    neck: ["#bf8960", "#e0ac84"],
    ear: "#e6b48c",
    earLine: "#bf8960",
    hair: ["#8c4f2c", "#62331b", "#3f1f10"],
    hairBack: "M50 88c-6-38 20-64 50-64s56 26 50 64c2 16 4 28 8 38-9 7-22 7-30 2V96H72v32c-8 5-21 5-30-2 4-10 6-22 8-38z",
    hairFront: "M56 82c0-27 20-48 44-48s44 21 44 48c-6-8-14-14-24-16-13 5-30 5-42 0-10 2-17 8-22 16z",
    sheen: "M72 48c12-8 30-10 46-3",
    sheenColor: "#b57a50",
    brow: "#4a2614",
    browWidth: 3,
    lip: "#bb5148",
    iris: "#5f3a1e",
    coat: ["#ffffff", "#dddde4"],
    trim: ["#f2f2f6", "#cfcfd8"],
    inner: ["#2f8f7f", "#1f6f61"],
    collar: false,
    body: "cardigan",
    glasses: "round",
    beard: false,
    feminine: true,
    hand: "open",
  },
};

// Everything that moves is written to the DOM each frame, so React never re-renders for it.
export default function Avatar({ speaking, mood, tutor = "arjun" }: { speaking: boolean; mood: Mood; tutor?: TutorId }) {
  const look = LOOKS[tutor];
  // Unique per instance: several avatars can share a page, and their gradients must not collide.
  const uid = useId();
  const defId = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${uid}-${name})`;
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
      face.current?.setAttribute("transform", `translate(${yaw.toFixed(2)} ${(pitch * 0.6).toFixed(2)})`);
      nose.current?.setAttribute("transform", `translate(${(yaw * 0.6).toFixed(2)} ${(pitch * 0.3).toFixed(2)})`);
      hairBack.current?.setAttribute("transform", `translate(${(-yaw * 0.7).toFixed(2)} ${(-pitch * 0.4).toFixed(2)})`);
      earL.current?.setAttribute("transform", `translate(${(-yaw * 0.9).toFixed(2)} ${(-pitch * 0.3).toFixed(2)})`);
      earR.current?.setAttribute("transform", `translate(${(-yaw * 0.9).toFixed(2)} ${(-pitch * 0.3).toFixed(2)})`);
      body.current?.setAttribute("transform", `translate(${(-yaw * 0.35).toFixed(2)} ${(nod * 0.5).toFixed(2)})`);

      // The phone hand lifts in slow waves while talking and settles in silence.
      const wave = talking && !calm ? Math.max(0, Math.sin(now / 1300)) * (0.55 + slowOpen) : 0;
      raise += (Math.min(1, wave) - raise) * 0.05;
      arm.current?.setAttribute("transform", `translate(0 ${(ARM_REST - raise * ARM_REST).toFixed(2)}) rotate(${(6 - raise * 10 - Math.sin(now / 420) * raise * 2.5).toFixed(2)} 30 210)`);

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
      browL.current?.setAttribute("d", `M64 ${(72 - liftL).toFixed(2)} Q76 ${(64 - liftL).toFixed(2)} 90 ${(71 - liftL - pose.browInner).toFixed(2)}`);
      browR.current?.setAttribute("d", `M110 ${(71 - liftR - pose.browInner).toFixed(2)} Q124 ${(64 - liftR).toFixed(2)} 136 ${(72 - liftR).toFixed(2)}`);

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

  const stops = (colors: readonly string[]) =>
    colors.map((c, n) => <stop key={c + n} offset={`${(n * 100) / Math.max(1, colors.length - 1)}%`} stopColor={c} />);

  return (
    <svg viewBox="0 0 200 200" className="block h-full w-full" role="img" aria-label="Your tutor">
      <defs>
        <radialGradient id={defId("skin")} cx="42%" cy="32%" r="75%">
          {stops(look.skin)}
        </radialGradient>
        <linearGradient id={defId("neck")} x1="0" y1="0" x2="0" y2="1">
          {stops(look.neck)}
        </linearGradient>
        <linearGradient id={defId("hair")} x1="0.15" y1="0" x2="0.85" y2="1">
          {stops(look.hair)}
        </linearGradient>
        <linearGradient id={defId("beard")} x1="0" y1="0" x2="0" y2="1">
          {stops(["#8a5c36", "#6b4526"])}
        </linearGradient>
        <linearGradient id={defId("coat")} x1="0.1" y1="0" x2="0.9" y2="1">
          {stops(look.coat)}
        </linearGradient>
        <linearGradient id={defId("trim")} x1="0" y1="0" x2="1" y2="1">
          {stops(look.trim)}
        </linearGradient>
        <linearGradient id={defId("inner")} x1="0" y1="0" x2="0" y2="1">
          {stops(look.inner)}
        </linearGradient>
        <radialGradient id={defId("eye")} cx="45%" cy="40%" r="65%">
          {stops(["#ffffff", "#e2ddd4"])}
        </radialGradient>
        <radialGradient id={defId("iris")} cx="40%" cy="35%" r="70%">
          {stops([look.iris, "#1f140c"])}
        </radialGradient>
        <radialGradient id={defId("blush")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0705a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#e0705a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={defId("shadow")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b2412" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b2412" stopOpacity="0" />
        </radialGradient>
        <clipPath id={defId("mouth")}>
          <path ref={mouthClip} d="M87 118 Q100 118 113 118 Q100 122 87 118Z" />
        </clipPath>
        <clipPath id={defId("eye-l")}>
          <ellipse cx="77" cy="90" rx="10.5" ry="9" />
        </clipPath>
        <clipPath id={defId("eye-r")}>
          <ellipse cx="123" cy="90" rx="10.5" ry="9" />
        </clipPath>
      </defs>

      <g ref={body}>
        <path d="M84 126h32v22c-8 8-24 8-32 0z" fill={url("neck")} />
        <path d="M78 150h44l-6 60H84z" fill={url("inner")} />
        {look.collar && (
          <>
            <path d="M82 142l18 15-9 13-15-20z" fill="#5f7c8e" />
            <path d="M118 142l-18 15 9 13 15-20z" fill="#4f6a7c" />
            <path d="M100 157l-4 6 4 12 4-12z" fill="#435a6a" />
          </>
        )}
        {look.body === "coat" && (
          <>
            <path d="M28 212c2-38 20-58 52-64l10 62z" fill={url("coat")} />
            <path d="M172 212c-2-38-20-58-52-64l-10 62z" fill={url("coat")} />
            <path d="M78 147l-11 22 11 3-7 8 21 30-3-34z" fill={url("trim")} />
            <path d="M122 147l11 22-11 3 7 8-21 30 3-34z" fill={url("trim")} />
          </>
        )}
        {look.body === "hoodie" && (
          <>
            <path d="M28 212c2-38 20-58 50-64l22 22 22-22c30 6 48 26 50 64z" fill={url("coat")} />
            <path d="M72 150c-2-8 2-14 10-16l18 26 18-26c8 2 12 8 10 16l-28 28z" fill={url("trim")} />
            <path d="M93 172l-2 22M107 172l2 22" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {look.body === "cardigan" && (
          <>
            <path d="M28 212c2-38 20-58 50-64l6 62z" fill={url("coat")} />
            <path d="M172 212c-2-38-20-58-50-64l-6 62z" fill={url("coat")} />
            <path d="M78 148l6 62h4l-4-62zM122 148l-6 62h-4l4-62z" fill={url("trim")} />
          </>
        )}
        <ellipse cx="100" cy="143" rx="22" ry="7" fill={url("shadow")} />
      </g>

      <g ref={head}>
        <g ref={hairBack}>
          <path d={look.hairBack} fill={look.hair[2]} />
        </g>
        <g ref={earL}>
          <ellipse cx="55" cy="96" rx="8" ry="11.5" fill={look.ear} />
          <path d="M53 89c-3 4-3 10 0 14" stroke={look.earLine} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {look.feminine && <circle cx="54" cy="110" r="2.6" fill="#f4f4f8" stroke="#00000055" strokeWidth="0.6" />}
        </g>
        <g ref={earR}>
          <ellipse cx="145" cy="96" rx="8" ry="11.5" fill={look.ear} />
          <path d="M147 89c3 4 3 10 0 14" stroke={look.earLine} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {look.feminine && <circle cx="146" cy="110" r="2.6" fill="#f4f4f8" stroke="#00000055" strokeWidth="0.6" />}
        </g>

        <path d="M56 84c0-30 19-48 44-48s44 18 44 48c0 40-20 62-44 62s-44-22-44-62z" fill={url("skin")} />

        {/* A trim band along the jaw, thicker at the chin, so the cheeks stay clear. */}
        {look.beard && (
          <path d="M57 98c2 27 21 49 43 49s41-22 43-49c-3 11-9 20-17 25-7 4-14 7-26 7s-19-3-26-7c-8-5-14-14-17-25z" fill={url("beard")} />
        )}

        <g ref={face}>
          <ellipse cx="66" cy="104" rx="10" ry="6" fill={url("blush")} />
          <ellipse cx="134" cy="104" rx="10" ry="6" fill={url("blush")} />

          <g ref={eyeL}>
            <ellipse cx="77" cy="90" rx="10.5" ry="9" fill={url("eye")} />
            <g clipPath={url("eye-l")}>
              <g ref={irisL}>
                <circle cx="77" cy="90" r="6.4" fill={url("iris")} />
                <circle cx="77" cy="90" r="3" fill="#0f0805" />
                <circle cx="74.6" cy="87.4" r="1.8" fill="#ffffff" />
              </g>
            </g>
            <path d="M66.5 88q10.5-9.5 21 0" stroke={look.brow} strokeWidth={look.feminine ? 2.4 : 1.8} fill="none" strokeLinecap="round" />
          </g>
          <g ref={eyeR}>
            <ellipse cx="123" cy="90" rx="10.5" ry="9" fill={url("eye")} />
            <g clipPath={url("eye-r")}>
              <g ref={irisR}>
                <circle cx="123" cy="90" r="6.4" fill={url("iris")} />
                <circle cx="123" cy="90" r="3" fill="#0f0805" />
                <circle cx="120.6" cy="87.4" r="1.8" fill="#ffffff" />
              </g>
            </g>
            <path d="M112.5 88q10.5-9.5 21 0" stroke={look.brow} strokeWidth={look.feminine ? 2.4 : 1.8} fill="none" strokeLinecap="round" />
          </g>

          <path ref={browL} d="M64 72 Q76 64 90 71" stroke={look.brow} strokeWidth={look.browWidth} fill="none" strokeLinecap="round" />
          <path ref={browR} d="M110 71 Q124 64 136 72" stroke={look.brow} strokeWidth={look.browWidth} fill="none" strokeLinecap="round" />

          <g ref={nose}>
            <ellipse cx="100" cy="102" rx={look.feminine ? 6 : 8.5} ry={look.feminine ? 5.5 : 7} fill={look.skin[2]} opacity="0.45" />
            <ellipse cx="97.5" cy="99.5" rx="2.6" ry="2.2" fill={look.skin[0]} opacity="0.85" />
            <path d="M94 106q6 3.5 12 0" stroke={look.neck[0]} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>

          {look.beard && <path d="M86 113c4-3 10-4 14-2 4-2 10-1 14 2-5 1-10 1-14 0-4 1-9 1-14 0z" fill="#6b4526" />}
          <path ref={mouth} d="M87 118 Q100 118 113 118 Q100 122 87 118Z" fill="#4f1712" stroke={look.lip} strokeWidth="2.2" strokeLinejoin="round" />
          <g clipPath={url("mouth")}>
            <rect x="82" y="112" width="36" height="8" rx="2" fill="#f7f2ea" />
            <ellipse cx="100" cy="136" rx="10" ry="9" fill="#b9524a" />
          </g>

          {look.glasses === "square" && (
            <g fill="none" stroke="#1f2124" strokeLinejoin="round">
              <rect x="62" y="78" width="30" height="25" rx="9" strokeWidth="4" fill="#ffffff" fillOpacity="0.08" />
              <rect x="108" y="78" width="30" height="25" rx="9" strokeWidth="4" fill="#ffffff" fillOpacity="0.08" />
              <path d="M92 87q8-4 16 0" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M62 85l-8 2M138 85l8 2" strokeWidth="3.4" strokeLinecap="round" />
            </g>
          )}
          {look.glasses === "round" && (
            <g fill="none" stroke="#3a2a22">
              <circle cx="77" cy="90" r="14.5" strokeWidth="2.2" fill="#ffffff" fillOpacity="0.08" />
              <circle cx="123" cy="90" r="14.5" strokeWidth="2.2" fill="#ffffff" fillOpacity="0.08" />
              <path d="M91.5 88q8.5-3.5 17 0M62.5 88l-8 1M137.5 88l8 1" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
        </g>

        <path d={look.hairFront} fill={url("hair")} />
        <path d={look.sheen} stroke={look.sheenColor} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />
      </g>

      <g ref={arm} transform={`translate(0 ${ARM_REST})`}>
        <path d="M18 216c-2-22 2-40 12-54l24 8c-6 14-9 30-8 46z" fill={url("coat")} />
        <path d="M29 164l26 8-2 8-27-9z" fill={url("trim")} />
        {look.hand === "phone" && (
          <>
            <g transform="rotate(-8 44 140)">
              <rect x="33" y="118" width="22" height="38" rx="4" fill="#23262b" />
              <rect x="35.5" y="121" width="17" height="32" rx="2" fill="#3a3f46" />
              <circle cx="39" cy="124.5" r="1.4" fill="#8b929c" />
            </g>
            <ellipse cx="43" cy="154" rx="13" ry="14" fill={url("skin")} />
            <path d="M36 142l14 3M34 149l17 3M34 156l16 3" stroke={look.skin[1]} strokeWidth="5" strokeLinecap="round" />
            <path d="M31 150c-2-5-1-11 3-14" stroke={look.skin[1]} strokeWidth="6" strokeLinecap="round" fill="none" />
          </>
        )}
        {look.hand === "open" && (
          <>
            <ellipse cx="43" cy="152" rx="12.5" ry="14" fill={url("skin")} />
            <path d="M34 142l-3-14M41 139l-1-16M48 139l2-15M54 144l5-11M33 154l-11-7" stroke={look.skin[1]} strokeWidth="5.2" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}
