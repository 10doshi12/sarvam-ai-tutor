import type { Quiz } from "@/lib/types";
import Icon from "@/components/ui/Icon";

// One question; after a pick, the right option and a wrong pick are marked by icon as well as colour.
export default function QuizPanel({
  quiz,
  selected,
  onPick,
  onNext,
}: {
  quiz: Quiz;
  selected: number | null;
  onPick: (index: number) => void;
  onNext: () => void;
}) {
  const answered = selected !== null;
  return (
    <div className="board-scrim absolute inset-0 z-10 flex items-center justify-center overflow-y-auto p-4">
      <div className="glass my-auto w-full max-w-xl p-5 sm:p-6">
        <p className="nb-label text-accent-deep">Quick question</p>
        <h3 className="mt-1 mb-4 text-xl leading-snug font-bold tracking-tight">{quiz.question}</h3>
        <div className="grid gap-2.5">
          {quiz.options.map((option, i) => {
            const right = answered && i === quiz.correctIndex;
            const wrong = answered && i === selected && i !== quiz.correctIndex;
            return (
              <button
                key={i}
                type="button"
                data-testid="quiz-option"
                data-result={right ? "right" : wrong ? "wrong" : undefined}
                disabled={answered}
                onClick={() => onPick(i)}
                className={`flex min-h-11 items-center gap-3 rounded-lg border-2 border-ink px-3 py-2 text-left transition-transform ${
                  right
                    ? "bg-success-soft font-bold text-success"
                    : wrong
                      ? "bg-danger-soft font-bold text-danger"
                      : answered
                        ? "bg-surface/70 text-muted"
                        : "bg-surface hover:-translate-y-px hover:bg-accent"
                }`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-current text-xs font-bold">
                  {right ? <Icon name="check" size={14} /> : wrong ? <Icon name="x" size={14} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">{option}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-[15px] leading-snug" role="status">
              <b>{selected === quiz.correctIndex ? "Correct. " : "Not quite. "}</b>
              {quiz.explanation}
            </p>
            <button type="button" data-testid="quiz-next" onClick={onNext} className="nb-btn nb-btn-primary shrink-0">
              Continue <Icon name="arrow" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
