import type { Quiz } from "@/lib/types";

// One question; after a pick, the right option goes green and the wrong pick red.
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
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#17322b]/85 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#faf7f0] p-5 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a7f6a]">Quick question</p>
        <h3 className="mb-3 mt-1 text-lg font-semibold text-[#2b2a27]">{quiz.question}</h3>
        <div className="grid gap-2">
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
                className={`rounded-xl border px-4 py-2.5 text-left text-[15px] transition ${
                  right
                    ? "border-[#3d7a4f] bg-[#e3f1e6] text-[#1f4d2e]"
                    : wrong
                      ? "border-[#c8452f] bg-[#fbe6e1] text-[#8a2a1a]"
                      : "border-[#d8d0c0] bg-white text-[#2b2a27] hover:border-[#8a6a43] disabled:opacity-60"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <p className="mt-3 text-sm text-[#5b574f]" role="status">
              <b>{selected === quiz.correctIndex ? "Correct. " : "Not quite. "}</b>
              {quiz.explanation}
            </p>
            <button
              type="button"
              data-testid="quiz-next"
              onClick={onNext}
              className="mt-3 rounded-full bg-[#c8452f] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#b23c28]"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
