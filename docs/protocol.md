# Agent Signup Protocol Specification

**Protocol Version:** 1.0
**Document Status:** Draft
**Date:** 2026-03-28

---

## Table of Contents

1. [Overview](#1-overview)
2. [Discovery Protocol](#2-discovery-protocol)
3. [Data Models](#3-data-models)
4. [REST API](#4-rest-api)
5. [MCP Tool Definitions](#5-mcp-tool-definitions)
6. [Consent Flow](#6-consent-flow)
7. [Email Verification Flow](#7-email-verification-flow)
8. [Error Handling](#8-error-handling)

---

## 1. Overview

Agent Signup is a protocol that enables AI agents to register users for online services with explicit, cryptographic consent. It is the programmatic equivalent of a user filling out a signup form -- except the agent discovers the site's requirements, obtains the user's permission, and submits the registration on their behalf. The protocol covers four phases: **discovery** (what does the site need?), **consent** (does the user approve?), **registration** (submit the signup), and **verification** (confirm the user's email).

The protocol is designed so that a developer can implement a compliant client or server in any language using only this document as a reference. All wire formats are JSON over HTTPS. Type definitions are provided in TypeScript for precision but map directly to language-agnostic JSON Schema.

### Protocol Version

This document specifies **version 1.0** of the Agent Signup protocol.

### Design Principles

- **Client-side PII.** All personally identifiable information is stored on the user's device in an encrypted vault. PII is transmitted only to the target site during a consented signup. No central server, directory, or identity provider stores user data.
- **Cryptographic consent.** Consent is proven via Ed25519 digital signatures. The user's client generates a keypair; the private key never leaves the device. Consent tokens are JWS (JSON Web Signature) documents that any site can verify using the embedded public key. This is analogous to SSH key authentication.
- **No central server.** There is no intermediary between the agent and the site. Discovery, challenge, signup, and verification are direct interactions between the agent (acting on behalf of the user) and the participating site.
- **Language-agnostic wire format.** The protocol uses REST over HTTPS with JSON request and response bodies. URL path versioning (`/api/v1/`) ensures explicit compatibility. Any language that can make HTTP requests and verify Ed25519 signatures can implement a compliant client.

---

## 2. Discovery Protocol

### Endpoint

```
GET /.well-known/agent-signup.json
```

Inspired by OpenID Connect Discovery (`.well-known/openid-configuration`) and `robots.txt`, any site that supports agent signup MUST publish a machine-readable manifest at this well-known URL. The document is publicly accessible, requires no authentication, and SHOULD be cacheable.

### Discovery Document Schema

The following Zod schema defines the canonical structure of the discovery document. All implementations MUST produce and consume documents conforming to this schema.

```typescript
import { z } from "zod";

const FieldRequirementSchema = z.object({
  field: z.string(),
  type: z.enum(["string", "email", "phone", "date", "boolean", "address", "url"]),
  required: z.boolean(),
  description: z.string().optional(),
  validation: z.string().optional(),
  purpose: z.string().optional(),
});

const ConsentScopeSchema = z.object({
  scope: z.string(),
  fields: z.array(z.string()),
  description: z.string(),
});

const AgentSignupDiscoverySchema = z.object({
  // Protocol metadata
  protocol_version: z.literal("1.0"),
  issuer: z.string().url(),
  updated_at: z.string().datetime(),

  // Endpoints
  endpoints: z.object({
    signup: z.string(),
    status: z.string(),
    verify_callback: z.string().optional(),
    mcp: z.string().optional(),
  }),

  // Field requirements
  fields: z.object({
    required: z.array(FieldRequirementSchema),
    optional: z.array(FieldRequirementSchema),
  }),

  // Consent configuration
  consent: z.object({
    scopes: z.array(ConsentScopeSchema),
    token_max_age_seconds: z.number().default(300),
    requires_email_verification: z.boolean().default(true),
  }),

  // Security
  security: z.object({
    supported_algorithms: z.array(z.string()).default(["EdDSA"]),
    challenge_required: z.boolean().default(true),
    rate_limit: z
      .object({
        requests_per_minute: z.number(),
        burst: z.number(),
      })
      .optional(),
  }),

  // Branding
  branding: z.object({
    name: z.string(),
    logo_url: z.string().url().optional(),
    privacy_policy_url: z.string().url(),
    terms_url: z.string().url(),
    data_retention: z.string().optional(),    // e.g. "Account lifetime + 30 days". Displayed during consent. GDPR compliance.
  }),
});
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `protocol_version` | `"1.0"` | MUST be the literal string `"1.0"` for this version of the protocol. |
| `issuer` | URL string | The site's canonical base URL. Used as the `aud` claim in consent tokens. MUST match the origin from which the discovery document is served. |
| `updated_at` | ISO 8601 datetime | When the discovery document was last modified. Agents MAY use this to detect changes. |
| `endpoints.signup` | string | Relative or absolute URL for the signup submission endpoint. |
| `endpoints.status` | string | Relative or absolute URL for the signup status polling endpoint. |
| `endpoints.verify_callback` | string (optional) | Relative or absolute URL for the verification endpoint. |
| `endpoints.mcp` | string (optional) | URL of the site's MCP server, if the site exposes MCP tools. |
| `fields.required` | `FieldRequirement[]` | Fields the site requires for signup. A signup MUST include all required fields. |
| `fields.optional` | `FieldRequirement[]` | Fields the site accepts but does not require. |
| `consent.scopes` | `ConsentScope[]` | Named groupings of fields. Agents request consent by scope. |
| `consent.token_max_age_seconds` | number | Maximum TTL for consent tokens accepted by this site. Default: 300 (5 minutes). |
| `consent.requires_email_verification` | boolean | Whether the site requires email verification after signup. Default: `true`. |
| `security.supported_algorithms` | string[] | Signature algorithms the site accepts. For v1.0, this MUST include `"EdDSA"`. |
| `security.challenge_required` | boolean | Whether the site requires a server-issued nonce in consent tokens. Default: `true`. Sites SHOULD set this to `true`. |
| `security.rate_limit` | object (optional) | Advertised rate limits so agents can self-throttle. |
| `branding.name` | string | Human-readable site name for display in consent UIs. |
| `branding.logo_url` | URL string (optional) | Logo image URL for consent UIs. |
| `branding.privacy_policy_url` | URL string | Link to the site's privacy policy. MUST be provided. |
| `branding.terms_url` | URL string | Link to the site's terms of service. MUST be provided. |

### Example Discovery Document

```json
{
  "protocol_version": "1.0",
  "issuer": "https://example.com",
  "updated_at": "2026-03-28T00:00:00Z",
  "endpoints": {
    "signup": "/api/v1/agent-signup/signup",
    "status": "/api/v1/agent-signup/status",
    "verify_callback": "/api/v1/agent-signup/verify",
    "mcp": "/api/v1/agent-signup/mcp"
  },
  "fields": {
    "required": [
      {
        "field": "email",
        "type": "email",
        "required": true,
        "purpose": "Account identification and verification"
      },
      {
        "field": "full_name",
        "type": "string",
        "required": true,
        "purpose": "Account display name"
      }
    ],
    "optional": [
      {
        "field": "phone",
        "type": "phone",
        "required": false,
        "purpose": "Two-factor authentication"
      },
      {
        "field": "address",
        "type": "address",
        "required": false,
        "purpose": "Shipping for physical goods"
      }
    ]
  },
  "consent": {
    "scopes": [
      {
        "scope": "signup.basic",
        "fields": ["email", "full_name"],
        "description": "Create an account with your name and email"
      },
      {
        "scope": "signup.full",
        "fields": ["email", "full_name", "phone", "address"],
        "description": "Create an account with full profile information"
      }
    ],
    "token_max_age_seconds": 300,
    "requires_email_verification": true
  },
  "security": {
    "supported_algorithms": ["EdDSA"],
    "challenge_required": true,
    "rate_limit": {
      "requests_per_minute": 10,
      "burst": 3
    }
  },
  "branding": {
    "name": "Example Service",
    "logo_url": "https://example.com/logo.png",
    "privacy_policy_url": "https://example.com/privacy",
    "terms_url": "https://example.com/terms"
  }
}
```

### Cache Headers

The discovery document SHOULD be served with the following headers to enable efficient caching by agents and intermediaries:

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "v1-{content-hash}"
```

Agents SHOULD cache the discovery document locally and use `If-None-Match` with the `ETag` value for subsequent requests. A `304 Not Modified` response indicates the cached document is still valid. Sites SHOULD recompute the `ETag` whenever the discovery document content changes.

---

## 3. Data Models

All types are defined in TypeScript for precision. They map directly to JSON Schema and can be implemented in any language. Field names use `snake_case` in the JSON wire format.

### UserIdentity

Represents the user's agent-signup cryptographic identity. Generated once by the user-side SDK and reused across all signups.

```typescript
interface UserIdentity {
  /** Base64url-encoded Ed25519 public key (32 bytes raw). */
  publicKey: string;

  /**
   * Key fingerprint: the first 16 characters of base64url(SHA-256(publicKey)).
   * Used as a short, stable identifier for the key.
   */
  keyId: string;

  /** ISO 8601 datetime when the keypair was created. */
  createdAt: string;
}
```

The private key corresponding to `publicKey` MUST never leave the user's device. It is stored in the user's encrypted vault and used exclusively for signing consent tokens.

### ConsentTokenPayload

The payload of a JWS (JSON Web Signature) consent token. The token is serialized using JWS Compact Serialization with the following header:

```json
{
  "alg": "EdDSA",
  "crv": "Ed25519",
  "kid": "<user-key-fingerprint>",
  "typ": "agent-signup-consent+jwt"
}
```

**Algorithm choice: Ed25519 (EdDSA)** -- Deterministic signatures eliminate ECDSA nonce-reuse vulnerabilities. 32-byte keys, 64-byte signatures. Constant-time by design (no timing side-channels). See `security.md` Section 4.2 for full rationale.

**Key fingerprint (`kid`)**: The first 16 characters of `base64url(SHA-256(publicKey))`. Used by the site to identify the user across signups.

The payload:

```typescript
interface ConsentTokenPayload {
  /** Issuer: the user's key fingerprint. */
  iss: string;

  /** Subject: the agent's identifier (name/version string for MVP; key fingerprint in v1.1). */
  sub: string;

  /** Audience: the site's issuer URL (from the discovery document). */
  aud: string;

  /** Issued-at timestamp in Unix seconds. */
  iat: number;

  /** Expiration timestamp in Unix seconds. MUST be at most 300s (5 min) after iat for explicit consent, up to 86400s (24h) for pre-authorized. */
  exp: number;

  /** JWT ID. The `nonce` value from the ChallengeResponse (Section 4.2). Prevents replay attacks. The site verifies this against its nonce ledger. */
  jti: string;

  /** Scope of the consent. */
  scope: {
    /** Exact list of PII field names authorized for release. */
    fields: string[];
    /** Constrained purpose enum. */
    purpose: "account_creation" | "identity_verification" | "newsletter_signup";
    /** The specific API endpoint the token is valid for. */
    site_endpoint: string;
  };

  /** SHA-256 hash of the canonical JSON of the PII payload. Binds the token to exact data values, preventing agent tampering after consent. See security.md Section 4.3. */
  data_hash: string;

  /** Whether the user was prompted or this was auto-approved. */
  consent_mode: "explicit" | "pre_authorized";

  /** If consent_mode is "pre_authorized", the ID of the matching policy. */
  policy_id?: string;

  /** Required if site demands user-presence attestation. WebAuthn assertion proving recent human interaction. */
  user_presence?: string;

  /** Required if site issues a proof-of-work challenge. */
  pow?: {
    challenge: string;
    nonce: string;
    difficulty: number;
  };
}
```

### SignupRequest

The request body submitted to the signup endpoint.

```typescript
interface SignupRequest {
  /** JWS Compact Serialization of the consent token. */
  consent_token: string;

  /**
   * The PII fields being submitted. Keys MUST match the fields listed
   * in the consent token's `fields` array.
   */
  data: Record<string, unknown>;

  /** Information about the agent performing the signup. */
  agent: {
    /** Agent identifier, e.g. "claude-code". */
    name: string;
    /** Agent version, e.g. "1.0.0". */
    version: string;
    /** MCP session ID, if the signup was initiated via MCP. */
    mcp_session_id?: string;
  };

  /**
   * UUID idempotency key. If the same key is submitted twice,
   * the server MUST return the original response without creating
   * a duplicate signup.
   */
  idempotency_key: string;
}
```

### SignupResponse

The response returned after a successful signup submission.

```typescript
interface SignupResponse {
  /** Unique identifier for this signup. Prefixed with "sgn_". */
  signup_id: string;

  /** Current status of the signup. */
  status: SignupStatus;

  /** Verification details. */
  verification: {
    /** Whether verification is required before the signup is active. */
    required: boolean;
    /** The verification method. */
    method: "email" | "phone" | "none";
    /** Masked destination, e.g. "j***@example.com". Only present if required is true. */
    sent_to?: string;
  };

  /** ISO 8601 datetime when the signup was created. */
  created_at: string;

  /** ISO 8601 datetime when a pending signup will be purged if not verified. */
  expires_at?: string;
}
```

### SignupStatus

```typescript
type SignupStatus =
  | "pending_verification"  // Awaiting email or phone verification
  | "active"                // Signup complete and verified
  | "rejected"              // Site rejected the signup
  | "expired";              // Verification window elapsed without completion
```

### ChallengeRequest

```typescript
interface ChallengeRequest {
  /** The user's base64url-encoded Ed25519 public key. */
  public_key: string;

  /** The site's issuer URL (from the discovery document). */
  site: string;
}
```

### ChallengeResponse

```typescript
interface ChallengeResponse {
  /** 32 bytes of cryptographic randomness, base64url-encoded. Single-use. */
  nonce: string;

  /** ISO 8601 datetime. The nonce is invalid after this time. Typically 5 minutes from issuance. */
  expires_at: string;
}
```

### PreAuthorizedPolicy

Defines a rule that allows the user-side SDK to auto-approve consent for matching signup requests without prompting the user.

```typescript
interface PreAuthorizedPolicy {
  /** Unique identifier for this policy (UUID). */
  policy_id: string;

  /** The user's keyId that owns this policy. */
  user_key_id: string;

  /** Scopes this policy pre-authorizes, e.g. ["signup.basic"]. */
  scopes: string[];

  /** Fields the agent may share without prompting, e.g. ["email", "full_name"]. */
  field_allowlist: string[];

  /**
   * Glob patterns for allowed site domains.
   * Examples: ["*.example.com"], ["acme.com", "beta.io"], ["*"] (all sites).
   */
  site_patterns: string[];

  /** Optional maximum number of times this policy can be used. */
  max_uses?: number;

  /** ISO 8601 datetime when this policy expires. */
  expires_at: string;

  /** ISO 8601 datetime when this policy was created. */
  created_at: string;
}
```

### Address

A structured address sub-type used when a site requires address information.

```typescript
interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "GB", "DE". */
  country: string;
}
```

### AgentSignupError

All error responses from the protocol use this structure.

```typescript
interface AgentSignupError {
  error: {
    /** Machine-readable error code. */
    code: AgentSignupErrorCode;
    /** Human-readable error message. */
    message: string;
    /** Optional additional details (e.g., which field failed validation). */
    details?: Record<string, unknown>;
    /** Unique identifier for this request, for debugging and support. */
    request_id: string;
  };
}
```

### AgentSignupErrorCode

```typescript
type AgentSignupErrorCode =
  | "DISCOVERY_NOT_FOUND"       // The site does not publish a discovery document
  | "INVALID_CONSENT_TOKEN"     // The consent token could not be parsed as valid JWS
  | "CONSENT_EXPIRED"           // The consent token's exp claim is in the past
  | "CONSENT_SCOPE_MISMATCH"    // The token's scopes do not match the site's requirements
  | "CHALLENGE_EXPIRED"         // The nonce in the token has expired
  | "CHALLENGE_REUSE"           // The nonce has already been consumed
  | "INVALID_SIGNATURE"         // The Ed25519 signature verification failed
  | "MISSING_REQUIRED_FIELD"    // A required field is absent from the data payload
  | "FIELD_VALIDATION_FAILED"   // A field value does not pass the site's validation rules
  | "DUPLICATE_SIGNUP"          // An account with this email (or other unique field) already exists
  | "RATE_LIMITED"              // Too many requests; check Retry-After header
  | "VERIFICATION_FAILED"       // The verification code or token is invalid
  | "SIGNUP_EXPIRED"            // The signup's verification window has elapsed
  | "INTERNAL_ERROR";           // Unexpected server error; do not retry immediately
```

---

## 4. REST API

All endpoints are prefixed with `/api/v1/agent-signup` unless otherwise noted. All requests and responses use `Content-Type: application/json`. All endpoints MUST be served over HTTPS.

### Rate Limiting

Every endpoint MAY return rate limiting headers. When present, agents MUST respect them.

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1711627200
Retry-After: 30
```

Default rate limits per IP address:

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Challenge | 60 seconds | 10 |
| Signup | 60 seconds | 5 |
| Status | 60 seconds | 30 |
| Verify | 60 seconds | 10 |

Per public key (across all IPs):

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Challenge | 1 hour | 60 |
| Signup | 1 hour | 20 |

---

### 4.1 Discovery

**`GET /.well-known/agent-signup.json`**

Returns the site's discovery document. No authentication required. Publicly cacheable.

**Request**

No request body or special headers required.

**Response: 200 OK**

```
Content-Type: application/json
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "v1-a3f2b8c1"
```

```json
{
  "protocol_version": "1.0",
  "issuer": "https://example.com",
  "updated_at": "2026-03-28T00:00:00Z",
  "endpoints": {
    "signup": "/api/v1/agent-signup/signup",
    "status": "/api/v1/agent-signup/status",
    "verify_callback": "/api/v1/agent-signup/verify"
  },
  "fields": {
    "required": [
      {
        "field": "email",
        "type": "email",
        "required": true,
        "purpose": "Account identification and verification"
      },
      {
        "field": "full_name",
        "type": "string",
        "required": true,
        "purpose": "Account display name"
      }
    ],
    "optional": []
  },
  "consent": {
    "scopes": [
      {
        "scope": "signup.basic",
        "fields": ["email", "full_name"],
        "description": "Create an account with your name and email"
      }
    ],
    "token_max_age_seconds": 300,
    "requires_email_verification": true
  },
  "security": {
    "supported_algorithms": ["EdDSA"],
    "challenge_required": true,
    "rate_limit": {
      "requests_per_minute": 10,
      "burst": 3
    }
  },
  "branding": {
    "name": "Example Service",
    "privacy_policy_url": "https://example.com/privacy",
    "terms_url": "https://example.com/terms"
  }
}
```

**Error Responses**

| Status | Meaning |
|--------|---------|
| 404 Not Found | The site does not support agent signup. |

---

### 4.2 Challenge

**`POST /api/v1/agent-signup/challenge`**

Request a cryptographic challenge nonce from the site. The nonce MUST be included in the consent token to prevent replay attacks. Nonces are single-use and expire after 5 minutes.

**Request**

```
Content-Type: application/json
```

```json
{
  "public_key": "dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybA",
  "site": "https://example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `public_key` | string | Yes | Base64url-encoded Ed25519 public key. |
| `site` | string | Yes | The site's issuer URL. MUST match the `issuer` in the discovery document. |

**Response: 200 OK**

```json
{
  "nonce": "k7Hq9xR2mN5vPjW3yL8tA0sF6dE4cB1g",
  "expires_at": "2026-03-28T12:05:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `nonce` | string | 32 bytes of cryptographic randomness, base64url-encoded. |
| `expires_at` | string | ISO 8601 datetime. The nonce MUST NOT be accepted after this time. |

**Error Responses**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 Bad Request | `FIELD_VALIDATION_FAILED` | Invalid public key format. |
| 429 Too Many Requests | `RATE_LIMITED` | Rate limit exceeded. Check `Retry-After` header. |

**Example**

```
POST /api/v1/agent-signup/challenge HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "public_key": "dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybA",
  "site": "https://example.com"
}
```

```
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1711627260

{
  "nonce": "k7Hq9xR2mN5vPjW3yL8tA0sF6dE4cB1g",
  "expires_at": "2026-03-28T12:05:00Z"
}
```

---

### 4.3 Signup

**`POST /api/v1/agent-signup/signup`**

Submit a signup request on behalf of a user. Requires a valid consent token signed by the user's Ed25519 private key. The consent token proves the user authorized sharing the specific fields with this specific site.

**Request**

```
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

```json
{
  "consent_token": "eyJhbGciOiJFZERTQSIsImtpZCI6ImFiY2RlZjEyMzQ1NiIsImp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCIG...",
  "data": {
    "email": "jane@example.com",
    "full_name": "Jane Doe"
  },
  "agent": {
    "name": "claude-code",
    "version": "1.0.0"
  },
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `consent_token` | string | Yes | JWS Compact Serialization of the signed consent token. |
| `data` | object | Yes | PII fields. Keys MUST match the `fields` array in the consent token payload. |
| `agent.name` | string | Yes | Agent identifier. |
| `agent.version` | string | Yes | Agent version string. |
| `agent.mcp_session_id` | string | No | MCP session ID if applicable. |
| `idempotency_key` | string | Yes | UUID. Safe retries: same key returns the original response. |

**Consent Token Verification (performed by site)**

The site MUST perform the following checks in order before processing the signup:

1. Parse the JWS Compact Serialization.
2. Extract the header. Verify `alg` is `"EdDSA"` and `typ` is `"agent-signup-consent+jwt"`.
3. Verify the Ed25519 signature against the public key derived from the `kid` in the header.
4. Parse the payload:
   - (a) `aud` MUST match this site's `issuer` URL.
   - (b) `exp` MUST be greater than the current time.
   - (c) `jti` MUST match a previously issued, unused challenge nonce for this site.
   - (d) `scope.fields` MUST be a superset of the keys in the submitted `data` object.
   - (e) `scope.purpose` MUST be a valid purpose for this site.
   - (f) `data_hash` MUST match `sha256(<canonical JSON of submitted data>)`. This is the critical integrity check -- it proves the submitted data matches what the user consented to. See `security.md` Section 4.3.
5. Mark the `jti` as consumed (single-use).

**Response: 201 Created**

```json
{
  "signup_id": "sgn_abc123def456",
  "status": "pending_verification",
  "verification": {
    "required": true,
    "method": "email",
    "sent_to": "j***@example.com"
  },
  "created_at": "2026-03-28T12:00:00Z",
  "expires_at": "2026-03-28T12:30:00Z"
}
```

**Error Responses**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 Bad Request | `MISSING_REQUIRED_FIELD` | A required field is absent from `data`. |
| 400 Bad Request | `FIELD_VALIDATION_FAILED` | A field value does not pass validation. |
| 401 Unauthorized | `INVALID_CONSENT_TOKEN` | The consent token is malformed. |
| 401 Unauthorized | `INVALID_SIGNATURE` | Signature verification failed. |
| 401 Unauthorized | `CONSENT_EXPIRED` | The token's `exp` is in the past. |
| 409 Conflict | `DUPLICATE_SIGNUP` | An account with this email already exists. |
| 422 Unprocessable Entity | `CONSENT_SCOPE_MISMATCH` | Token scopes do not match site requirements. |
| 422 Unprocessable Entity | `CHALLENGE_EXPIRED` | The nonce has expired. |
| 422 Unprocessable Entity | `CHALLENGE_REUSE` | The nonce was already consumed. |
| 429 Too Many Requests | `RATE_LIMITED` | Rate limit exceeded. |

**Example**

```
POST /api/v1/agent-signup/signup HTTP/1.1
Host: example.com
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "consent_token": "eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJhYmNkZWYxMjM0NTYiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoxNzExNjI3MDAwLCJleHAiOjE3MTE2MjczMDAsIm5vbmNlIjoiazdIcTl4UjJtTjV2UGpXM3lMOHRBMHNGNmRFNGNCMWciLCJzY29wZXMiOlsic2lnbnVwLmJhc2ljIl0sImZpZWxkcyI6WyJlbWFpbCIsImZ1bGxfbmFtZSJdLCJjb25zZW50X21vZGUiOiJpbnRlcmFjdGl2ZSJ9.SIGNATURE",
  "data": {
    "email": "jane@example.com",
    "full_name": "Jane Doe"
  },
  "agent": {
    "name": "claude-code",
    "version": "1.0.0"
  },
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
}
```

```
HTTP/1.1 201 Created
Content-Type: application/json
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1711627260

{
  "signup_id": "sgn_abc123def456",
  "status": "pending_verification",
  "verification": {
    "required": true,
    "method": "email",
    "sent_to": "j***@example.com"
  },
  "created_at": "2026-03-28T12:00:00Z",
  "expires_at": "2026-03-28T12:30:00Z"
}
```

---

### 4.4 Status

**`GET /api/v1/agent-signup/status/:signup_id`**

Poll the current status of a signup, including whether email verification is complete.

**Request**

```
Authorization: Bearer <consent_token>
```

The `Authorization` header MUST contain a valid consent token -- either the same token used during signup, or a freshly signed token from the same keypair. The site MUST verify that the token's public key matches the key used for the original signup.

**Response: 200 OK**

```json
{
  "signup_id": "sgn_abc123def456",
  "status": "pending_verification",
  "verification": {
    "required": true,
    "method": "email",
    "sent_to": "j***@example.com",
    "verified": false,
    "expires_at": "2026-03-28T12:30:00Z"
  },
  "created_at": "2026-03-28T12:00:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `signup_id` | string | The signup identifier. |
| `status` | `SignupStatus` | Current status. |
| `verification.required` | boolean | Whether verification is required. |
| `verification.method` | string | `"email"`, `"phone"`, or `"none"`. |
| `verification.sent_to` | string | Masked destination. |
| `verification.verified` | boolean | Whether verification is complete. |
| `verification.expires_at` | string | When the verification window closes. |
| `created_at` | string | ISO 8601 creation datetime. |

**Error Responses**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 Unauthorized | `INVALID_CONSENT_TOKEN` | Missing, malformed, or invalid consent token. |
| 404 Not Found | -- | Signup ID not found or not owned by the requesting key. |

**Example**

```
GET /api/v1/agent-signup/status/sgn_abc123def456 HTTP/1.1
Host: example.com
Authorization: Bearer eyJhbGciOiJFZERTQSJ9...
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "signup_id": "sgn_abc123def456",
  "status": "active",
  "verification": {
    "required": true,
    "method": "email",
    "sent_to": "j***@example.com",
    "verified": true,
    "expires_at": "2026-03-28T12:30:00Z"
  },
  "created_at": "2026-03-28T12:00:00Z"
}
```

---

### 4.5 Verify

**`POST /api/v1/agent-signup/verify`**

Submit a verification code to complete a pending signup. The code is obtained from the verification email sent to the user.

**Request**

```
Content-Type: application/json
```

```json
{
  "signup_id": "sgn_abc123def456",
  "verification_code": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signup_id` | string | Yes | The signup identifier. |
| `verification_code` | string | Yes | The 6-digit code from the verification email. |

**Response: 200 OK**

```json
{
  "signup_id": "sgn_abc123def456",
  "status": "active",
  "verified_at": "2026-03-28T12:03:00Z"
}
```

**Magic Link (GET)**

The verification email also contains a magic link. When the user clicks it, the browser hits:

```
GET /api/v1/agent-signup/verify?signup_id=sgn_abc123def456&code=<token>
```

The server validates the token and responds with:

```
HTTP/1.1 302 Found
Location: /signup-confirmed
```

The redirect target is configurable by the site.

**Error Responses**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 Bad Request | `VERIFICATION_FAILED` | The code is invalid or does not match. |
| 404 Not Found | -- | Signup not found. |
| 410 Gone | `SIGNUP_EXPIRED` | The verification window has closed. |

**Example**

```
POST /api/v1/agent-signup/verify HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "signup_id": "sgn_abc123def456",
  "verification_code": "483921"
}
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "signup_id": "sgn_abc123def456",
  "status": "active",
  "verified_at": "2026-03-28T12:03:00Z"
}
```

---

### 4.6 Delete / Revoke

**`DELETE /api/v1/agent-signup/signup/:signup_id`**

Revoke a signup and request data deletion. The user (via their agent) can revoke any signup they created.

**Request**

```
Authorization: Bearer <consent_token>
```

The consent token MUST be signed by the same keypair that created the original signup.

**Response: 200 OK**

```json
{
  "signup_id": "sgn_abc123def456",
  "status": "revoked",
  "revoked_at": "2026-03-28T15:00:00Z"
}
```

**Error Responses**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 Unauthorized | `INVALID_CONSENT_TOKEN` | Missing or invalid consent token. |
| 404 Not Found | -- | Signup not found or not owned by the requesting key. |

**Example**

```
DELETE /api/v1/agent-signup/signup/sgn_abc123def456 HTTP/1.1
Host: example.com
Authorization: Bearer eyJhbGciOiJFZERTQSJ9...
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "signup_id": "sgn_abc123def456",
  "status": "revoked",
  "revoked_at": "2026-03-28T15:00:00Z"
}
```

---

## 5. MCP Tool Definitions

The site-side SDK optionally exposes an MCP (Model Context Protocol) server so that MCP-compatible agents can interact with the signup protocol natively, without manually constructing HTTP requests. Each tool wraps one or more REST endpoints.

### 5.1 agent_signup_discover

Discover a site's agent signup requirements, including required fields, consent scopes, and branding information.

**Input Schema**

```json
{
  "name": "agent_signup_discover",
  "description": "Discover a site's agent signup requirements, including required fields, consent scopes, and branding information.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": {
        "type": "string",
        "description": "The base URL of the site to discover signup requirements for (e.g. 'https://example.com')"
      }
    },
    "required": ["site_url"]
  }
}
```

**Output Schema**

The full discovery document as defined in [Section 2](#2-discovery-protocol). The output is the JSON object returned by `GET {site_url}/.well-known/agent-signup.json`.

```json
{
  "type": "object",
  "properties": {
    "protocol_version": { "type": "string" },
    "issuer": { "type": "string" },
    "updated_at": { "type": "string" },
    "endpoints": { "type": "object" },
    "fields": { "type": "object" },
    "consent": { "type": "object" },
    "security": { "type": "object" },
    "branding": { "type": "object" }
  }
}
```

**Behavior**

1. Fetches `{site_url}/.well-known/agent-signup.json`.
2. Follows up to 3 redirects.
3. Validates the response against the discovery schema.
4. Returns the parsed discovery document or an error.

---

### 5.2 agent_signup_request_challenge

Request a cryptographic challenge nonce from the site. The nonce MUST be included in the consent token to prevent replay attacks. Nonces expire after 5 minutes.

**Input Schema**

```json
{
  "name": "agent_signup_request_challenge",
  "description": "Request a cryptographic challenge nonce from the site. This nonce must be included in the consent token to prevent replay attacks. Nonces expire after 5 minutes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": {
        "type": "string",
        "description": "The base URL of the site"
      },
      "public_key": {
        "type": "string",
        "description": "The user's base64url-encoded Ed25519 public key"
      }
    },
    "required": ["site_url", "public_key"]
  }
}
```

**Output Schema**

```json
{
  "type": "object",
  "properties": {
    "nonce": {
      "type": "string",
      "description": "Base64url-encoded 32-byte random nonce"
    },
    "expires_at": {
      "type": "string",
      "description": "ISO 8601 datetime when the nonce expires"
    }
  },
  "required": ["nonce", "expires_at"]
}
```

**Behavior**

1. Resolves the challenge endpoint from the site's discovery document, or uses the default path `/api/v1/agent-signup/challenge`.
2. POSTs the `public_key` and `site` URL.
3. Returns the nonce and its expiration.

---

### 5.3 agent_signup_submit

Submit a signup request to a site on behalf of a user. Requires a valid consent token signed by the user's private key.

**Input Schema**

```json
{
  "name": "agent_signup_submit",
  "description": "Submit a signup request to a site on behalf of a user. Requires a valid consent token signed by the user's private key, which proves the user authorized sharing specific fields with this site.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": {
        "type": "string",
        "description": "The base URL of the site"
      },
      "consent_token": {
        "type": "string",
        "description": "JWS compact serialization of the consent token, signed by the user's Ed25519 private key"
      },
      "data": {
        "type": "object",
        "description": "The user's PII fields matching the consented scope (e.g. email, full_name)"
      },
      "idempotency_key": {
        "type": "string",
        "description": "UUID for safe retries"
      }
    },
    "required": ["site_url", "consent_token", "data", "idempotency_key"]
  }
}
```

**Output Schema**

```json
{
  "type": "object",
  "properties": {
    "signup_id": {
      "type": "string",
      "description": "Unique signup identifier (prefixed with sgn_)"
    },
    "status": {
      "type": "string",
      "enum": ["pending_verification", "active", "rejected", "expired"],
      "description": "Current signup status"
    },
    "verification": {
      "type": "object",
      "properties": {
        "required": { "type": "boolean" },
        "method": { "type": "string", "enum": ["email", "phone", "none"] },
        "sent_to": { "type": "string" }
      }
    },
    "created_at": { "type": "string" },
    "expires_at": { "type": "string" }
  },
  "required": ["signup_id", "status", "verification", "created_at"]
}
```

**Behavior**

1. Resolves the signup endpoint from the site's discovery document.
2. POSTs the consent token, data, agent metadata, and idempotency key.
3. The agent's `name` and `version` are automatically populated by the MCP server.
4. Returns the signup response including status and verification details.

---

### 5.4 agent_signup_check_status

Check the current status of a signup, including whether email verification is complete.

**Input Schema**

```json
{
  "name": "agent_signup_check_status",
  "description": "Check the current status of a signup, including whether email verification is complete.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": {
        "type": "string",
        "description": "The base URL of the site"
      },
      "signup_id": {
        "type": "string",
        "description": "The signup ID returned from the submit call"
      },
      "consent_token": {
        "type": "string",
        "description": "A valid consent token for authorization"
      }
    },
    "required": ["site_url", "signup_id", "consent_token"]
  }
}
```

**Output Schema**

```json
{
  "type": "object",
  "properties": {
    "signup_id": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["pending_verification", "active", "rejected", "expired"]
    },
    "verification": {
      "type": "object",
      "properties": {
        "required": { "type": "boolean" },
        "method": { "type": "string" },
        "sent_to": { "type": "string" },
        "verified": { "type": "boolean" },
        "expires_at": { "type": "string" }
      }
    },
    "created_at": { "type": "string" }
  },
  "required": ["signup_id", "status"]
}
```

**Behavior**

1. Resolves the status endpoint from the site's discovery document.
2. GETs the status using the signup ID as a path parameter.
3. Passes the consent token in the `Authorization: Bearer` header.
4. Returns the current signup status and verification state.

---

### 5.5 agent_signup_verify

Submit an email verification code to complete a pending signup.

**Input Schema**

```json
{
  "name": "agent_signup_verify",
  "description": "Submit an email verification code to complete a pending signup. The code is typically obtained from the verification email sent to the user.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": {
        "type": "string",
        "description": "The base URL of the site"
      },
      "signup_id": {
        "type": "string",
        "description": "The signup ID"
      },
      "verification_code": {
        "type": "string",
        "description": "The 6-digit verification code from the email"
      }
    },
    "required": ["site_url", "signup_id", "verification_code"]
  }
}
```

**Output Schema**

```json
{
  "type": "object",
  "properties": {
    "signup_id": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["active"]
    },
    "verified_at": {
      "type": "string",
      "description": "ISO 8601 datetime when verification completed"
    }
  },
  "required": ["signup_id", "status", "verified_at"]
}
```

**Behavior**

1. Resolves the verify endpoint from the site's discovery document.
2. POSTs the signup ID and verification code.
3. Returns the updated signup status. On success, status is `"active"`.

---

## 6. Consent Flow

Consent is the mechanism by which the user authorizes their agent to share specific PII with a specific site. The protocol supports two consent modes.

### 6.1 Interactive Consent

In interactive mode, the user is shown a prompt for each signup request and must explicitly approve or deny it. This is the default mode.

```
Agent                    User-Side SDK              Site
  |                          |                        |
  |-- 1. GET /.well-known/agent-signup.json --------->|
  |<----------- Discovery Document -------------------|
  |                          |                        |
  |-- 2. POST /challenge { public_key } ------------->|
  |<----------- { nonce, expires_at } ----------------|
  |                          |                        |
  |-- 3. Present consent  -->|                        |
  |   request to user        |                        |
  |                          |                        |
  |        [User reviews: site name, fields,          |
  |         ToS link. Approves or denies.]            |
  |                          |                        |
  |<-- 4. signConsent()  ----|                        |
  |   Returns signed JWS     |                        |
  |   consent token           |                        |
  |                          |                        |
  |<-- 5. getField() -------|                        |
  |   PII from vault         |                        |
  |                          |                        |
  |-- 6. POST /signup { consent_token, data } ------->|
  |                          |              [Verify    |
  |                          |               signature,|
  |                          |               nonce,    |
  |                          |               fields]   |
  |                          |                        |
  |<-- 7. { signup_id, status: pending } -------------|
  |                          |                        |
  |                          |    [Site sends email]  |
  |                          |                        |
  |-- 8. Notify user:    -->|                        |
  |   "Check your email"    |                        |
  |                          |                        |
  |        [User clicks link or reads code]           |
  |                          |                        |
  |-- 9. POST /verify { signup_id, code } ----------->|
  |<-- 10. { status: active } -------------------------|
  |                          |                        |
  |-- 11. "Signup complete!"|                        |
```

**Step-by-step:**

1. The agent fetches the site's discovery document to learn what fields are required and what scopes are available.
2. The agent requests a challenge nonce from the site. The nonce is bound to the user's public key and expires after 5 minutes.
3. The agent presents the consent request to the user via the user-side SDK. The prompt displays the site name, URL, requested fields (distinguishing required from optional), and a link to the site's terms of service.
4. If the user approves, the user-side SDK signs a consent token (JWS) with the user's Ed25519 private key. The token includes the nonce, the granted scopes, the list of fields, and the audience (site URL).
5. The agent retrieves the PII values from the user's vault for the consented fields.
6. The agent submits the signup request to the site with the consent token and PII data.
7. The site verifies the token (signature, nonce, expiry, scope, field coverage), processes the signup, and returns a response. If email verification is required, status is `"pending_verification"`.
8. The agent notifies the user to check their email.
9. Once the user provides the verification code (or clicks the magic link), the agent (or browser) submits it.
10. The site confirms verification and updates the status to `"active"`.
11. The agent informs the user that signup is complete.

### 6.2 Pre-Authorized Consent

In pre-authorized mode, the user has previously configured a policy that auto-approves signups matching certain criteria. No user prompt is shown.

```
Agent                    User-Side SDK              Site
  |                          |                        |
  |-- 1. GET /.well-known/agent-signup.json --------->|
  |<----------- Discovery Document -------------------|
  |                          |                        |
  |-- 2. matchPolicy()   -->|                        |
  |   (check for matching   |                        |
  |    pre-auth rule)        |                        |
  |<-- Policy match found ---|                        |
  |                          |                        |
  |-- 3. POST /challenge { public_key } ------------->|
  |<----------- { nonce, expires_at } ----------------|
  |                          |                        |
  |-- 4. signConsent()   -->|                        |
  |   (auto-sign, no user   |                        |
  |    prompt required)      |                        |
  |<-- Signed JWS token  ---|                        |
  |   consent_mode:          |                        |
  |     "pre_authorized"     |                        |
  |   policy_id: "..."       |                        |
  |                          |                        |
  |<-- getField() ----------|                        |
  |   PII from vault         |                        |
  |                          |                        |
  |-- 5. POST /signup { consent_token, data } ------->|
  |<-- 6. { signup_id, status: pending } -------------|
  |                          |                        |
  |        [Email verification still required]        |
  |        [Same flow as interactive from here]       |
```

**Policy matching rules:**

- The policy's `site_patterns` MUST match the site's domain (glob matching).
- The policy's `scopes` MUST be a superset of the requested scopes.
- The policy's `field_allowlist` MUST be a superset of the requested fields.
- The policy MUST NOT be expired (`expires_at` > now).
- If the policy has `max_uses`, it MUST NOT have been exhausted.
- If no policy matches, the agent MUST fall back to interactive consent.
- If multiple policies match, the most specific one (fewest `site_patterns` wildcards) SHOULD be used.

**Key difference:** The consent token includes `consent_mode: "pre_authorized"` and the `policy_id`. The site MAY log this but MUST NOT treat pre-authorized consent differently for verification purposes -- email verification is still required if the discovery document says so.

### 6.3 Challenge-Response Mechanism

The challenge-response mechanism prevents replay attacks. Without it, an attacker who intercepts a consent token could reuse it to create unauthorized signups.

**How it works:**

1. Before signing a consent token, the agent requests a fresh nonce from the site via `POST /challenge`.
2. The site generates 32 bytes of cryptographic randomness, base64url-encodes it, stores it with a 5-minute TTL, and returns it.
3. The nonce is embedded in the consent token's `nonce` field before signing.
4. When the site receives the signup request, it verifies the nonce:
   - The nonce MUST exist in the site's nonce store.
   - The nonce MUST NOT have been used before (single-use).
   - The nonce MUST NOT be expired.
5. After successful verification, the nonce is marked as consumed and cannot be reused.

**Properties:**

- Nonces are bound to a specific site (by the `site` parameter in the challenge request).
- Nonces expire after 5 minutes (configurable by the site, minimum 60 seconds).
- Nonces are single-use: consuming a nonce is atomic.
- The nonce store SHOULD be backed by Redis or an equivalent store with automatic TTL-based expiry.

---

## 7. Email Verification Flow

When a site's discovery document specifies `requires_email_verification: true`, the signup is not considered active until the user verifies their email address.

### 7.1 Design Principles

- **The site sends the email.** The site controls its own verification flow, branding, email deliverability, SPF/DKIM configuration, and template.
- **Dual path.** The user can verify by (a) clicking a magic link in the email or (b) entering a 6-digit numeric code. Path (b) enables programmatic verification by the agent.
- **30-minute window.** The verification code and magic link expire 30 minutes after the signup is created. The site MAY configure a different window, but it MUST NOT exceed 24 hours.

### 7.2 Flow

```
1. Agent submits signup
   POST /api/v1/agent-signup/signup
   Response: { status: "pending_verification", expires_at: "..." }

2. Site creates signup record with status "pending_verification"

3. Site generates:
   a. A 6-digit numeric code (for programmatic verification)
   b. A magic link token (longer, for click-through verification)
   Both share the same expiration time.

4. Site sends verification email to the address in the signup data

5. Agent receives the response and knows verification is required
```

**Path A: User clicks magic link**

```
6a. User receives email and clicks the magic link
7a. Browser hits: GET /api/v1/agent-signup/verify?signup_id=X&code=Y
8a. Site validates the token, updates status to "active"
9a. Site redirects browser to a confirmation page (302 Found)
10a. Agent polls GET /status/:id, sees status: "active"
```

**Path B: Agent submits code programmatically**

```
6b. User receives email and reads the 6-digit code
7b. User tells the agent the code (or the user-side SDK extracts it)
8b. Agent calls POST /api/v1/agent-signup/verify
    { signup_id: "...", verification_code: "123456" }
9b. Site validates the code, updates status to "active"
10b. Agent receives { status: "active" } directly
```

### 7.3 Polling

While waiting for verification, the agent SHOULD poll the status endpoint with exponential backoff:

- Initial interval: 5 seconds
- Backoff multiplier: 2x
- Maximum interval: 30 seconds
- Maximum total polling time: 30 minutes (matching the verification window)

If the site includes a `Retry-After` header in the status response, the agent MUST respect it.

### 7.4 Resend Mechanism

If the user does not receive the verification email, the agent MAY re-submit the original signup request with the same `idempotency_key`. The site MUST NOT create a duplicate signup but SHOULD resend the verification email if the original signup is still in `pending_verification` status and the verification window has not expired.

Sites SHOULD limit resends to 3 per signup to prevent abuse.

### 7.5 Verification Email Requirements

The site-side SDK provides a default email template. Sites MAY customize the template, but it MUST include:

- The site's name (from the `branding.name` field in the discovery document).
- A clear statement: "An AI agent acting on your behalf requested to sign up for [Site Name]."
- The 6-digit verification code, prominently displayed.
- A magic link button or link.
- A "This wasn't me" link that revokes the signup (hits `DELETE /signup/:id` or equivalent).
- The expiration time of the code.

---

## 8. Error Handling

### 8.1 Structured Error Format

All error responses from the protocol use the `AgentSignupError` format:

```json
{
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "The field 'email' is required but was not provided.",
    "details": {
      "field": "email",
      "expected_type": "email"
    },
    "request_id": "req_7f3a2b1c9d4e"
  }
}
```

The `code` field is a machine-readable string from the `AgentSignupErrorCode` enum. The `message` field is human-readable and MAY vary across implementations. The `details` field is optional and provides additional context specific to the error type. The `request_id` field is a unique identifier for the request, useful for debugging and support.

### 8.2 Error Codes

| Code | HTTP Status | Description | Retryable |
|------|-------------|-------------|-----------|
| `DISCOVERY_NOT_FOUND` | 404 | The site does not publish an agent-signup discovery document at `/.well-known/agent-signup.json`. | No |
| `INVALID_CONSENT_TOKEN` | 401 | The consent token could not be parsed as a valid JWS Compact Serialization. The token may be malformed, truncated, or not a JWS at all. | No (fix the token) |
| `CONSENT_EXPIRED` | 401 | The consent token's `exp` claim is in the past. The user must re-consent. | Yes (re-consent) |
| `CONSENT_SCOPE_MISMATCH` | 422 | The scopes in the consent token do not match the scopes required by the site. The agent may be requesting a scope the site does not define. | No (fix scopes) |
| `CHALLENGE_EXPIRED` | 422 | The nonce embedded in the consent token has expired (older than 5 minutes). Request a new challenge. | Yes (new challenge) |
| `CHALLENGE_REUSE` | 422 | The nonce has already been consumed by a previous signup request. Request a new challenge and re-sign the consent token. | Yes (new challenge) |
| `INVALID_SIGNATURE` | 401 | The Ed25519 signature on the consent token failed verification. The token may have been tampered with, or the wrong key was used. | No (re-sign) |
| `MISSING_REQUIRED_FIELD` | 422 | A field marked as `required` in the discovery document is absent from the signup `data` payload. The `details` object includes the field name. | No (provide field) |
| `FIELD_VALIDATION_FAILED` | 422 | A field value does not match the expected type or validation rules. For example, an invalid email format. The `details` object includes the field name and the reason. | No (fix value) |
| `DUPLICATE_SIGNUP` | 409 | An account with the same unique identifier (typically email) already exists at this site. | No |
| `RATE_LIMITED` | 429 | Too many requests. The `Retry-After` header indicates when the agent may retry. | Yes (after delay) |
| `VERIFICATION_FAILED` | 400 | The submitted verification code does not match, or the code has been invalidated by too many failed attempts. | Yes (retry with correct code) |
| `SIGNUP_EXPIRED` | 410 | The signup's verification window has elapsed. The signup record is no longer valid. The agent must start a new signup flow from the challenge step. | Yes (start over) |
| `INTERNAL_ERROR` | 500 | An unexpected server error occurred. The `request_id` can be shared with the site's support team for investigation. | Yes (with backoff) |

### 8.3 Retry Semantics

Agents SHOULD implement the following retry behavior:

**Retryable errors** (agent SHOULD retry automatically):

| Error | Strategy |
|-------|----------|
| `RATE_LIMITED` | Wait for the duration specified in the `Retry-After` header, then retry the same request. |
| `CHALLENGE_EXPIRED` | Request a new challenge nonce, re-sign the consent token, and resubmit. |
| `CHALLENGE_REUSE` | Request a new challenge nonce, re-sign the consent token, and resubmit. |
| `CONSENT_EXPIRED` | Re-request consent from the user (interactive) or re-sign (pre-authorized), then resubmit. |
| `INTERNAL_ERROR` | Retry with exponential backoff: 1s, 2s, 4s, 8s, max 3 retries. If all retries fail, report the error to the user. |
| `SIGNUP_EXPIRED` | Start the entire flow over from the challenge step. |
| `VERIFICATION_FAILED` | Prompt the user for the correct code and retry. Limit to 5 attempts. |

**Non-retryable errors** (agent MUST NOT retry without user action):

| Error | Required Action |
|-------|----------------|
| `DISCOVERY_NOT_FOUND` | Inform the user that the site does not support agent signup. |
| `INVALID_CONSENT_TOKEN` | Debug the token construction. This is a client implementation error. |
| `CONSENT_SCOPE_MISMATCH` | Re-read the discovery document and request consent for the correct scopes. |
| `INVALID_SIGNATURE` | Re-sign the consent token. If this persists, the keypair may be corrupted. |
| `MISSING_REQUIRED_FIELD` | Collect the missing field from the user and resubmit. |
| `FIELD_VALIDATION_FAILED` | Correct the field value and resubmit. |
| `DUPLICATE_SIGNUP` | Inform the user they already have an account at this site. |

### 8.4 Idempotency

The `idempotency_key` in the signup request ensures safe retries. If a network failure occurs after the site processes the signup but before the agent receives the response, the agent MAY resubmit the same request with the same `idempotency_key`. The site MUST:

1. Recognize the duplicate `idempotency_key`.
2. Return the original `SignupResponse` without creating a new signup.
3. NOT resend the verification email (unless explicitly requested via the resend mechanism).

Idempotency keys SHOULD be retained by the site for at least 24 hours. After that, the site MAY treat a resubmission with the same key as a new request.
