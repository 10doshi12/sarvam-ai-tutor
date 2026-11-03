"use client";

import { useEffect, useState } from "react";

export interface CaptionOption {
  code: string;
  name: string;
}

const cache = new Map<string, string>();

// Shows the sentence being spoken, optionally translated to another language.
export default function Captions({
  text,
  options,
  lessonLanguage,
}: {
  text: string;
  options: CaptionOption[];
  lessonLanguage: string;
}) {
  const [target, setTarget] = useState("off");
  const [translated, setTranslated] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (target === "off" || target === lessonLanguage || !text) return;
    const key = `${target}:${text}`;
    if (cache.has(key)) return;
    let live = true;
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { text?: string } | null) => {
        if (!live || !d?.text) return;
        cache.set(key, d.text);
        setTranslated({ key, text: d.text });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [text, target, lessonLanguage]);

  const wanted = `${target}:${text}`;
  const fresh = translated?.key === wanted ? translated.text : cache.get(wanted);
  const shown = target !== "off" && target !== lessonLanguage ? (fresh ?? text) : text;

  return (
    <div className="rounded-xl border border-[#d8d0c0] bg-white px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#8a7f6a]">
        <span>Caption</span>
        <select
          aria-label="Caption language"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-md border border-[#d8d0c0] bg-[#faf7f0] px-1.5 py-0.5 text-[11px] normal-case tracking-normal text-[#2b2a27]"
        >
          <option value="off">Same language</option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <p data-testid="caption" className="min-h-[3.2em] text-[15px] leading-snug text-[#2b2a27]" lang={target === "off" ? lessonLanguage : target}>
        {shown}
      </p>
    </div>
  );
}
