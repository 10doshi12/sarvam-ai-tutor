import "server-only";

export const SARVAM_TIMEOUT = 504;

export class SarvamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

// Turns any thrown value into the JSON error shape every route returns.
export function sarvamErrorResponse(err: unknown): Response {
  const status = err instanceof SarvamError ? err.status : 500;
  const error = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ error }, { status });
}
