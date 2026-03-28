import {
  AgentSignupDiscoverySchema,
  type AgentSignupDiscovery,
} from "@agent-signup/protocol";

const WELL_KNOWN_PATH = "/.well-known/agent-signup.json";

/**
 * Fetch and validate a site's agent-signup discovery manifest.
 * Returns the parsed manifest, or `null` if the site does not support the protocol.
 */
export async function discoverSite(
  siteUrl: string,
): Promise<AgentSignupDiscovery | null> {
  const url = new URL(WELL_KNOWN_PATH, siteUrl).href;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const parsed = AgentSignupDiscoverySchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

interface CacheEntry {
  manifest: AgentSignupDiscovery;
  etag: string | null;
  expiresAt: number; // epoch ms
}

/**
 * In-memory LRU cache for discovery manifests.
 * Respects `Cache-Control: max-age` and `ETag` headers.
 */
export class DiscoveryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 128) {
    this.maxSize = maxSize;
  }

  /**
   * Get a cached or freshly-fetched discovery manifest for the given site URL.
   * Returns `null` if the site does not support the protocol.
   */
  async get(siteUrl: string): Promise<AgentSignupDiscovery | null> {
    const key = normalizeUrl(siteUrl);
    const cached = this.cache.get(key);

    // Fresh cache hit
    if (cached && Date.now() < cached.expiresAt) {
      this.touch(key);
      return cached.manifest;
    }

    // Attempt conditional request with ETag
    const url = new URL(WELL_KNOWN_PATH, key).href;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch {
      // Network error — return stale entry if available
      return cached?.manifest ?? null;
    }

    // 304 Not Modified — refresh TTL
    if (res.status === 304 && cached) {
      cached.expiresAt = computeExpiry(res);
      this.touch(key);
      return cached.manifest;
    }

    if (!res.ok) {
      // Remove stale entry
      this.cache.delete(key);
      return null;
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return cached?.manifest ?? null;
    }

    const parsed = AgentSignupDiscoverySchema.safeParse(body);
    if (!parsed.success) {
      this.cache.delete(key);
      return null;
    }

    this.set(key, {
      manifest: parsed.data,
      etag: res.headers.get("etag"),
      expiresAt: computeExpiry(res),
    });

    return parsed.data;
  }

  /**
   * Check whether a site is known to support the agent-signup protocol.
   * Only returns `true` if a valid manifest is already cached or can be fetched.
   */
  async supports(siteUrl: string): Promise<boolean> {
    const manifest = await this.get(siteUrl);
    return manifest !== null;
  }

  /**
   * Invalidate the cached manifest for a URL.
   */
  invalidate(siteUrl: string): void {
    this.cache.delete(normalizeUrl(siteUrl));
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private set(key: string, entry: CacheEntry): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    // Delete first so the entry is re-inserted at the end (LRU ordering)
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private touch(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function normalizeUrl(siteUrl: string): string {
  const u = new URL(siteUrl);
  return `${u.protocol}//${u.host}`;
}

/** Parse `Cache-Control: max-age=N` into an absolute expiry timestamp. Defaults to 5 minutes. */
function computeExpiry(res: Response): number {
  const cc = res.headers.get("cache-control") ?? "";
  const match = /max-age=(\d+)/i.exec(cc);
  const maxAge = match ? parseInt(match[1], 10) : 300; // default 5 min
  return Date.now() + maxAge * 1000;
}
