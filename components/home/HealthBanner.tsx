"use client";

import { useEffect, useState } from "react";

export default function HealthBanner() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setMissing(d.configured === false))
      .catch(() => {});
  }, []);

  if (!missing) return null;
  return (
    <p role="alert" data-testid="key-banner" className="rounded-lg border-2 border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      The Sarvam API key is not set. Add SARVAM_API_KEY to .env locally, or to the Vercel project settings, then restart.
    </p>
  );
}
