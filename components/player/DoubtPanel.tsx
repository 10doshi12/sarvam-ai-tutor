"use client";

import Icon from "@/components/ui/Icon";

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
    <div className="nb-card max-h-[70dvh] overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold" role="status">
        {thinking ? (
          <>
            <span className="nb-pulse size-3 rounded-sm bg-ink" aria-hidden="true" /> Thinking about your doubt
          </>
        ) : mic === "recording" ? (
          <>
            <span className="nb-pulse size-3 rounded-full bg-danger" aria-hidden="true" /> Listening. Speak, then press Send.
          </>
        ) : (
          <>Type your doubt below.</>
        )}
      </div>
      {notice && (
        <p className="mb-2 max-h-24 overflow-y-auto rounded-lg border-2 border-danger bg-danger-soft px-2.5 py-1.5 text-sm font-medium text-danger">
          {notice}{" "}
          {canRetry && (
            <button type="button" onClick={onRetry} className="font-bold underline">
              Try again
            </button>
          )}
        </p>
      )}
      <label className="block space-y-1">
        <span className="nb-label">Your doubt</span>
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
          placeholder="Or type it here"
          className="nb-field resize-none"
        />
      </label>
      <div className="mt-3 flex gap-3">
        <button type="button" data-testid="doubt-send" disabled={thinking} onClick={onSend} className="nb-btn nb-btn-primary flex-1">
          <Icon name="send" size={18} /> Send
        </button>
        <button type="button" onClick={onCancel} className="nb-btn nb-btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
