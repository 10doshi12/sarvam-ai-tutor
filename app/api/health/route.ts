import { hasApiKey } from "@/lib/sarvam";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ configured: hasApiKey() });
}
