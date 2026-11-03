import type { Topic } from "@/lib/types";

export default function TopicList({
  topics,
  current,
  started,
  onPick,
}: {
  topics: Topic[];
  current: number;
  started: boolean;
  onPick: (index: number) => void;
}) {
  const done = topics.filter((t) => t.done).length;
  return (
    <div className="rounded-xl border border-[#d8d0c0] bg-white px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-[#8a7f6a]">
        <span>Topics</span>
        <span>
          {done} of {topics.length} done
        </span>
      </div>
      <ol className="max-h-44 space-y-0.5 overflow-y-auto text-[14px]">
        {topics.map((t, i) => {
          const now = started && i === current;
          return (
            <li
              key={t.id}
              data-testid="topic-item"
              data-done={t.done}
              aria-current={now ? "step" : undefined}
            >
              <button
                type="button"
                onClick={() => onPick(i)}
                className={`flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-[#f6efd9] ${now ? "bg-[#f6efd9] font-semibold text-[#2b2a27]" : "text-[#5b574f]"}`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    t.done ? "border-[#3d7a4f] bg-[#3d7a4f] text-white" : now ? "border-[#c8452f] text-[#c8452f]" : "border-[#c9bfa9]"
                  }`}
                >
                  {t.done ? "✓" : ""}
                </span>
                <span>{t.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
