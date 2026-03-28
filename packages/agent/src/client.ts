import {
  type AgentSignupDiscovery,
  type ChallengeResponse,
  type SignupRequest,
  type SignupResponse,
  type AgentSignupError,
  ChallengeResponseSchema,
  SignupResponseSchema,
  SignupStatusSchema,
  AgentSignupErrorSchema,
  ErrorCodes,
  createError,
} from "@agent-signup/protocol";
import { z } from "zod";
import { DiscoveryCache } from "./discovery.js";

// ---------------------------------------------------------------------------
// Error class for structured protocol errors
// ---------------------------------------------------------------------------

export class AgentSignupClientError extends Error {
  public readonly response: AgentSignupError;
  public readonly statusCode: number;

  constructor(response: AgentSignupError, statusCode: number) {
    super(response.error.message);
    this.name = "AgentSignupClientError";
    this.response = response;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Status response (GET /status/:id)
// ---------------------------------------------------------------------------

/** The shape returned by `checkStatus`. A subset of SignupResponse (status endpoint doesn't include verification). */
const StatusResponseSchema = z.object({
  signup_id: z.string(),
  status: SignupStatusSchema,
  created_at: z.string().optional(),
  expires_at: z.string().optional(),
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// ---------------------------------------------------------------------------
// Verification response
// ---------------------------------------------------------------------------

export interface VerificationResponse {
  signup_id: string;
  status: string;
  verified_at?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AgentSignupClient {
  private discoveryCache: DiscoveryCache;

  constructor(cache?: DiscoveryCache) {
    this.discoveryCache = cache ?? new DiscoveryCache();
  }

  /** Get the discovery cache instance. */
  get cache(): DiscoveryCache {
    return this.discoveryCache;
  }

  /**
   * Discover the agent-signup manifest for a site.
   * Returns `null` if the site does not support the protocol.
   */
  async discover(siteUrl: string): Promise<AgentSignupDiscovery | null> {
    return this.discoveryCache.get(siteUrl);
  }

  /**
   * Request a cryptographic challenge from the site.
   */
  async requestChallenge(
    siteUrl: string,
    publicKey: string,
  ): Promise<ChallengeResponse> {
    const manifest = await this.requireManifest(siteUrl);
    const url = this.resolveEndpoint(siteUrl, manifest.endpoints.challenge);

    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ public_key: publicKey, site: siteUrl }),
    });

    if (!res.ok) {
      throw await toClientError(res);
    }

    const body = await res.json();
    return ChallengeResponseSchema.parse(body);
  }

  /**
   * Submit a signup request.
   */
  async submitSignup(
    siteUrl: string,
    request: SignupRequest,
  ): Promise<SignupResponse> {
    const manifest = await this.requireManifest(siteUrl);
    const url = this.resolveEndpoint(siteUrl, manifest.endpoints.signup);

    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw await toClientError(res);
    }

    const body = await res.json();
    return SignupResponseSchema.parse(body);
  }

  /**
   * Check the status of an existing signup.
   */
  async checkStatus(
    siteUrl: string,
    signupId: string,
  ): Promise<StatusResponse> {
    const manifest = await this.requireManifest(siteUrl);
    const baseUrl = this.resolveEndpoint(siteUrl, manifest.endpoints.status);
    const url = `${baseUrl}/${encodeURIComponent(signupId)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw await toClientError(res);
    }

    const body = await res.json();
    return StatusResponseSchema.parse(body);
  }

  /**
   * Submit a verification code (e.g. email or phone code).
   */
  async submitVerification(
    siteUrl: string,
    signupId: string,
    code: string,
  ): Promise<VerificationResponse> {
    const manifest = await this.requireManifest(siteUrl);
    const verifyEndpoint = manifest.endpoints.verify;
    if (!verifyEndpoint) {
      throw new AgentSignupClientError(
        createError(
          ErrorCodes.DISCOVERY_NOT_FOUND,
          "This site does not expose a verify endpoint",
        ),
        404,
      );
    }

    const baseUrl = this.resolveEndpoint(siteUrl, verifyEndpoint);
    const url = `${baseUrl}/${encodeURIComponent(signupId)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      throw await toClientError(res);
    }

    return (await res.json()) as VerificationResponse;
  }

  /**
   * Delete / cancel a signup.
   */
  async deleteSignup(siteUrl: string, signupId: string): Promise<void> {
    const manifest = await this.requireManifest(siteUrl);
    const baseUrl = this.resolveEndpoint(siteUrl, manifest.endpoints.signup);
    const url = `${baseUrl}/${encodeURIComponent(signupId)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw await toClientError(res);
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async requireManifest(
    siteUrl: string,
  ): Promise<AgentSignupDiscovery> {
    const manifest = await this.discoveryCache.get(siteUrl);
    if (!manifest) {
      throw new AgentSignupClientError(
        createError(
          ErrorCodes.DISCOVERY_NOT_FOUND,
          `No agent-signup manifest found for ${siteUrl}`,
        ),
        404,
      );
    }
    return manifest;
  }

  /**
   * Resolve a (possibly relative) endpoint path against the site origin.
   */
  private resolveEndpoint(siteUrl: string, endpoint: string): string {
    // If the endpoint is already absolute, use it directly
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    return new URL(endpoint, siteUrl).href;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function jsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function toClientError(res: Response): Promise<AgentSignupClientError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // non-JSON error response
  }

  const parsed = AgentSignupErrorSchema.safeParse(body);
  if (parsed.success) {
    return new AgentSignupClientError(parsed.data, res.status);
  }

  // Synthesize a structured error for non-protocol error responses
  return new AgentSignupClientError(
    createError(
      ErrorCodes.INTERNAL_ERROR,
      `HTTP ${res.status}: ${res.statusText}`,
    ),
    res.status,
  );
}
