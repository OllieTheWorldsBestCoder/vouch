import type { NonceStore } from "./types.js";

interface NonceEntry {
  publicKey: string;
  expiresAt: number;
}

/**
 * In-memory nonce store with automatic expiry.
 *
 * Nonces are single-use and expire after the configured TTL (default 5 min).
 * A background sweep runs every 60 seconds to purge stale entries.
 */
export class MemoryNonceStore implements NonceStore {
  private readonly entries = new Map<string, NonceEntry>();
  private readonly consumed = new Set<string>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Sweep expired entries every 60 s.
    this.sweepTimer = setInterval(() => this.sweep(), 60_000);
    // Allow the process to exit even if the timer is still active (Node.js).
    if (this.sweepTimer && typeof (this.sweepTimer as unknown as { unref?: () => void }).unref === "function") {
      (this.sweepTimer as unknown as { unref: () => void }).unref();
    }
  }

  async create(
    nonce: string,
    publicKey: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (this.entries.has(nonce) || this.consumed.has(nonce)) {
      return false;
    }
    this.entries.set(nonce, {
      publicKey,
      expiresAt: Date.now() + ttlMs,
    });
    return true;
  }

  async consume(nonce: string): Promise<string | null> {
    const entry = this.entries.get(nonce);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(nonce);
      return null;
    }
    this.entries.delete(nonce);
    this.consumed.add(nonce);
    return entry.publicKey;
  }

  async exists(nonce: string): Promise<boolean> {
    const entry = this.entries.get(nonce);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(nonce);
      return false;
    }
    return true;
  }

  /** Remove expired entries and old consumed nonces. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
    // Consumed nonces older than 10 min can be discarded (replay window closed).
    // Since we don't track consumed timestamps, just cap the set size.
    if (this.consumed.size > 10_000) {
      this.consumed.clear();
    }
  }

  /** Stop the background sweep timer (useful in tests). */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
