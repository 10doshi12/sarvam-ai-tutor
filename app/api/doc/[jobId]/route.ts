import { getDigitiseResult, sarvamErrorResponse } from "@/lib/sarvam";

export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await ctx.params;
    return Response.json(await getDigitiseResult(jobId));
  } catch (err) {
    return sarvamErrorResponse(err);
  }
}
