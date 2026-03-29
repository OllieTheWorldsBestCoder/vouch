import {
  ChallengeRequestSchema,
  SignupRequestSchema,
  validateConsentToken,
  createError,
  base64urlDecode,
} from "@vouchagents/protocol";

import type { AgentSignupConfig, NonceStore } from "./types.js";
import { buildManifest } from "./manifest.js";
import { MemoryNonceStore } from "./nonce.js";
import { VerificationManager } from "./verification.js";
import { RateLimiter } from "./rate-limit.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NONCE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  // Common proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Parse the route segment from a URL pathname.
 * Expects paths like:
 *   /.well-known/agent-signup.json
 *   /agent-signup/challenge
 *   /agent-signup/signup
 *   /agent-signup/status/:id
 *   /agent-signup/verify
 */
function parseRoute(
  pathname: string,
): { route: string; param?: string } | null {
  // Discovery document
  if (
    pathname === "/.well-known/agent-signup.json" ||
    pathname === "/.well-known/agent-signup.json/"
  ) {
    return { route: "discovery" };
  }

  // Agent-signup API routes
  const match = pathname.match(
    /\/agent-signup\/(challenge|signup|status|verify)(?:\/([^/?]+))?/,
  );
  if (!match) return null;
  return { route: match[1]!, param: match[2] };
}

// ---------------------------------------------------------------------------
// Signup state (in-memory, used for status queries and deletion)
// ---------------------------------------------------------------------------

interface SignupRecord {
  signupId: string;
  userId: string;
  status: "pending_verification" | "active" | "rejected" | "expired";
  createdAt: string;
  expiresAt?: string;
  agentName: string;
  agentVersion: string;
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

export interface AgentSignupHandler {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
  DELETE: (req: Request) => Promise<Response>;
  /** Clean up background timers (for graceful shutdown or tests). */
  destroy: () => void;
}

/**
 * Create the main agent-signup handler.
 *
 * Returns an object with `GET`, `POST`, and `DELETE` methods that operate on
 * standard Web API `Request`/`Response` objects, making the handler
 * framework-agnostic (works in Next.js, Hono, bare Node 18+, Cloudflare
 * Workers, etc.).
 */
export function createAgentSignupHandler(
  config: AgentSignupConfig,
): AgentSignupHandler {
  // ----- Initialise subsystems -----

  const nonceStore: NonceStore =
    config.store === "memory" || config.store === undefined
      ? new MemoryNonceStore()
      : config.store;

  const rateLimiter = config.rateLimit
    ? new RateLimiter({
        perMinute: config.rateLimit.perMinute,
        perHour: config.rateLimit.perHour,
      })
    : null;

  const verificationManager =
    config.verification?.method === "email"
      ? new VerificationManager(config.verification.timeoutMinutes ?? 30)
      : null;

  // In-memory signup records for status queries
  const signups = new Map<string, SignupRecord>();

  // Cached manifest (regenerated lazily if needed)
  let cachedManifest: ReturnType<typeof buildManifest> | null = null;
  function getManifest() {
    if (!cachedManifest) {
      cachedManifest = buildManifest(config);
    }
    return cachedManifest;
  }

  // ----- Rate-limit check helper -----

  function checkRateLimit(req: Request): Response | null {
    if (!rateLimiter) return null;
    const ip = getClientIp(req);
    const result = rateLimiter.check(ip);
    if (!result.allowed) {
      return jsonResponse(
        429,
        createError(
          "RATE_LIMITED",
          "Too many requests. Please try again later.",
          {
            retry_after_ms: result.retryAfterMs,
          },
        ),
      );
    }
    return null;
  }

  // ====================================================================
  // GET handler
  // ====================================================================

  async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const parsed = parseRoute(url.pathname);
    if (!parsed) {
      return jsonResponse(404, createError("DISCOVERY_NOT_FOUND", "Not found"));
    }

    switch (parsed.route) {
      case "discovery": {
        return jsonResponse(200, getManifest());
      }
      case "status": {
        const id = parsed.param ?? url.searchParams.get("id");
        if (!id) {
          return jsonResponse(
            400,
            createError("MISSING_REQUIRED_FIELD", "Missing signup id"),
          );
        }
        const record = signups.get(id);
        if (!record) {
          return jsonResponse(
            404,
            createError("DISCOVERY_NOT_FOUND", "Signup not found"),
          );
        }
        return jsonResponse(200, {
          signup_id: record.signupId,
          status: record.status,
          created_at: record.createdAt,
          expires_at: record.expiresAt,
        });
      }
      default:
        return jsonResponse(
          404,
          createError("DISCOVERY_NOT_FOUND", "Not found"),
        );
    }
  }

  // ====================================================================
  // POST handler
  // ====================================================================

