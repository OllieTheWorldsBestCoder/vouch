import { sign, verify, fingerprint, canonicalHash, base64urlEncode, base64urlDecode } from "../crypto/index.js";
import { ConsentTokenPayloadSchema, type ConsentTokenPayload } from "../schemas/consent.js";
import type { KeyPair } from "../crypto/index.js";

export interface CreateConsentTokenInput {
  userKeyPair: KeyPair;
  agentId: string;
  audience: string;
  nonce: string;
  fields: string[];
  data: Record<string, unknown>;
  purpose: "account_creation" | "identity_verification" | "newsletter_signup";
  consentMode: "explicit" | "pre_authorized";
  siteEndpoint: string;
  expiresInSeconds?: number;
  policyId?: string;
}

/** Create a signed JWS consent token. */
export async function createConsentToken(
  input: CreateConsentTokenInput,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (input.expiresInSeconds ?? 300);

  const header = {
    alg: "EdDSA" as const,
    crv: "Ed25519" as const,
    kid: input.userKeyPair.keyId,
    typ: "agent-signup-consent+jwt" as const,
  };

  const dataHash = await canonicalHash(input.data);

  const payload: ConsentTokenPayload = {
    iss: input.userKeyPair.keyId,
    sub: input.agentId,
    aud: input.audience,
    iat: now,
    exp,
    jti: input.nonce,
    scope: {
      fields: input.fields,
      purpose: input.purpose,
      site_endpoint: input.siteEndpoint,
    },
    data_hash: dataHash,
    consent_mode: input.consentMode,
    ...(input.policyId ? { policy_id: input.policyId } : {}),
  };

  const encodedHeader = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  const signingInput = new TextEncoder().encode(
    `${encodedHeader}.${encodedPayload}`,
  );
  const signature = await sign(signingInput, input.userKeyPair.privateKey);
  const encodedSignature = base64urlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export interface ValidateConsentTokenInput {
  token: string;
  expectedAudience: string;
  nonce: string;
  submittedData: Record<string, unknown>;
  publicKey: Uint8Array;
}

export interface ValidateConsentTokenResult {
  valid: boolean;
  payload?: ConsentTokenPayload;
  error?: string;
}

/** Validate a consent token: signature, expiry, audience, nonce, data_hash. */
export async function validateConsentToken(
  input: ValidateConsentTokenInput,
): Promise<ValidateConsentTokenResult> {
  const parts = input.token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid JWS format" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Verify signature
  const signingInput = new TextEncoder().encode(
    `${encodedHeader}.${encodedPayload}`,
  );
  const signature = base64urlDecode(encodedSignature);
  const isValid = await verify(signingInput, signature, input.publicKey);
  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  // Parse and validate payload
  const payloadJson = JSON.parse(
    new TextDecoder().decode(base64urlDecode(encodedPayload)),
  );
  const parsed = ConsentTokenPayloadSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return { valid: false, error: `Invalid payload: ${parsed.error.message}` };
  }

  const payload = parsed.data;

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { valid: false, error: "Token expired" };
  }

  // Check audience
  if (payload.aud !== input.expectedAudience) {
    return { valid: false, error: "Audience mismatch" };
  }

  // Check nonce
  if (payload.jti !== input.nonce) {
    return { valid: false, error: "Nonce mismatch" };
  }

  // Check data_hash
  const expectedHash = await canonicalHash(input.submittedData);
  if (payload.data_hash !== expectedHash) {
    return { valid: false, error: "Data hash mismatch - data may have been tampered with" };
  }

  return { valid: true, payload };
}
