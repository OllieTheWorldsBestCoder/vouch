/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Tracks request timestamps per key (IP address or agent key) and enforces
 * per-minute and per-hour limits.
 */

interface RateLimitConfig {
  perMinute: number;
  perHour: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly windows = new Map<string, number[]>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      perMinute: config.perMinute ?? 20,
      perHour: config.perHour ?? 200,
    };

    // Sweep old timestamps every 5 min.
    this.sweepTimer = setInterval(() => this.sweep(), 300_000);
    if (this.sweepTimer && typeof (this.sweepTimer as unknown as { unref?: () => void }).unref === "function") {
      (this.sweepTimer as unknown as { unref: () => void }).unref();
    }
  }

  /** Check and record a request. Returns whether the request is allowed. */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = this.windows.get(key) ?? [];

    // Remove timestamps older than 1 hour.
    const oneHourAgo = now - 3_600_000;
    const filtered = timestamps.filter((t) => t > oneHourAgo);

    // Check per-hour limit.
    if (filtered.length >= this.config.perHour) {
      const oldest = filtered[0]!;
      return {
        allowed: false,
        retryAfterMs: oldest + 3_600_000 - now,
      };
    }

    // Check per-minute limit.
    const oneMinuteAgo = now - 60_000;
    const recentCount = filtered.filter((t) => t > oneMinuteAgo).length;
    if (recentCount >= this.config.perMinute) {
      const oldestInMinute = filtered.find((t) => t > oneMinuteAgo)!;
      return {
        allowed: false,
        retryAfterMs: oldestInMinute + 60_000 - now,
      };
    }

    // Allow and record.
    filtered.push(now);
    this.windows.set(key, filtered);
    return { allowed: true };
  }

  /** Remove stale window data. */
  private sweep(): void {
    const cutoff = Date.now() - 3_600_000;
    for (const [key, timestamps] of this.windows) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, filtered);
      }
    }
  }

  /** Stop the background sweep timer. */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
