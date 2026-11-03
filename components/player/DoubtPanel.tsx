"use client";

export type DoubtPhase = "listening" | "thinking";

// Text box is always present; the mic is optional.
export default function DoubtPanel({
  phase,
  mic,
  text,
  notice,
  canRetry,
  onText,
  onSend,
  onCancel,
  onRetry,
}: {
  phase: DoubtPhase;
  mic: "recording" | "unavailable";
  text: string;
  notice: string | null;
  canRetry: boolean;
  onText: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const thinking = phase === "thinking";
  return (
    <div className="rounded-xl border border-[#c8452f]/40 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2b2a27]" role="status">
        {thinking ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#8a6a43]" /> Thinking about your doubt
          </>
        ) : mic === "recording" ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#c8452f]" /> Listening. Speak, then press Send.
          </>
        ) : (
          <>Type your doubt below.</>
        )}
      </div>
      {notice && (
        <p className="mb-2 rounded-md bg-[#fbe6e1] px-2 py-1.5 text-[13px] text-[#8a2a1a]">
          {notice}{" "}
          {canRetry && (
            <button type="button" onClick={onRetry} className="font-semibold underline">
              Try again
            </button>
          )}
        </p>
      )}
      <textarea
        data-testid="doubt-input"
        value={text}
        disabled={thinking}
        rows={2}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Type your doubt here"
        className="w-full resize-none rounded-lg border border-[#d8d0c0] bg-[#faf7f0] px-2.5 py-2 text-[15px] text-[#2b2a27] outline-none focus:border-[#8a6a43]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="doubt-send"
          disabled={thinking}
          onClick={onSend}
          className="flex-1 rounded-full bg-[#c8452f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-[#d8d0c0] px-4 py-2 text-sm text-[#5b574f]">
          Cancel
        </button>
      </div>
    </div>
  );
}