  async function POST(req: Request): Promise<Response> {
    const rateRes = checkRateLimit(req);
    if (rateRes) return rateRes;

    const url = new URL(req.url);
    const parsed = parseRoute(url.pathname);
    if (!parsed) {
      return jsonResponse(404, createError("DISCOVERY_NOT_FOUND", "Not found"));
    }

    switch (parsed.route) {
      case "challenge":
        return handleChallenge(req);
      case "signup":
        return handleSignup(req);
      case "verify":
        return handleVerify(req);
      default:
        return jsonResponse(
          404,
          createError("DISCOVERY_NOT_FOUND", "Not found"),
        );
    }
  }

  // ----- Challenge -----

  async function handleChallenge(req: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Invalid JSON body"),
      );
    }

    const result = ChallengeRequestSchema.safeParse(body);
    if (!result.success) {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Invalid challenge request", {
          issues: result.error.issues,
        }),
      );
    }

    const { public_key, site } = result.data;

    // Verify the site URL matches our config
    const expectedOrigin = config.site.url.replace(/\/+$/, "");
    const requestedOrigin = site.replace(/\/+$/, "");
    if (requestedOrigin !== expectedOrigin) {
      return jsonResponse(
        400,
        createError(
          "CONSENT_SCOPE_MISMATCH",
          "Site URL does not match this server",
        ),
      );
    }

    // Generate nonce
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

    const stored = await nonceStore.create(nonce, public_key, NONCE_TTL_MS);
    if (!stored) {
      return jsonResponse(
        500,
        createError("INTERNAL_ERROR", "Failed to create challenge"),
      );
    }

    return jsonResponse(200, {
      nonce,
      expires_at: expiresAt,
    });
  }

  // ----- Signup -----

  async function handleSignup(req: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Invalid JSON body"),
      );
    }

    const result = SignupRequestSchema.safeParse(body);
    if (!result.success) {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Invalid signup request", {
          issues: result.error.issues,
        }),
      );
    }

    const { consent_token, data, agent, idempotency_key } = result.data;

    // Check idempotency - if we already processed this key, return the existing result
    for (const record of signups.values()) {
      if (record.signupId === idempotency_key) {
        return jsonResponse(200, {
          signup_id: record.signupId,
          status: record.status,
          verification: {
            required: verificationManager !== null,
            method: config.verification?.method ?? "none",
          },
          created_at: record.createdAt,
          expires_at: record.expiresAt,
        });
      }
    }

    // Decode the consent token to extract the nonce (jti)
    const tokenParts = consent_token.split(".");
    if (tokenParts.length !== 3) {
      return jsonResponse(
        400,
        createError("INVALID_CONSENT_TOKEN", "Malformed consent token"),
      );
    }

    let tokenPayload: { jti?: string };
    try {
      tokenPayload = JSON.parse(atob(tokenParts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return jsonResponse(
        400,
        createError("INVALID_CONSENT_TOKEN", "Cannot decode consent token payload"),
      );
    }

    const nonce = tokenPayload.jti;
    if (!nonce) {
      return jsonResponse(
        400,
        createError("INVALID_CONSENT_TOKEN", "Consent token missing nonce (jti)"),
      );
    }

    // Consume the nonce and retrieve the associated public key
    const publicKeyStr = await nonceStore.consume(nonce);
    if (!publicKeyStr) {
      return jsonResponse(
        400,
        createError("CHALLENGE_EXPIRED", "Challenge nonce expired or already used"),
      );
    }

    // Decode the public key from base64url
    let publicKey: Uint8Array;
    try {
      publicKey = base64urlDecode(publicKeyStr);
    } catch {
      return jsonResponse(
        400,
        createError("INVALID_SIGNATURE", "Invalid public key encoding"),
      );
    }

    // Validate the consent token
    const validation = await validateConsentToken({
      token: consent_token,
      expectedAudience: config.site.url.replace(/\/+$/, ""),
      nonce,
      submittedData: data as Record<string, unknown>,
      publicKey,
    });

    if (!validation.valid) {
      return jsonResponse(
        400,
        createError(
          "INVALID_CONSENT_TOKEN",
          validation.error ?? "Consent token validation failed",
        ),
      );
    }

    // Validate required fields are present
    for (const field of config.fields.required) {
      if (data[field.field] === undefined || data[field.field] === null) {
        return jsonResponse(
          400,
          createError("MISSING_REQUIRED_FIELD", `Missing required field: ${field.field}`, {
            field: field.field,
          }),
        );
      }
    }

    // Call the user's onSignup handler
    const signupId = idempotency_key;
    let userId: string;
    try {
      const signupResult = await config.onSignup(
        data as Record<string, unknown>,
        {
          signupId,
          agentName: agent.name,
          agentVersion: agent.version,
          mcpSessionId: agent.mcp_session_id,
          consentMode: validation.payload!.consent_mode,
          purpose: validation.payload!.scope.purpose,
          fields: validation.payload!.scope.fields,
          ipAddress: getClientIp(req),
        },
      );
      userId = signupResult.userId;
    } catch (err) {
      const errorObj = createError(
        "INTERNAL_ERROR",
        "Signup handler failed",
        { detail: err instanceof Error ? err.message : String(err) },
      );
      if (config.onFailed) {
        await config.onFailed(signupId, errorObj).catch(() => {
          /* swallow callback errors */
        });
      }
      return jsonResponse(500, errorObj);
    }

    // Determine initial status
    const needsVerification =
      verificationManager !== null &&
      config.verification?.method === "email";

    const status = needsVerification ? "pending_verification" as const : "active" as const;
    const createdAt = new Date().toISOString();
    const expiresAt = needsVerification
      ? new Date(
          Date.now() +
            (config.verification?.timeoutMinutes ?? 30) * 60 * 1_000,
        ).toISOString()
      : undefined;

    // Store the signup record
    const record: SignupRecord = {
      signupId,
      userId,
      status,
      createdAt,
      expiresAt,
      agentName: agent.name,
      agentVersion: agent.version,
    };
    signups.set(signupId, record);

    // Trigger email verification if configured
    let sentTo: string | undefined;
    if (needsVerification && verificationManager) {
      const email = (data as Record<string, unknown>)["email"];
      if (typeof email === "string") {
        const code = verificationManager.create(signupId, userId, email);
        sentTo = email;

        // Build a magic link
        const base = config.site.url.replace(/\/+$/, "");
        const magicLink = `${base}/agent-signup/verify?id=${encodeURIComponent(signupId)}&code=${encodeURIComponent(code)}`;

        if (config.verification?.sendEmail) {
          // Fire-and-forget; don't block the response
          config.verification.sendEmail(email, code, magicLink).catch(() => {
            /* swallow email errors */
          });
        }
      }
    }

    return jsonResponse(201, {
      signup_id: signupId,
      status,
      verification: {
        required: needsVerification,
        method: config.verification?.method ?? "none",
        ...(sentTo ? { sent_to: sentTo } : {}),
      },
      created_at: createdAt,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });
  }

  // ----- Verify -----

  async function handleVerify(req: Request): Promise<Response> {
    if (!verificationManager) {
      return jsonResponse(
        400,
        createError("VERIFICATION_FAILED", "Verification is not configured"),
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Invalid JSON body"),
      );
    }

    const { signup_id, code } = body as {
      signup_id?: string;
      code?: string;
    };

    if (!signup_id || !code) {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Missing signup_id or code"),
      );
    }

    const result = verificationManager.verify(signup_id, code);
    if (!result.success) {
      return jsonResponse(
        400,
        createError("VERIFICATION_FAILED", result.error),
      );
    }

    // Update signup status
    const record = signups.get(signup_id);
    if (record) {
      record.status = "active";
      record.expiresAt = undefined;
    }

    // Notify the site developer
    if (config.onVerified) {
      await config.onVerified(signup_id, result.userId).catch(() => {
        /* swallow callback errors */
      });
    }

    return jsonResponse(200, {
      signup_id,
      status: "active",
      verified: true,
    });
  }

  // ====================================================================
  // DELETE handler
  // ====================================================================

  async function DELETE(req: Request): Promise<Response> {
    const rateRes = checkRateLimit(req);
    if (rateRes) return rateRes;

    const url = new URL(req.url);
    const parsed = parseRoute(url.pathname);
    if (!parsed || parsed.route !== "signup") {
      return jsonResponse(
        404,
        createError("DISCOVERY_NOT_FOUND", "Not found"),
      );
    }

    const id = parsed.param ?? url.searchParams.get("id");
    if (!id) {
      return jsonResponse(
        400,
        createError("MISSING_REQUIRED_FIELD", "Missing signup id"),
      );
    }

    const record = signups.get(id);
    if (!record) {
      return jsonResponse(
        404,
        createError("DISCOVERY_NOT_FOUND", "Signup not found"),
      );
    }

    // Mark as expired / revoked
    record.status = "expired";
    signups.delete(id);

    if (config.onExpired) {
      await config.onExpired(id).catch(() => {
        /* swallow callback errors */
      });
    }

    return jsonResponse(200, {
      signup_id: id,
      status: "expired",
      deleted: true,
    });
  }

  // ====================================================================
  // Destroy (cleanup)
  // ====================================================================

  function destroy(): void {
    if (nonceStore instanceof MemoryNonceStore) {
      nonceStore.destroy();
    }
    if (verificationManager) {
      verificationManager.destroy();
    }
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  }

  return { GET, POST, DELETE, destroy };
}
