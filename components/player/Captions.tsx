"use client";

import { useEffect, useState } from "react";
import { cached } from "@/lib/client/cache";

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
    cached("caption", [target, text], async () => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target }),
      });
      const data = res.ok ? ((await res.json()) as { text?: string }) : null;
      if (!data?.text) throw new Error("Translation failed");
      return data.text;
    })
      .then((done) => {
        if (!live) return;
        cache.set(key, done);
        setTranslated({ key, text: done });
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
    <div className="nb-card flex shrink-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <p data-testid="caption" aria-live="off" className="min-h-[3em] flex-1 text-[17px] leading-normal" lang={target === "off" ? lessonLanguage : target}>
        {shown}
      </p>
      <select
        aria-label="Caption language"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="nb-field shrink-0 text-sm sm:w-40"
      >
        <option value="off">Same language</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
