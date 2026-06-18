const buckets = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const DEFAULTS: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {},
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup();

  const { windowMs, maxRequests } = { ...DEFAULTS, ...config };
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
}
