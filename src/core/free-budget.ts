/**
 * Budget per Buffer API client, including calls made via MCP integrations.
 * Provider RateLimit headers are authoritative for rolling 15m/24h/30d usage.
 * This in-memory guard limits subsequent requests within a worker invocation.
 */
export const BUFFER_OPERATING_REQUESTS = {
  900: 25,
  86400: 80,
  2592000: 2400
} as const;

type WindowSeconds = keyof typeof BUFFER_OPERATING_REQUESTS;
export type BufferRateWindow = {
  windowSeconds: WindowSeconds;
  allowed: number;
  remaining: number;
  resetAt: number;
};

const names: Record<string, WindowSeconds> = {
  "15min": 900,
  "1day": 86400,
  "30days": 2592000
};

export function readBufferRateWindows(header: string | null, now = Date.now()): BufferRateWindow[] {
  if (!header) return [];
  const windows: BufferRateWindow[] = [];
  for (const segment of header.split(/,\s*(?=")/)) {
    const match = segment.trim().match(/^"(\d+)-in-(15min|1day|30days)";\s*r=(\d+);\s*t=(\d+)/);
    if (!match) continue;
    const windowSeconds = names[match[2]!];
    const allowed = Number(match[1]);
    const remaining = Number(match[3]);
    const ttl = Number(match[4]);
    if (!windowSeconds || !Number.isSafeInteger(allowed) || !Number.isSafeInteger(remaining) ||
      !Number.isSafeInteger(ttl) || allowed < 1 || remaining < 0 || remaining > allowed || ttl < 0) continue;
    windows.push({ windowSeconds, allowed, remaining, resetAt: now + ttl * 1000 });
  }
  return windows;
}

export function assessBufferBudget(windows: BufferRateWindow[], now = Date.now()): string | null {
  const expected: WindowSeconds[] = [900, 86400, 2592000];
  for (const period of expected) {
    const entry = windows.find((value) => value.windowSeconds === period);
    // Unknown budget must not authorize unmeasured publishing or analytics.
    if (!entry || entry.resetAt <= now) return "Buffer rate-limit window missing or stale (" + period + "s)";
    const maxUsed = Math.min(BUFFER_OPERATING_REQUESTS[period], Math.floor(entry.allowed * 0.8));
    if (entry.allowed - entry.remaining >= maxUsed) {
      return "Buffer free-tier operating budget reached (" + period + "s), awaiting rolling reset";
    }
  }
  return null;
}
