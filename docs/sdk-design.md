# Agent Signup SDK Design

**Version:** 1.0 (Draft)
**Date:** 2026-03-28

**Companion documents:**
- `prd.md` -- Product requirements, user stories, scope
- `protocol.md` -- Wire protocol specification
- `security.md` -- Threat model, cryptography, vault design

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Package Structure](#2-package-structure)
3. [`@agent-signup/protocol` -- Shared Package](#3-agent-signupprotocol----shared-package)
4. [`@agent-signup/site` -- Site-Side SDK](#4-agent-signupsite----site-side-sdk)
5. [`@agent-signup/client` -- User-Side SDK](#5-agent-signupclient----user-side-sdk)
6. [`@agent-signup/agent` -- Agent-Side Tools](#6-agent-signupagent----agent-side-tools)
7. [Integration Patterns](#7-integration-patterns)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Architecture Overview

The Agent Signup system consists of four npm packages organized in a monorepo. Three are consumer-facing, one is shared infrastructure.

```
                     @agent-signup/protocol
                    (Zod schemas, Ed25519 utils,
                     consent token creation/validation,
                     error codes)
                           |
          +----------------+----------------+
          |                |                |
  @agent-signup/site  @agent-signup/client  @agent-signup/agent
  (Site installs this) (User installs this) (Agent framework uses)
  - Serves manifest    - Encrypted vault    - REST client
  - Verifies tokens    - Consent UI         - MCP tool defs
  - Handles signups    - Key management     - Discovery cache
  - Rate limiting      - Signup history     - Polling with backoff
```

### Design Principles

- **Minimal surface area.** Each package exposes the fewest possible exports. The site SDK's primary export is a single function (`createAgentSignupHandler`).
- **Type-safe end-to-end.** Zod schemas in `@agent-signup/protocol` generate TypeScript types used by all packages. A field defined in a manifest is typed through discovery, consent, submission, and verification.
- **Framework-agnostic core.** The protocol package has zero framework dependencies. Site and client packages provide framework-specific adapters.
- **Secure defaults.** Rate limiting is on by default. Token expiry is short by default. The vault auto-locks by default. Insecure configurations require explicit opt-in.

---

## 2. Package Structure

```
agent-signup/
  packages/
    protocol/           # Shared schemas, crypto, types
      src/
        schemas/        # Zod schemas for all protocol types
        crypto/         # Ed25519 signing/verification, HKDF, Argon2id
        tokens/         # Consent token creation, validation, parsing
        errors/         # Error code constants and error builder
        index.ts        # Public API
      package.json      # @agent-signup/protocol

    site/               # Site-side SDK
      src/
        handler/        # createAgentSignupHandler + framework adapters
        verification/   # Email verification flow
        middleware/      # Rate limiting, nonce management
        manifest/       # Discovery document generation
        index.ts        # Public API
      package.json      # @agent-signup/site

    client/             # User-side SDK
      src/
        vault/          # Encrypted storage (IndexedDB, file, keychain)
        keys/           # Ed25519 keypair management
        consent/        # Consent UI component + token signing
        policies/       # Pre-authorized scope management
        history/        # Signup history log
        index.ts        # Public API
      package.json      # @agent-signup/client

    agent/              # Agent-side tools
      src/
        rest/           # REST client for all 6 endpoints
        mcp/            # MCP tool definitions
        discovery/      # Manifest fetching + cache
        polling/        # Verification status polling with backoff
        index.ts        # Public API
      package.json      # @agent-signup/agent

  turbo.json            # Turborepo task config
  package.json          # Workspace root
```

### Dependency Graph

```
@agent-signup/site     --> @agent-signup/protocol
@agent-signup/client   --> @agent-signup/protocol
@agent-signup/agent    --> @agent-signup/protocol
```

No circular dependencies. No cross-dependencies between site/client/agent.

### Peer Dependencies

| Package | Peer Dependencies |
|---------|-------------------|
| `@agent-signup/protocol` | `zod >= 3.23` |
| `@agent-signup/site` | `@agent-signup/protocol` |
| `@agent-signup/client` | `@agent-signup/protocol` |
| `@agent-signup/agent` | `@agent-signup/protocol` |

---

## 3. `@agent-signup/protocol` -- Shared Package

The foundation. Zero framework dependencies. Exports schemas, crypto utilities, token operations, and error constants.

### 3.1 Schemas

All protocol types as Zod schemas with inferred TypeScript types.

```typescript
// @agent-signup/protocol

// --- Schemas ---
export { AgentSignupDiscoverySchema } from "./schemas/discovery";
export { ConsentTokenPayloadSchema } from "./schemas/consent";
export { SignupRequestSchema, SignupResponseSchema } from "./schemas/signup";
export { ChallengeRequestSchema, ChallengeResponseSchema } from "./schemas/challenge";
export { PreAuthorizedPolicySchema } from "./schemas/policy";
export { AgentSignupErrorSchema } from "./schemas/error";

// --- Inferred Types ---
export type AgentSignupDiscovery = z.infer<typeof AgentSignupDiscoverySchema>;
export type ConsentTokenPayload = z.infer<typeof ConsentTokenPayloadSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type SignupResponse = z.infer<typeof SignupResponseSchema>;
export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;
export type PreAuthorizedPolicy = z.infer<typeof PreAuthorizedPolicySchema>;
export type AgentSignupError = z.infer<typeof AgentSignupErrorSchema>;
```

### 3.2 Crypto Utilities

Simplified two-key model: AES-256-GCM for vault encryption, Ed25519 for consent signing. Uses the Web Crypto API (browser) or Node.js `crypto` module (server).

```typescript
// @agent-signup/protocol/crypto

export interface KeyPair {
  publicKey: Uint8Array;   // 32 bytes
  privateKey: Uint8Array;  // 64 bytes (seed + public)
  keyId: string;           // base64url(SHA-256(publicKey)), first 16 chars
}

// Generate a new random Ed25519 keypair
export function generateKeyPair(): Promise<KeyPair>;

// Sign a payload
export function sign(payload: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;

// Verify a signature
export function verify(payload: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;

// Compute key fingerprint (first 16 chars of base64url(SHA-256(publicKey)))
export function fingerprint(publicKey: Uint8Array): string;

// Argon2id key derivation (passphrase + salt -> AES encryption key)
export function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array>;

// AES-256-GCM encrypt/decrypt
export function encrypt(data: Uint8Array, key: Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }>;
export function decrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, tag: Uint8Array): Promise<Uint8Array>;

// SHA-256 hash of canonical JSON (for data_hash in consent tokens)
export function canonicalHash(data: Record<string, unknown>): Promise<string>;
```

### 3.3 Token Operations

Create and validate consent tokens (JWS compact serialization).

```typescript
// @agent-signup/protocol/tokens

export interface CreateConsentTokenInput {
  userKeyPair: KeyPair;
  audience: string;            // Site origin
  nonce: string;               // Server-issued challenge
  fields: string[];            // Consented field names
  data: Record<string, unknown>; // Actual PII values (for data_hash)
  purpose: "account_creation" | "identity_verification" | "newsletter_signup";
  consentMode: "explicit" | "pre_authorized";
  expiresInSeconds?: number;   // Default: 300 (5 min)
}

// Create a signed JWS consent token
export function createConsentToken(input: CreateConsentTokenInput): Promise<string>;

export interface ValidateConsentTokenInput {
  token: string;               // JWS compact serialization
  expectedAudience: string;    // This site's origin
  nonce: string;               // The nonce this site issued
  submittedData: Record<string, unknown>; // Submitted PII (to verify data_hash)
}

export interface ValidateConsentTokenResult {
  valid: boolean;
  payload?: ConsentTokenPayload;
  publicKey?: string;          // User's public key (from JWS header)
  error?: string;              // Reason for failure
}

// Validate a consent token (signature, expiry, nonce, audience, data_hash)
export function validateConsentToken(input: ValidateConsentTokenInput): Promise<ValidateConsentTokenResult>;
```

### 3.4 Error Constants

```typescript
// @agent-signup/protocol/errors

export const ErrorCodes = {
  DISCOVERY_NOT_FOUND: "DISCOVERY_NOT_FOUND",
  INVALID_CONSENT_TOKEN: "INVALID_CONSENT_TOKEN",
  CONSENT_EXPIRED: "CONSENT_EXPIRED",
  CONSENT_SCOPE_MISMATCH: "CONSENT_SCOPE_MISMATCH",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CHALLENGE_REUSE: "CHALLENGE_REUSE",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  FIELD_VALIDATION_FAILED: "FIELD_VALIDATION_FAILED",
  DUPLICATE_SIGNUP: "DUPLICATE_SIGNUP",
  RATE_LIMITED: "RATE_LIMITED",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  SIGNUP_EXPIRED: "SIGNUP_EXPIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function createError(code: keyof typeof ErrorCodes, message: string, details?: Record<string, unknown>): AgentSignupError;
```

### 3.5 SensitiveString

A wrapper that prevents accidental PII leakage in logs, JSON serialization, and debug output.

```typescript
// @agent-signup/protocol

export class SensitiveString {
  constructor(private readonly value: string) {}

  /** Returns the actual value. Intentionally verbose name to prevent casual use. */
  unsafeUnwrap(): string {
    return this.value;
  }

  toString(): string { return "[REDACTED]"; }
  toJSON(): string { return "[REDACTED]"; }
  [Symbol.for("nodejs.util.inspect.custom")](): string { return "[REDACTED]"; }
}
```

---

## 4. `@agent-signup/site` -- Site-Side SDK

The package site developers install. Target DX: working integration in under 15 minutes.

### 4.1 Primary API: `createAgentSignupHandler`

One function that generates all route handlers.

```typescript
import { createAgentSignupHandler } from "@agent-signup/site";

const handler = createAgentSignupHandler({
  // Site identity
  site: {
    name: "ACME Corp",
    url: "https://acme.com",
    privacyUrl: "https://acme.com/privacy",
    termsUrl: "https://acme.com/terms",
    logoUrl: "https://acme.com/logo.png",
  },

  // Field requirements
  fields: {
    required: ["email", "name"],
    optional: ["phone"],
    custom: [
      {
        key: "company_name",
        type: "string",
        label: "Company Name",
        description: "Your company or organization name",
        required: true,
        validation: { minLength: 1, maxLength: 200 },
      },
    ],
  },

  // Password policy (omit if site uses passwordless auth)
  password: {
    required: true,
    policy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
    },
  },

  // Verification
  verification: {
    method: "email",
    timeoutMinutes: 30,
    sendEmail: async (to, code, magicLink) => {
      // Site provides their own email sending logic
      await sendEmail({ to, subject: "Verify your account", body: `Code: ${code}` });
    },
  },

  // Core handler -- receives validated, typed signup data
  onSignup: async (data, metadata) => {
    const user = await db.users.create({
      email: data.email,
      name: `${data.name.first} ${data.name.last}`,
      password: await hashPassword(data.password),
      companyName: data.custom.company_name,
      source: "agent-signup",
      agentId: metadata.agent.name,
    });
    return { userId: user.id };
  },

  // Optional lifecycle hooks
  onVerified: async (signupId, userId) => {
    await db.users.update(userId, { emailVerified: true });
    await sendWelcomeEmail(userId);
  },

  onFailed: async (signupId, error) => {
    await analytics.track("agent_signup_failed", { signupId, error: error.code });
  },

  // Rate limiting (defaults shown)
  rateLimit: {
    perMinute: 10,
    perHour: 100,
    perAgentKey: { perHour: 50 },
  },
});
```

### 4.2 Framework Adapters

#### Next.js App Router

```typescript
// app/api/agent-signup/[...path]/route.ts
import { handler } from "@/lib/agent-signup";

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;

// Manifest is auto-served at GET /.well-known/agent-signup.json
// via a rewrite in next.config.ts (or the SDK provides a middleware)
```

```typescript
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  rewrites: async () => [
    {
      source: "/.well-known/agent-signup.json",
      destination: "/api/agent-signup/manifest",
    },
  ],
};

export default config;
```

#### Express

```typescript
import express from "express";
import { createAgentSignupHandler } from "@agent-signup/site";

const app = express();
const handler = createAgentSignupHandler({ /* ... */ });

// Mount all agent-signup routes
app.use("/.well-known", handler.expressWellKnown());
app.use("/api/v1/agent-signup", handler.expressRouter());
```

#### Fastify

```typescript
import Fastify from "fastify";
import { createAgentSignupHandler } from "@agent-signup/site";

const app = Fastify();
const handler = createAgentSignupHandler({ /* ... */ });

app.register(handler.fastifyPlugin());
```

### 4.3 What the SDK Handles Internally

The site developer does NOT need to implement any of these -- the SDK handles them:

| Concern | Implementation |
|---------|---------------|
| Discovery document generation | Builds `/.well-known/agent-signup.json` from the handler config |
| Challenge nonce issuance | Generates cryptographic nonces, stores with 5-min TTL |
| Consent token verification | Validates JWS signature, expiry, audience, nonce, data_hash |
| Field validation | Validates submitted fields against declared schema |
| Rate limiting | Per-IP, per-agent-key, per-user-key rate limits |
| Nonce ledger | Tracks consumed nonces to prevent replay (in-memory with TTL, or Redis adapter) |
| Email verification tokens | Generates 6-digit codes + magic links, tracks verification state |
| Idempotency | Deduplicates by `idempotency_key` |
| Error responses | Returns structured `AgentSignupError` responses |
| CORS | Configures appropriate headers for agent requests |

### 4.4 Nonce Storage

The SDK needs to persist nonces (5-min TTL) and signup state (30-min TTL for verification). Two built-in adapters:

```typescript
// In-memory (default, single-instance deployments)
const handler = createAgentSignupHandler({
  store: "memory", // default
  // ...
});

// Redis (distributed deployments)
import { createRedisStore } from "@agent-signup/site/stores/redis";

const handler = createAgentSignupHandler({
  store: createRedisStore({ url: process.env.REDIS_URL }),
  // ...
});
```

### 4.5 Events and Webhooks

```typescript
const handler = createAgentSignupHandler({
  // ...

  // Direct callback (runs in-process)
  onSignup: async (data, metadata) => { /* ... */ },
  onVerified: async (signupId, userId) => { /* ... */ },
  onFailed: async (signupId, error) => { /* ... */ },
  onExpired: async (signupId) => { /* ... */ },

  // Webhook (fires HTTP POST to external URL)
  webhooks: {
    url: "https://hooks.example.com/agent-signup",
    secret: process.env.WEBHOOK_SECRET,
    events: ["signup.created", "signup.verified", "signup.failed", "signup.expired"],
    retries: 3,
  },
});
```

---

## 5. `@agent-signup/client` -- User-Side SDK

The package users interact with. Manages the encrypted vault, consent UI, and signing.

### 5.1 Vault

The vault is a single encrypted JSON file (CLI/desktop) or a localStorage entry (browser). Passphrase -> Argon2id -> AES-256-GCM encryption key. Ed25519 keypair generated randomly on creation and stored inside the encrypted blob.

```typescript
import { Vault } from "@agent-signup/client";

// Create a new vault (first-time setup)
// CLI/Desktop: writes ~/.agent-signup/vault.json
// Browser: writes to localStorage key "agent-signup:vault"
const vault = await Vault.create({
  passphrase: "user-chosen-passphrase",
  storage: "file", // "file" (CLI/desktop) or "localstorage" (browser)
});

// Store identity fields
await vault.setField("email", "alex@example.com");
await vault.setField("name.first", "Alex");
await vault.setField("name.last", "Johnson");
await vault.setField("phone", "+15550123");

// Retrieve a field (returns SensitiveString)
const email = await vault.getField("email");
console.log(email); // "[REDACTED]"
console.log(email.unsafeUnwrap()); // "alex@example.com"

// List stored field names (not values)
const fields = await vault.listFields(); // ["email", "name.first", "name.last", "phone"]

// Lock the vault (zeroes encryption key from memory)
await vault.lock();

// Unlock an existing vault
const vault = await Vault.open({
  passphrase: "user-chosen-passphrase",
  storage: "file",
});

// Export vault for backup or device transfer (encrypted file)
const exported = await vault.export(); // Returns the encrypted JSON blob
// Import on another device:
await Vault.import(exported, { passphrase: "same-passphrase", storage: "file" });
```

**What the vault file looks like on disk** (`~/.agent-signup/vault.json`):
```json
{
  "version": 1,
  "kdf": { "algorithm": "argon2id", "time": 3, "memory": 65536, "parallelism": 4, "salt": "base64..." },
  "vault": "base64-AES-256-GCM-ciphertext...",
  "vault_iv": "base64-12-bytes",
  "vault_tag": "base64-16-bytes",
  "signing_public_key": "base64-32-bytes",
  "created_at": "2026-03-28T00:00:00Z",
  "updated_at": "2026-03-28T00:00:00Z"
}
```

The `signing_public_key` is in plaintext so agents can verify consent tokens without unlocking the vault. Everything else is encrypted.

### 5.2 Key Management

The vault generates a random Ed25519 keypair on creation and stores it encrypted. The private key never leaves the vault. All signing happens inside the vault's security boundary.

```typescript
// Get the user's public key (for display or sharing)
const identity = vault.getIdentity();
// { publicKey: "base64url...", keyId: "a1b2c3d4e5f6g7h8" }

// The private key is never exposed outside the vault.
// Signing operations happen inside the vault's security boundary.
```

### 5.3 Consent

```typescript
import { ConsentManager } from "@agent-signup/client";

const consent = new ConsentManager(vault);

// Handle an interactive consent request
const result = await consent.requestConsent({
  site: {
    name: "ACME Corp",
    url: "https://acme.com",
    privacyUrl: "https://acme.com/privacy",
    termsUrl: "https://acme.com/terms",
    logoUrl: "https://acme.com/logo.png",
  },
  requestedFields: {
    required: ["email", "name.first", "name.last"],
    optional: ["phone"],
  },
  nonce: "server-issued-nonce",
});

// result is one of:
// { approved: true, token: "eyJ...", fields: { email: SensitiveString, ... } }
// { approved: false, reason: "user_denied" | "timeout" | "missing_fields" }
```

### 5.4 Consent UI Component

A React component (and Web Component wrapper) for the consent prompt.

```tsx
import { ConsentPrompt } from "@agent-signup/client/react";

function AgentConsentView({ request, onResult }) {
  return (
    <ConsentPrompt
      request={request}
      vault={vault}
      onApprove={(token, fields) => onResult({ approved: true, token, fields })}
      onDeny={(reason) => onResult({ approved: false, reason })}
    />
  );
}
```

The `ConsentPrompt` renders:
- Site name, URL, and logo (from manifest branding)
- Required fields with values from vault (pre-filled, editable)
- Optional fields with checkboxes (unchecked by default)
- Custom fields with descriptions and inline inputs
- Terms of Service link
- "Deny" and "Approve Signup" buttons
- Countdown timer showing token expiry

For non-React environments, a Web Component is available:

```html
<agent-signup-consent
  id="consent"
  site-name="ACME Corp"
  site-url="https://acme.com"
></agent-signup-consent>

<script>
  const el = document.getElementById("consent");
  el.addEventListener("approve", (e) => { /* e.detail.token, e.detail.fields */ });
  el.addEventListener("deny", (e) => { /* e.detail.reason */ });
</script>
```

### 5.5 Pre-Authorized Scopes

The SDK uses camelCase for its API surface. These map to the `PreAuthorizedPolicy` wire format in `protocol.md` Section 3 (snake_case): `allowedOrigins` -> `site_patterns`, `allowedFields` -> `field_allowlist`, `maxUses` -> `max_uses`.

```typescript
import { PolicyManager } from "@agent-signup/client";

const policies = new PolicyManager(vault);

// Create a pre-authorization rule
await policies.create({
  name: "Basic signups for trusted sites",
  scopes: ["signup.basic"],               // Maps to protocol's scopes field
  allowedOrigins: ["https://acme.com", "https://example.com"],
  allowedFields: ["email", "name.first", "name.last"],
  maxUses: 10,
  expiresAt: new Date("2026-06-28"),
});

// List active policies
const active = await policies.list();

// Revoke a policy
await policies.revoke(policyId);

// Check if a request matches any policy (used internally by ConsentManager)
const match = await policies.findMatch({
  origin: "https://acme.com",
  fields: ["email", "name.first", "name.last"],
});
// match: { policyId: "...", remainingUses: 8 } or null
```

### 5.6 Signup History

```typescript
import { SignupHistory } from "@agent-signup/client";

const history = new SignupHistory(vault);

// Automatically logged by ConsentManager after each signup
const entries = await history.list({ limit: 20, offset: 0 });
// [{ id, siteName, siteUrl, fields, consentMode, status, timestamp }]

const entry = await history.get(entryId);
// Full detail including consent mode, fields shared, verification status

// Search/filter
const filtered = await history.list({
  siteUrl: "acme.com",
  status: "verified",
  after: new Date("2026-03-01"),
});
```

### 5.7 Password Generation

```typescript
import { PasswordGenerator } from "@agent-signup/client";

// Generate a password meeting the site's policy
const password = PasswordGenerator.generate({
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: false,
});
// Returns SensitiveString

// Store in vault associated with a site
await vault.setPassword("https://acme.com", password);

// Retrieve later
const stored = await vault.getPassword("https://acme.com");
```

---

## 6. `@agent-signup/agent` -- Agent-Side Tools

The package AI agent frameworks use. Provides REST client and MCP tool definitions.

### 6.1 REST Client

```typescript
import { AgentSignupClient } from "@agent-signup/agent";

const client = new AgentSignupClient();

// 1. Discover site requirements
const manifest = await client.discover("https://acme.com");
// Returns parsed AgentSignupDiscovery (cached per Cache-Control headers)

// 2. Request a challenge nonce
const challenge = await client.requestChallenge("https://acme.com", {
  publicKey: userPublicKey,
});
// Returns { nonce, expiresAt }

// 3. Submit signup
const result = await client.submitSignup("https://acme.com", {
  consentToken: signedJWS,
  data: { email: "alex@example.com", name: { first: "Alex", last: "Johnson" } },
  agent: { name: "my-agent", version: "1.0" },
  idempotencyKey: crypto.randomUUID(),
});
// Returns { signupId, status, verification }

// 4. Check verification status
const status = await client.checkStatus("https://acme.com", result.signupId);
// Returns { status: "pending_verification" | "active" | "expired" | "rejected" }

// 5. Poll until verified (with exponential backoff)
const finalStatus = await client.waitForVerification("https://acme.com", result.signupId, {
  maxWaitMs: 30 * 60 * 1000, // 30 minutes
  initialIntervalMs: 5000,
  maxIntervalMs: 30000,
});
```

### 6.2 Discovery Cache

```typescript
import { DiscoveryCache } from "@agent-signup/agent";

const cache = new DiscoveryCache({
  maxEntries: 100,
  respectCacheControl: true, // Uses Cache-Control and ETag headers
});

// Fetch with caching
const manifest = await cache.get("https://acme.com");

// Force refresh
const fresh = await cache.get("https://acme.com", { forceRefresh: true });

// Check if a site supports agent signup (returns boolean, does not throw)
const supported = await cache.supports("https://acme.com");
```

### 6.3 MCP Tool Definitions

For MCP-compatible agents (Claude, etc.), the package exports self-registering tool definitions.

```typescript
import { getAgentSignupTools } from "@agent-signup/agent/mcp";

// Returns an array of MCP tool definitions
const tools = getAgentSignupTools({
  // Optional: inject user consent layer
  consentProvider: async (request) => {
    // Bridge to the user's @agent-signup/client consent UI
    return await userClient.requestConsent(request);
  },
});

// tools contains:
// - agent_signup_discover
// - agent_signup_request_challenge
// - agent_signup_submit
// - agent_signup_check_status
// - agent_signup_verify
```

Each tool follows the MCP tool specification with `inputSchema` and `outputSchema` as JSON Schema objects. See `protocol.md` Section 5 for full schemas.

### 6.4 AI SDK Integration

For Vercel AI SDK agents:

```typescript
import { getAgentSignupTools } from "@agent-signup/agent/ai-sdk";
import { Agent } from "ai";

const agent = new Agent({
  model: "anthropic/claude-sonnet-4.6",
  instructions: "You help users sign up for services.",
  tools: {
    ...getAgentSignupTools({ consentProvider }),
    // ... other tools
  },
});
```

---

## 7. Integration Patterns

### 7.1 Full Flow: Agent Signs User Up for a Site

```typescript
// Agent-side orchestration (simplified)

import { AgentSignupClient } from "@agent-signup/agent";
import { ConsentManager } from "@agent-signup/client";

const client = new AgentSignupClient();
const consent = new ConsentManager(vault);

async function signupUser(siteUrl: string) {
  // 1. Discover
  const manifest = await client.discover(siteUrl);
  if (!manifest) throw new Error("Site does not support agent signup");

  // 2. Challenge
  const identity = vault.getIdentity();
  const challenge = await client.requestChallenge(siteUrl, {
    publicKey: identity.publicKey,
  });

  // 3. Consent (interactive or pre-authorized)
  const consentResult = await consent.requestConsent({
    site: manifest.branding,
    requestedFields: manifest.fields,
    nonce: challenge.nonce,
  });

  if (!consentResult.approved) {
    return { success: false, reason: consentResult.reason };
  }

  // 4. Submit
  const result = await client.submitSignup(siteUrl, {
    consentToken: consentResult.token,
    data: unwrapFields(consentResult.fields),
    agent: { name: "my-agent", version: "1.0" },
    idempotencyKey: crypto.randomUUID(),
  });

  // 5. Wait for verification (if needed)
  if (result.status === "pending_verification") {
    const final = await client.waitForVerification(siteUrl, result.signupId);
    return { success: final.status === "active", signupId: result.signupId };
  }

  return { success: true, signupId: result.signupId };
}
```

### 7.2 Site: Minimal Next.js Integration

```typescript
// lib/agent-signup.ts
import { createAgentSignupHandler } from "@agent-signup/site";

export const agentSignup = createAgentSignupHandler({
  site: {
    name: "My SaaS",
    url: process.env.NEXT_PUBLIC_APP_URL!,
    privacyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,
    termsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
  },
  fields: {
    required: ["email", "name"],
  },
  verification: {
    method: "email",
    sendEmail: async (to, code) => {
      await resend.emails.send({
        from: "noreply@mysaas.com",
        to,
        subject: "Verify your account",
        text: `Your verification code is: ${code}`,
      });
    },
  },
  onSignup: async (data) => {
    const user = await db.user.create({ data: { email: data.email, name: `${data.name.first} ${data.name.last}` } });
    return { userId: user.id };
  },
});

// app/api/agent-signup/[...path]/route.ts
import { agentSignup } from "@/lib/agent-signup";

export const GET = agentSignup.GET;
export const POST = agentSignup.POST;
export const DELETE = agentSignup.DELETE;
```

Total: 2 files, ~30 lines of code.

### 7.3 Testing a Site Integration

The agent package includes a test utility:

```typescript
import { TestAgent } from "@agent-signup/agent/testing";

const agent = new TestAgent({
  siteUrl: "http://localhost:3000",
  testUser: {
    email: "test@example.com",
    name: { first: "Test", last: "User" },
  },
});

// Run the full signup flow against a local dev server
const result = await agent.signup();
// { success: true, signupId: "...", verificationCode: "123456" }

// Verify (in test mode, the verification code is returned directly)
await agent.verify(result.signupId, result.verificationCode);
```

---

## 8. Testing Strategy

### 8.1 Per-Package Testing

| Package | Test Type | What |
|---------|-----------|------|
| `protocol` | Unit | Schema validation, crypto operations, token creation/validation, canonical hashing |
| `site` | Unit + Integration | Handler config validation, nonce management, token verification, rate limiting, email verification flow |
| `client` | Unit + Integration | Vault CRUD, encryption/decryption, key derivation, consent flow, policy matching, history logging |
| `agent` | Unit + Integration | REST client (mocked HTTP), discovery cache, MCP tool schemas, polling with backoff |

### 8.2 End-to-End Tests

A test harness that runs the full flow:

1. Start a test site (using `@agent-signup/site` with in-memory store)
2. Create a test vault (using `@agent-signup/client` with in-memory storage)
3. Run a test agent (using `@agent-signup/agent`) through discover -> consent -> signup -> verify
4. Assert: user record created, consent token verified, verification completed

### 8.3 Security Tests

- Replay attack: submit the same consent token twice, assert second is rejected
- Expired token: submit a token past its `exp`, assert rejection
- Wrong audience: submit a token meant for site A to site B, assert rejection
- Tampered data: modify PII after consent, assert `data_hash` mismatch
- Rate limiting: exceed rate limits, assert `429` responses
- Nonce reuse: reuse a challenge nonce, assert rejection

---

## Appendix: Implementation Order

The recommended build sequence:

1. **`@agent-signup/protocol`** -- Build first. All other packages depend on it. Start with schemas, then crypto, then tokens.
2. **`@agent-signup/site`** -- Build second. This is the "server side" that the agent talks to. Can be tested with curl.
3. **`@agent-signup/agent`** -- Build third. REST client + MCP tools. Test against the site SDK.
4. **`@agent-signup/client`** -- Build last. The vault and consent UI. This is the most complex package (crypto, storage, UI).

Estimated timeline: 6-8 weeks for a solo developer, 3-4 weeks for a team of 2.
