import type { Topic } from "@/lib/types";
import Icon from "@/components/ui/Icon";

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
    <div className="nb-card flex flex-col p-3 lg:min-h-0 lg:flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="nb-label">Topics</span>
        <span className="text-sm text-muted">
          {done} of {topics.length} done
        </span>
      </div>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {topics.map((t, i) => {
          const now = started && i === current;
          return (
            <li key={t.id} data-testid="topic-item" data-done={t.done}>
              <button
                type="button"
                aria-current={now ? "step" : undefined}
                onClick={() => onPick(i)}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg border-2 px-2 py-1.5 text-left text-[15px] leading-snug transition-colors ${
                  now ? "border-ink bg-accent font-bold" : "border-transparent hover:border-ink"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink text-xs font-bold ${
                    t.done ? "bg-ink text-surface" : "bg-surface"
                  }`}
                >
                  {t.done ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span className="min-w-0">{t.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
