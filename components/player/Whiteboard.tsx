"use client";

import { useEffect, useMemo, useRef } from "react";
import katex from "katex";
import type { BoardItem } from "@/lib/types";

export interface BoardEntry {
  key: string;
  item: BoardItem;
  delayMs: number;
  durationMs: number;
}

const BOX_H = 40;
const GAP_X = 56;
const GAP_Y = 22;
const CHAR_W = 8;

function Diagram({ item }: { item: BoardItem }) {
  const layout = useMemo(() => {
    const nodes = item.nodes ?? [];
    const edges = item.edges ?? [];
    const layer = new Map(nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < nodes.length; pass++) {
      for (const e of edges) {
        const from = layer.get(e.from);
        const to = layer.get(e.to);
        if (from !== undefined && to !== undefined && to <= from && from < nodes.length) layer.set(e.to, from + 1);
      }
    }
    const boxW = Math.max(110, ...nodes.map((n) => n.label.length * CHAR_W + 24));
    const rows = new Map<number, number>();
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      const l = layer.get(n.id) ?? 0;
      const r = rows.get(l) ?? 0;
      rows.set(l, r + 1);
      pos.set(n.id, { x: l * (boxW + GAP_X), y: r * (BOX_H + GAP_Y) });
    }
    const cols = Math.max(1, ...[...layer.values()].map((v) => v + 1));
    const tall = Math.max(1, ...rows.values());
    return { nodes, edges, pos, boxW, width: cols * boxW + (cols - 1) * GAP_X, height: tall * BOX_H + (tall - 1) * GAP_Y };
  }, [item]);

  const { nodes, edges, pos, boxW, width, height } = layout;
  return (
    <svg viewBox={`-4 -4 ${width + 8} ${height + 8}`} className="my-2 w-full max-w-[640px]" style={{ maxHeight: 260 }} role="img">
      <defs>
        <marker id="wb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="var(--color-chalk-line)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + boxW;
        const y1 = a.y + BOX_H / 2;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={b.x} y2={b.y + BOX_H / 2} stroke="var(--color-chalk-line)" strokeWidth="2" markerEnd="url(#wb-arrow)" />
            {e.label && (
              <text x={(x1 + b.x) / 2} y={(y1 + b.y + BOX_H / 2) / 2 - 5} fill="var(--color-chalk-accent)" fontSize="12" textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        return (
          <g key={n.id}>
            <rect x={p.x} y={p.y} width={boxW} height={BOX_H} rx="8" fill="none" stroke="var(--color-chalk)" strokeWidth="2" />
            <text x={p.x + boxW / 2} y={p.y + BOX_H / 2 + 5} fill="var(--color-chalk)" fontSize="15" textAnchor="middle">
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Item({ item }: { item: BoardItem }) {
  switch (item.kind) {
    case "heading":
      return <h4 className="text-[1.35em] font-bold text-chalk-accent">{item.text}</h4>;
    case "bullet":
      return (
        <p className="pl-5 -indent-4 leading-snug before:mr-2 before:text-chalk-accent before:content-['•']">{item.text}</p>
      );
    case "equation":
      return item.latex ? (
        <div
          className="overflow-x-auto py-1 text-[1.25em]"
          dangerouslySetInnerHTML={{ __html: katex.renderToString(item.latex, { throwOnError: false, displayMode: true }) }}
        />
      ) : (
        <p>{item.text}</p>
      );
    case "diagram":
      return <Diagram item={item} />;
    default:
      return <p className="leading-snug">{item.text}</p>;
  }
}

// Each entry is revealed left to right over its duration, like handwriting.
export default function Whiteboard({ entries, variant = "board" }: { entries: BoardEntry[]; variant?: "board" | "answer" }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: calm ? "auto" : "smooth" }), 150);
    return () => window.clearTimeout(timer);
  }, [entries.length]);

  return (
    <div
      ref={scroller}
      data-testid={variant === "board" ? "board" : "answer-overlay"}
      className="wb-scroll h-full overflow-y-auto overflow-x-hidden p-[4%] text-[clamp(15px,1.7vw,22px)] text-chalk"
      style={{ fontFamily: "var(--font-board), 'Bradley Hand', 'Segoe Print', cursive" }}
    >
      <style>{`
        @keyframes wb-write { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        .wb-item { animation-name: wb-write; animation-fill-mode: both; animation-timing-function: steps(28, end); margin-bottom: .55em; }
        .wb-scroll::-webkit-scrollbar { width: 6px; }
        .wb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 3px; }
        @media (prefers-reduced-motion: reduce) { .wb-item { animation: none; } }
      `}</style>
      {entries.map((e) => (
        <div key={e.key} className="wb-item" style={{ animationDuration: `${e.durationMs}ms`, animationDelay: `${e.delayMs}ms` }}>
          <Item item={e.item} />
        </div>
      ))}
    </div>
  );
}
