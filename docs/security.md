# Agent Signup: Security Specification

**Version:** 0.1.0 (Draft)
**Date:** 2026-03-28
**Status:** RFC -- Seeking feedback
**Classification:** Security-sensitive -- handle accordingly

---

## Table of Contents

1. [Overview](#1-overview)
2. [STRIDE Threat Model](#2-stride-threat-model)
3. [Attack Surface Analysis](#3-attack-surface-analysis)
4. [Consent Token Specification](#4-consent-token-specification)
5. [Key Management and Client-Side Vault Design](#5-key-management-and-client-side-vault-design)
6. [Security Architecture Recommendations](#6-security-architecture-recommendations)
7. [Privacy-by-Design and GDPR](#7-privacy-by-design-and-gdpr)
8. [Security Headers and Transport](#8-security-headers-and-transport)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Overview

### 1.1 Security Design Philosophy

Agent Signup is a protocol that enables AI agents to register for online services on behalf of users. Because the protocol handles personally identifiable information (PII) and introduces a novel trust relationship between three principals -- users, AI agents, and sites -- the security design is foundational, not an afterthought.

Three principles guide every design decision:

**Defense in depth.** No single control is relied upon in isolation. Cryptographic signing, audience binding, nonce-based replay prevention, rate limiting, proof-of-work challenges, and user-presence attestation form overlapping layers. A failure in one layer MUST NOT result in a full compromise.

**Client-side first.** PII is stored exclusively on the user's device in an encrypted vault. The agent is a transient relay that MUST NOT persist PII. The site receives only the fields explicitly authorized by the user. No central server holds PII or consent state. This architecture eliminates the single-point-of-breach risk inherent in centralized identity systems.

**Data minimization.** The protocol enforces the principle of least privilege at every boundary. Consent tokens enumerate the exact fields authorized for release. The vault API MUST NOT expose a "dump all" interface. Sites declare required versus optional fields, and users MAY deny optional fields. The consent token's `scope.purpose` constrains how data may be used.

### 1.2 Threat Landscape for Agent-Driven Signups

Agent-driven signups introduce a threat landscape distinct from traditional form-based registration:

```
+------------------+        +------------------+        +------------------+
|   User Device    |        |    AI Agent       |        |   Target Site    |
|                  |        |                  |        |                  |
| +-------------+  |  (1)   |                  |  (3)   | +-------------+  |
| | PII Vault   |---------->| Discovers site   |------->| | Agent SDK   |  |
| | (encrypted) |  consent  | requirements,    | submit | | (npm pkg)   |  |
| +-------------+  token    | orchestrates     | signup | +-------------+  |
|                  |        | signup           |        |                  |
| +-------------+  |  (2)   |                  |        |                  |
| | Consent UI  |<----------| Requests consent |        |                  |
| | (browser)   |---------->| for fields/site  |        |                  |
| +-------------+  approve  |                  |        |                  |
+------------------+        +------------------+        +------------------+

Data flow:
(1) User generates a cryptographic consent token scoped to {site, fields, expiry}
(2) Agent receives the token + only the PII fields covered by the token
(3) Agent submits signup to the site's SDK endpoint, presenting the consent token

Key invariants:
- PII is stored ONLY on the user's device, encrypted at rest
- The agent is a transient relay -- it MUST NOT persist PII
- The site receives ONLY the fields enumerated in the consent token
- No central server holds PII or consent state
```

Traditional signups face spoofing, CSRF, and credential-stuffing threats. Agent-driven signups inherit those and add:

- **Agent impersonation**: A malicious process posing as a trusted agent to exfiltrate PII from the vault.
- **Consent UI spoofing**: Fake approval dialogs injected by malware or extensions to harvest token approvals.
- **Transient relay abuse**: Agents that violate the ephemeral-handling mandate by logging, caching, or persisting PII.
- **Mass automated signups**: The agent protocol itself becomes an attack vector for bot-driven account creation at scale.
- **Scope creep via pre-authorization**: Standing authorizations exploited beyond the user's original intent.
- **Prompt injection**: An attacker manipulates the agent's LLM context to extract PII or submit unauthorized signups.

This document specifies the controls that address each of these threats.

---

## 2. STRIDE Threat Model

STRIDE categorizes threats into six families. Each is applied below to all three principals in the system: the User, the AI Agent, and the Target Site.

### 2.1 Spoofing (Identity)

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| S1 | Malicious agent impersonates a legitimate agent to request PII from the user vault. | User | High | Critical | **Critical** | Agent identity MUST be bound to a public key registered by the user. Consent UI MUST display the agent's key fingerprint. The user MUST explicitly trust an agent before it can request fields. Trust-on-first-use (TOFU) ceremony with fingerprint verification. |
| S2 | Attacker spoofs the consent UI to harvest approval for malicious tokens. | User | Medium | Critical | **Critical** | Consent UI MUST run in a trusted execution context (browser origin the user controls, or native OS prompt). Agent-injected UIs MUST NOT pose as the consent prompt. Origin isolation enforced via CSP and dedicated origin. |
| S3 | Rogue site impersonates a legitimate site to harvest PII via a fake discovery manifest. | User, Agent | Medium | High | **High** | Sites MUST be identified by a registered origin + public key. The agent MUST verify the site's TLS certificate and that the `site_origin` in the manifest matches the actual HTTPS connection origin. Consent token `aud` claim is bound to the verified origin. |
| S4 | Attacker spoofs the user to an agent via a stolen device session. | Agent | Low | High | **Medium** | Device-level authentication (biometric, passkey) MUST gate vault unlock. Session tokens MUST have a short TTL (maximum 15 minutes). Auto-lock on idle (2 minutes). |

### 2.2 Tampering

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| T1 | Agent modifies PII field values in transit before submitting to the site. | Site | Medium | High | **High** | Consent token MUST include a `data_hash` claim containing the SHA-256 hash of the canonical PII payload. Site SDK MUST verify the hash against submitted data. Any tampering invalidates the token. |
| T2 | Attacker tampers with the consent token to add fields, change the target site, or extend expiry. | User, Site | Medium | Critical | **Critical** | Token MUST be signed by the user's Ed25519 private key. The signature covers all claims (site, fields, nonce, expiry). Any modification breaks signature verification. |
| T3 | Malicious browser extension modifies vault contents at rest. | User | Low | Critical | **High** | Vault encryption key MUST be derived from the user's passphrase via Argon2id. Vault data MUST be authenticated using AES-256-GCM. Any modification is detected by GCM authentication tag failure. |

### 2.3 Repudiation

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| R1 | User denies they consented to a signup after the fact. | Site | Medium | Medium | **Medium** | The consent token is a cryptographic proof of authorization signed by the user's Ed25519 key. The site MUST store the token as a receipt. Non-repudiation is inherent in the digital signature -- only the holder of the private key can produce a valid token. |
| R2 | Agent denies it submitted a signup or claims it submitted different data. | User, Site | Low | Medium | **Low** | The agent SHOULD co-sign the submission with its own Ed25519 key. Both the user's consent token and the agent's signature MUST be stored by the site SDK as an audit trail. |
| R3 | Site denies receiving a signup or claims different data was submitted. | User | Low | Medium | **Low** | The agent MUST retain a signed receipt from the site's SDK confirming the registration. The receipt MUST include a hash of the submitted data and a timestamp signed by the site's key. |

### 2.4 Information Disclosure

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| I1 | Agent retains PII in memory, on disk, or in cloud storage after signup is complete. | User | High | High | **Critical** | The protocol specification MUST mandate ephemeral handling. The agent SDK MUST use memory-only storage with explicit zeroing after submission. Agents that persist PII violate the protocol and SHOULD be flagged by audit mechanisms. |
| I2 | PII leaked via agent logs, crash dumps, error reports, or telemetry. | User | Medium | High | **High** | Agent implementations MUST redact PII from all logging. The SDK MUST provide a `SensitiveString` wrapper that overrides `toString()`, `toJSON()`, and `inspect()` to return `[REDACTED]`. |
| I3 | Site requests more fields than necessary for the stated purpose. | User | High | Medium | **High** | Consent UI MUST show the user exactly which fields are requested and distinguish required from optional. Protocol MUST support a required/optional distinction. Users MAY deny optional fields. |
| I4 | Client-side vault exfiltrated via XSS or malicious script injection. | User | Medium | Critical | **Critical** | Vault MUST be encrypted with a key that requires user interaction to derive (passphrase or WebAuthn). Even if ciphertext is exfiltrated, it cannot be decrypted without the user's secret. CSP headers MUST prevent script injection. Vault storage MUST use IndexedDB (not localStorage) to avoid synchronous access by injected scripts. |
| I5 | Man-in-the-middle intercepts PII in transit between agent and site. | User | Low | High | **Medium** | TLS 1.3 is REQUIRED. Certificate pinning SHOULD be used for known sites. The agent SDK MUST refuse plaintext HTTP endpoints. |

### 2.5 Denial of Service

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| D1 | Mass bot signups using the agent protocol to overwhelm a site's registration system. | Site | High | High | **Critical** | Site SDK MUST enforce rate limiting per agent key, per IP, and per user key. Proof-of-work challenge MUST be required for agent submissions. CAPTCHA escalation for suspicious patterns. See Section 3.4 for the five-layer defense. |
| D2 | Attacker floods the consent UI with rapid approval requests to fatigue or confuse the user. | User | Medium | Medium | **Medium** | Rate limit consent requests per agent. User MUST be able to block and revoke agent trust. Consent queue with deduplication MUST be implemented. |
| D3 | Agent repeatedly submits invalid tokens to exhaust site validation resources (CPU for signature verification). | Site | Medium | Medium | **Medium** | Site SDK MUST perform cheap syntactic validation (schema, expiry, audience) before expensive cryptographic verification. Agent keys MUST be banned after repeated failures. |

### 2.6 Elevation of Privilege

| ID | Description | Target | Likelihood | Impact | Risk | Mitigation |
|----|-------------|--------|------------|--------|------|------------|
| E1 | Pre-authorized scope exploited beyond the user's original intent (scope creep). | User | High | High | **Critical** | Pre-authorized scopes MUST be narrowly defined: `{site_origin, field_set, max_uses, expiry, purpose}`. Each use MUST decrement a counter. Scopes MUST NOT be widened without new user approval. |
| E2 | Agent uses a consent token intended for site A to register on site B. | User, Site | Medium | High | **High** | The token's `aud` (audience) claim MUST be bound to the site's origin. Site SDK MUST reject tokens where `aud` does not match its own registered origin. |
| E3 | Compromised agent escalates to access the full vault instead of only the consented fields. | User | Low | Critical | **High** | Vault API MUST only release fields listed in a valid, signed consent token. The vault MUST NOT expose a "dump all" interface. Field-level access control MUST be enforced at the vault layer, not delegated to the agent layer. |

---

## 3. Attack Surface Analysis

### 3.1 Risk Matrix

Likelihood and impact are rated independently. The intersection determines the risk rating used throughout this document.

```
              | Low Impact   | Med Impact   | High Impact  | Critical Impact
--------------+--------------+--------------+--------------+----------------
Likely        |   Medium     |    High      |  *Critical*  |  *Critical*
--------------+--------------+--------------+--------------+----------------
Possible      |    Low       |   Medium     |    High      |  *Critical*
--------------+--------------+--------------+--------------+----------------
Unlikely      |    Low       |    Low       |   Medium     |    High
```

### 3.2 Attack Surface Map

Eight surfaces are exposed by the protocol. Each is mapped to its threat IDs and prioritized for hardening.

| # | Surface | Exposed To | Key Threats | Priority |
|---|---------|-----------|-------------|----------|
| 1 | **Consent UI** | User, malicious agents, browser extensions | S2, D2, phishing overlays | P0 |
| 2 | **PII Vault (client-side)** | Local attackers, XSS, malware | I4, T3, E3 | P0 |
| 3 | **Agent-to-Site REST API** | Network attackers, rogue agents | S1, T1, D1, replay attacks | P0 |
| 4 | **Agent-to-Vault API** | Malicious agents, compromised extensions | S1, I1, E3 | P0 |
| 5 | **Consent Token (in transit)** | MITM, replay, agent log leaks | T2, I5, replay attacks | P0 |
| 6 | **Site SDK (npm package)** | Supply chain attacks, misconfiguration | Dependency hijacking, weak defaults | P1 |
| 7 | **Pre-authorized Scopes** | Scope creep, stale authorizations | E1, over-permissioning | P1 |
| 8 | **MCP Tool Interface** | Prompt injection, tool misuse | Agent instructed to exfiltrate PII via crafted prompts | P1 |

### 3.3 Replay Attack Prevention

Since there is no central server to track nonce consumption, replay prevention requires a decentralized approach.

**Strategy: Site-Side Nonce Ledger + Time-Bound Tokens**

1. Each consent token MUST contain a unique `jti` (JWT ID / nonce) and a short `exp` (expiry). The RECOMMENDED maximum expiry for explicit consent tokens is 5 minutes from `iat`.

2. The site SDK MUST maintain a local set of consumed `jti` values. Entries are pruned after their corresponding `exp` has passed.

3. On receiving a signup request, the site SDK MUST check in this order:
   - (a) Token is not expired (`exp` > current time).
   - (b) `jti` is not in the consumed set.
   - (c) Signature is valid (Ed25519 verification).
   - (d) `aud` matches the site's registered origin.
   - (e) `data_hash` matches the SHA-256 of the canonical PII payload.

4. After successful processing, `jti` MUST be added to the consumed set.

5. For distributed site deployments (multiple backend instances): a shared cache (e.g., Redis) MUST store consumed nonces with a TTL matching the token's maximum expiry window.

**Why this works without a central server:** The anti-replay state is maintained by each site independently. Since the token is audience-bound, site A's nonce ledger is irrelevant to site B. The short expiry window keeps the nonce set small and bounded.

**Nonce ledger sizing:** With a 5-minute expiry and a rate limit of 10 signups per agent per hour, the maximum nonce set size per site is approximately 50 entries at peak load. For a site serving 1,000 agents, this is approximately 50,000 entries -- trivially small for an in-memory set or Redis instance.

### 3.4 Bot Abuse / Mass Signup Prevention

The agent protocol creates a new vector for automated account creation that bypasses traditional CAPTCHA and behavioral analysis. A five-layer defense mitigates this risk.

| Layer | Mechanism | Enforcement Point | Description |
|-------|-----------|-------------------|-------------|
| **1 - Identity** | Agent key registration | Site SDK | Agent MUST present a registered Ed25519 public key. Key registration SHOULD require solving a proof-of-work or CAPTCHA to prevent mass key generation. |
| **2 - Rate Limiting** | Per-principal rate limits | Site SDK | Per-agent-key: 10 signups/hour. Per-user-key: 3 signups/minute. Per-IP: 20 signups/hour. These are RECOMMENDED defaults; sites MAY adjust. |
| **3 - Proof of Work** | Hashcash-style PoW | Site SDK | Each signup submission MUST include a proof-of-work token: find a nonce where `SHA-256(challenge || nonce)` has N leading zero bits. Difficulty adjusts dynamically based on load. See Section 4.3, `pow` claim. |
| **4 - Behavioral Signals** | User presence attestation | Consent UI + Site SDK | Site MAY require a user presence attestation -- a WebAuthn assertion with a recent timestamp proving a human recently interacted with the consent UI. |
| **5 - Reputation** | Agent key reputation | Site SDK (shared blocklist optional) | New agent keys face higher friction (higher PoW difficulty, stricter rate limits). Keys associated with abuse are blocked. An opt-in shared blocklist of revoked/abusive agent keys MAY be maintained across participating sites. |

---

## 4. Consent Token Specification

### 4.1 Format

The consent token is a **JWS** (JSON Web Signature, RFC 7515) using compact serialization. It is **not a JWE** -- the token itself does not contain PII. It is a signed authorization that the agent presents alongside the PII payload.

The compact serialization format is:

```
BASE64URL(header) "." BASE64URL(payload) "." BASE64URL(signature)
```

### 4.2 Header Schema

```typescript
interface ConsentTokenHeader {
  /** Signature algorithm. MUST be "EdDSA". */
  alg: "EdDSA";

  /** Elliptic curve. MUST be "Ed25519". */
  crv: "Ed25519";

  /** Key ID. First 16 characters of base64url(SHA-256(publicKey)). Compact fingerprint for key lookup. */
  kid: string;

  /** Token type. MUST be "agent-signup-consent+jwt". */
  typ: "agent-signup-consent+jwt";
}
```

Example:

```json
{
  "alg": "EdDSA",
  "crv": "Ed25519",
  "kid": "a3f2b8c1d4e5f6a7",
  "typ": "agent-signup-consent+jwt"
}
```

**Algorithm choice: Ed25519 (EdDSA)**

- Fastest signature verification of any standard algorithm (suitable for high-throughput site validation).
- 32-byte keys, 64-byte signatures -- compact for token transport.
- No known timing side-channel attacks (constant-time by design).
- Supported by the WebCrypto API (broad browser support as of 2025).
- Deterministic signatures eliminate the ECDSA nonce-reuse catastrophe. A single nonce reuse in ECDSA leaks the private key; Ed25519 has no nonce.
- Widely implemented: libsodium, Node.js `crypto`, browser WebCrypto, Go `crypto/ed25519`.

### 4.3 Claims (Payload Schema)

```typescript
interface ConsentTokenPayload {
  /** Issuer. User's key fingerprint: first 16 chars of base64url(SHA-256(publicKey)).
   *  Identifies who authorized the signup. REQUIRED. */
  iss: string;

  /** Subject. Agent's public key fingerprint.
   *  Identifies the agent authorized to act. REQUIRED. */
  sub: string;

  /** Audience. Target site origin (e.g., "https://example.com").
   *  Prevents cross-site token reuse. REQUIRED. */
  aud: string;

  /** Issued At. Unix timestamp (seconds) of token creation.
   *  Used for freshness checks. REQUIRED. */
  iat: number;

  /** Expiration. Unix timestamp (seconds).
   *  MUST be <= 300 seconds (5 min) from iat for explicit consent.
   *  MAY be up to 86400 seconds (24 hours) for pre_authorized consent. REQUIRED. */
  exp: number;

  /** JWT ID. Unique nonce (UUID v4). Prevents replay attacks.
   *  MUST be generated by a CSPRNG. REQUIRED. */
  jti: string;

  /** Scope. Defines exactly what is authorized. REQUIRED. */
  scope: {
    /** Exact list of PII field paths authorized for release.
     *  Uses dot notation for nested fields (e.g., "name.first"). REQUIRED. */
    fields: string[];

    /** Constrained purpose enum. REQUIRED. */
    purpose: "account_creation" | "identity_verification" | "newsletter_signup";

    /** The specific API endpoint this token is valid for. REQUIRED. */
    site_endpoint: string;
  };

  /** Data hash. SHA-256 hash of the canonical JSON representation of the PII payload.
   *  Format: "sha256:<hex-digest>".
   *  CRITICAL: This binds the token to exact data values. The site SDK MUST recompute
   *  this hash from the received PII and reject the token if it does not match.
   *  REQUIRED for explicit consent. NOT PRESENT for pre_authorized standing tokens
   *  (child tokens generated at submission time include it). */
  data_hash: string;

  /** Consent mode. Determines validation rules. REQUIRED. */
  consent_mode: "explicit" | "pre_authorized";

  /** User presence attestation. Base64-encoded WebAuthn assertion proving
   *  recent human interaction with the consent UI.
   *  CONDITIONAL: Required if the site's discovery manifest sets
   *  user_presence_required: true. */
  user_presence?: string;

  /** Proof of work. Solved challenge proving computational work.
   *  CONDITIONAL: Required if the site's discovery manifest sets
   *  pow_required: true. */
  pow?: {
    /** The challenge string issued by the site. */
    challenge: string;
    /** The solved nonce value. */
    nonce: string;
    /** The difficulty (number of leading zero bits required in SHA-256 output). */
    difficulty: number;
  };
}
```

Full example payload:

```json
{
  "iss": "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  "sub": "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
  "aud": "https://example.com",
  "iat": 1711612800,
  "exp": 1711613100,
  "jti": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "scope": {
    "fields": ["name.first", "name.last", "email", "phone"],
    "purpose": "account_creation",
    "site_endpoint": "https://example.com/.well-known/agent-signup"
  },
  "data_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "consent_mode": "explicit",
  "user_presence": "<webauthn-assertion-base64>",
  "pow": {
    "challenge": "site-challenge-abc123",
    "nonce": "00000000004a3f2b",
    "difficulty": 20
  }
}
```

### 4.4 Signature

The token MUST be signed by the user's Ed25519 private key. The signature covers `BASE64URL(header) || "." || BASE64URL(payload)` per the JWS specification (RFC 7515).

The site SDK verifies the signature using the user's public key, which is either:
- Transmitted alongside the token (the `kid` header identifies it), or
- Looked up from a previous registration.

The signature provides:
- **Integrity**: Any modification to the header or payload invalidates the signature.
- **Authentication**: Only the holder of the user's private key can produce a valid signature.
- **Non-repudiation**: The site can store the token as cryptographic proof of consent.

### 4.5 Pre-Authorized Scope Tokens

For the pre-authorized consent mode, the user issues a "standing authorization" token stored in the vault. This token is NOT sent to sites directly -- it serves as the basis for generating per-use child tokens.

```typescript
interface PreAuthorizedScopePayload {
  iss: string;                   // User's key fingerprint
  sub: string;                   // Agent's key fingerprint
  aud: "*";                      // Wildcard (scope narrowed by allowed_origins)
  iat: number;                   // Issuance time
  exp: number;                   // Expiry (up to 24 hours)
  jti: string;                   // Format: "scope-grant-<uuid>"
  scope: {
    fields: string[];            // Authorized field set
    purpose: "account_creation" | "identity_verification" | "newsletter_signup";
    allowed_origins: string[];   // Site origins this scope applies to
    max_uses: number;            // Total uses permitted
    remaining_uses: number;      // Decremented on each use (enforced by vault)
  };
  consent_mode: "pre_authorized";
  // NOTE: No data_hash -- exact values determined at submission time
}
```

Example:

```json
{
  "iss": "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  "sub": "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
  "aud": "*",
  "iat": 1711612800,
  "exp": 1711699200,
  "jti": "scope-grant-f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "scope": {
    "fields": ["name.first", "name.last", "email"],
    "purpose": "account_creation",
    "allowed_origins": ["https://example.com", "https://other.com"],
    "max_uses": 5,
    "remaining_uses": 5
  },
  "consent_mode": "pre_authorized"
}
```

**Key differences from explicit consent tokens:**

- `aud` is a wildcard `*`; actual audience narrowed by `allowed_origins`.
- `max_uses` is enforced client-side by the vault (decremented on each use).
- Longer `exp` (up to 24 hours) compared to 5 minutes for explicit tokens.
- **No `data_hash`** -- the exact PII values are determined at submission time.
- The vault generates a per-use **child token** (explicit, with `data_hash`) from this standing authorization when the agent makes a request.

### 4.6 Token Lifecycle

The following diagram shows the complete lifecycle from standing authorization to site verification.

```
User creates standing authorization (pre_authorized)
          |
          v
Agent requests signup for site X
          |
          v
Vault checks:
  - Is site X in allowed_origins?
  - Are requested fields a subset of authorized fields?
  - Is remaining_uses > 0?
  - Is the standing authorization not expired?
          |
          v
Vault generates explicit child token:
  - aud = site X origin (narrowed from wildcard)
  - data_hash = SHA-256 of actual PII values (canonical JSON)
  - exp = iat + 300 seconds (5 minutes)
  - jti = fresh UUID v4 nonce
  - parent_jti = standing auth jti (for audit trail)
  - remaining_uses decremented on the standing auth
          |
          v
Agent receives child token + PII fields
(only fields listed in scope.fields)
          |
          v
Agent submits to site SDK:
  - Consent token (child, explicit)
  - PII payload
  - Agent co-signature (optional, RECOMMENDED)
          |
          v
Site SDK validates (in order):
  1. Token schema (syntactic check -- cheap)
  2. exp not passed (freshness)
  3. aud matches site origin (audience binding)
  4. jti not in consumed set (replay prevention)
  5. Ed25519 signature valid (cryptographic -- expensive)
  6. data_hash matches SHA-256 of received PII (integrity)
  7. scope.fields matches fields in payload (completeness)
          |
          v
Site SDK stores token as consent receipt
Site SDK adds jti to consumed nonce set (with TTL)
Site SDK processes signup via onSignup handler
```

---

## 5. Key Management and Client-Side Vault Design

### 5.1 Key Model (Simplified)

The MVP uses a simplified two-key model: one symmetric key for vault encryption, one asymmetric keypair for consent signing. This trades deterministic key reconstruction for implementation simplicity.

```
User Passphrase
          |
          | Argon2id (time=3, memory=64MB, parallelism=4, output=256-bit)
          v
   Vault Encryption Key (AES-256-GCM)
          |
          | Encrypts the vault, which contains:
          |   - User's PII fields
          |   - Ed25519 private key (randomly generated, stored encrypted)
          |   - Consent log
          |   - Password store
          |   - Pre-authorized policies
          v
   Ed25519 Keypair (generated randomly on vault creation, stored inside vault)
          - Private key: 32-byte seed (encrypted at rest)
          - Public key: 32-byte compressed point (also stored in plaintext outside vault for verification)
          - Fingerprint: base64url(SHA-256(public key)), first 16 chars
```

**Key difference from full hierarchy**: The Ed25519 keypair is randomly generated (not derived from the passphrase). This means the same passphrase on a new device will NOT reconstruct the signing keypair -- the user must export/import the vault file. This is an acceptable trade-off for MVP: export/import is a file copy, and most users will operate from a single device.

**Upgrade path**: A future version can migrate to HKDF-derived signing keys if deterministic reconstruction becomes important (e.g., for multi-device sync without explicit export).

### 5.2 Algorithm Rationale

| Component | Algorithm | Why This Algorithm |
|-----------|-----------|-------------------|
| **Passphrase stretching** | Argon2id (time=3, memory=64MB, parallelism=4) | Memory-hard function that resists GPU and ASIC brute-force attacks. Argon2id combines Argon2i (side-channel resistant) and Argon2d (GPU-resistant) properties. OWASP-recommended. The 64MB memory parameter makes each guess cost ~64MB of RAM, pricing out large-scale attacks. |
| **Vault encryption** | AES-256-GCM | Authenticated encryption providing both confidentiality and integrity. The GCM authentication tag detects any tampering with ciphertext. Hardware-accelerated (AES-NI) on modern CPUs. Widely supported across all target platforms. |
| **Token signing** | Ed25519 (EdDSA) | Randomly generated keypair stored encrypted inside the vault. 32-byte keys and 64-byte signatures are compact. Constant-time implementation avoids timing side channels. No nonce-reuse vulnerability (unlike ECDSA). |
| **Data hashing** | SHA-256 | Standard collision-resistant hash. Used for `data_hash` in consent tokens and key fingerprints. Universally supported. |
| **Nonce generation** | CSPRNG (`crypto.getRandomValues`) | UUID v4 (128-bit random) provides sufficient entropy to prevent collisions. Generated by the platform's cryptographically secure random number generator. |
| **Proof of work** | SHA-256 partial preimage | Simple, well-understood, and easily adjustable difficulty. The verifier checks the solution in constant time. |

### 5.3 Vault Storage Format

The vault is stored as a single JSON document. The `vault` field contains the AES-256-GCM ciphertext of the user's PII and consent log.

```typescript
interface VaultStorageFormat {
  /** Schema version. Current: 2. Used for migration. */
  version: 2;

  /** KDF parameters. Stored so the vault can be unlocked on any device
   *  without needing to know the parameters in advance. */
  kdf: {
    algorithm: "argon2id";
    /** Time cost (iterations). */
    time: 3;
    /** Memory cost in KiB. 65536 = 64MB. */
    memory: 65536;
    /** Parallelism (lanes). */
    parallelism: 4;
    /** Random salt. Base64-encoded, 32 bytes. */
    salt: string;
  };

  /** AES-256-GCM ciphertext of the vault contents. Base64-encoded. */
  vault: string;

  /** AES-256-GCM initialization vector. Base64-encoded, 12 bytes.
   *  MUST be unique per encryption operation. Generated by CSPRNG. */
  vault_iv: string;

  /** AES-256-GCM authentication tag. Base64-encoded, 16 bytes.
   *  Verifies ciphertext integrity -- any tampering is detected. */
  vault_tag: string;

  /** User's Ed25519 public key. Base64-encoded, 32 bytes.
   *  Stored in plaintext so sites and agents can verify signatures
   *  without unlocking the vault. */
  signing_public_key: string;

  /** Vault creation timestamp. ISO 8601. */
  created_at: string;

  /** Last modification timestamp. ISO 8601. */
  updated_at: string;
}
```

Example:

```json
{
  "version": 2,
  "kdf": {
    "algorithm": "argon2id",
    "time": 3,
    "memory": 65536,
    "parallelism": 4,
    "salt": "dGhpcyBpcyBhIDMyLWJ5dGUgcmFuZG9tIHNhbHQ="
  },
  "vault": "<base64-AES-256-GCM-ciphertext>",
  "vault_iv": "<base64-12-bytes>",
  "vault_tag": "<base64-16-bytes>",
  "signing_public_key": "<base64-32-bytes>",
  "created_at": "2026-03-28T00:00:00Z",
  "updated_at": "2026-03-28T00:00:00Z"
}
```

### 5.4 Storage Locations by Platform

The vault is a single encrypted JSON file. The encryption IS the security boundary -- the storage backend just holds the ciphertext. This means the simplest storage that can persist a JSON blob is sufficient.

| Platform | Primary Storage | File/Key | Backup |
|----------|----------------|----------|--------|
| **CLI / Desktop** | Encrypted JSON file | `~/.agent-signup/vault.json` | Copy the file |
| **Browser (web app)** | `localStorage` | Key: `agent-signup:vault` | Export to file download |
| **Browser extension** | `chrome.storage.local` | Key: `agent-signup:vault` | Extension sync (if enabled) |

**Why `localStorage` is acceptable for MVP**: The stored value is AES-256-GCM ciphertext. An XSS attacker can read the ciphertext but cannot decrypt it without the passphrase. The passphrase-derived key exists in memory only while the vault is unlocked (max 15 minutes). The threat model for encrypted-at-rest data in localStorage is equivalent to IndexedDB -- both are accessible to same-origin scripts, and both store opaque ciphertext.

**Upgrade path**: If field-level encryption or large vaults (>5MB) become necessary, migrate to IndexedDB. The storage adapter interface makes this a non-breaking change.

### 5.5 Vault API

The vault exposes a narrow internal API to the consent UI and agent interface. This API is the **security boundary** -- all PII access flows through it.

```typescript
interface VaultAPI {
  /**
   * Unlock the vault. Derives the master key from the passphrase,
   * decrypts the vault, and returns a session token.
   * @returns Session token valid for `ttl` seconds (max 900 = 15 min).
   */
  unlock(passphrase: string): Promise<{ sessionToken: string; ttl: number }>;

  /**
   * Lock the vault. Zeroes the master key and all derived keys from memory.
   * Invalidates the session token.
   */
  lock(): Promise<void>;

  /**
   * Get PII fields for a consent request.
   * REQUIRES a valid session token AND a valid signed consent token.
   * NEVER returns fields not listed in the consent token's scope.fields.
   * The consent token's signature is verified before any data is released.
   */
  getFields(
    sessionToken: string,
    consentToken: SignedConsentToken
  ): Promise<Record<string, SensitiveString>>;

  /**
   * Generate a consent token for explicit (interactive) consent.
   * Signs the token with the user's Ed25519 private key.
   */
  createConsentToken(
    sessionToken: string,
    request: ConsentRequest
  ): Promise<SignedConsentToken>;

  /**
   * Create a pre-authorized scope (standing authorization).
   * Stored in the vault. Used to generate child tokens on demand.
   */
  createPreAuthorizedScope(
    sessionToken: string,
    scope: PreAuthorizedScopeRequest
  ): Promise<SignedScopeToken>;

  /**
   * List all active pre-authorized scopes.
   * Returns metadata only (no PII).
   */
  listScopes(sessionToken: string): Promise<ScopeInfo[]>;

  /**
   * Revoke a pre-authorized scope by ID.
   * Immediately prevents further child token generation.
   */
  revokeScope(sessionToken: string, scopeId: string): Promise<void>;

  /**
   * Export the vault (encrypted) for backup.
   * The export is the raw vault storage format -- still encrypted.
   */
  exportVault(sessionToken: string): Promise<EncryptedBlob>;

  /**
   * Import a vault from a backup.
   * Requires the passphrase to verify the import is valid.
   */
  importVault(encryptedBlob: EncryptedBlob, passphrase: string): Promise<void>;
}
```

**Critical constraints:**

1. `getFields()` MUST NEVER return fields not listed in the consent token's `scope.fields`.
2. The vault MUST validate the consent token's Ed25519 signature before releasing any data.
3. Session tokens MUST have a maximum TTL of **15 minutes** with no refresh mechanism (forces re-authentication).
4. The vault MUST auto-lock after **2 minutes** of idle time (no API calls).
5. All vault operations MUST be atomic -- partial reads are not possible.
6. The vault MUST NOT expose any bulk-export interface for decrypted PII.

### 5.6 Session Management

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Max session TTL** | 15 minutes | Limits the window during which a compromised session token can be exploited. |
| **Idle lock timeout** | 2 minutes | If no vault API calls are made for 2 minutes, the vault auto-locks, zeroing all key material from memory. |
| **Session token format** | 256-bit random token (hex-encoded) | Not a JWT -- opaque to prevent information leakage. Stored in memory only. |
| **Refresh** | Not supported | Session tokens cannot be refreshed. The user must re-authenticate (re-enter passphrase or use biometrics). |
| **Concurrent sessions** | One active session per vault instance | Opening a new session invalidates the previous one. |

### 5.7 Key Rotation

**Vault encryption key rotation** (triggered by passphrase change):
1. User authenticates with the current passphrase.
2. User provides a new passphrase.
3. New master key is derived via Argon2id with a fresh salt.
4. Vault is decrypted with the old key and re-encrypted with the new key.
5. Old ciphertext is overwritten (not appended) to prevent recovery of data under the old key.
6. Old master key is zeroed from memory.

**Signing keypair rotation:**
1. New signing key seed is derived from the new master key (or explicitly rotated).
2. New Ed25519 keypair is generated deterministically from the new seed.
3. The old public key is added to a `revoked_keys` list in the vault.
4. Sites that stored consent receipts with the old key can still verify them but MUST NOT accept new tokens signed by it.
5. The user SHOULD notify sites of the key change (protocol mechanism TBD for v1.1).

**Device compromise recovery:**
1. User generates a new vault on a new device with a new passphrase.
2. Old vault is considered compromised -- all standing authorizations are void.
3. User contacts sites to update their registered key (or sites accept a key-rotation token signed by the old key if not yet revoked).
4. Old key is added to a revocation list distributed via the user's new vault.

---

## 6. Security Architecture Recommendations

### 6.1 Transport Requirements

All communication between principals MUST be protected by TLS.

| Requirement | Specification |
|-------------|--------------|
| **TLS version** | TLS 1.3 REQUIRED. TLS 1.2 acceptable ONLY with AEAD cipher suites (e.g., `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`). |
| **Certificate validation** | Agent MUST validate the full certificate chain. Self-signed certificates MUST be rejected. |
| **HSTS** | Sites MUST send `Strict-Transport-Security: max-age=31536000; includeSubDomains`. |
| **Certificate Transparency** | Sites SHOULD publish SCTs. Agents SHOULD verify CT logs. |
| **Plaintext fallback** | FORBIDDEN. Agent SDK MUST refuse any `http://` endpoint. Exception: `localhost` in development mode only, gated by an explicit configuration flag. |

### 6.2 Agent PII Handling Rules

The agent is a transient relay. The following rules are MANDATORY for all agent implementations.

**Ephemeral handling:** PII received from the vault MUST be held in memory only. After the signup submission completes (success or failure), all PII MUST be zeroed from memory. The agent MUST NOT write PII to disk, logs, databases, or cloud storage.

**SensitiveString wrapper:** The agent SDK MUST provide a `SensitiveString` type that prevents accidental serialization of PII.

```typescript
class SensitiveString {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** Explicit access -- the only way to read the value. Intentionally verbose name to prevent casual use. */
  unsafeUnwrap(): string {
    return this.#value;
  }

  /** Zeroes the internal value. Call after submission. */
  destroy(): void {
    // Overwrite with zeros (best-effort in JS runtimes)
    this.#value = "\0".repeat(this.#value.length);
    this.#value = "";
  }

  // All serialization methods return [REDACTED]
  toString(): string { return "[REDACTED]"; }
  toJSON(): string { return "[REDACTED]"; }
  [Symbol.for("nodejs.util.inspect.custom")](): string { return "[REDACTED]"; }
  valueOf(): string { return "[REDACTED]"; }
}
```

**Logging prohibition:** Agent implementations MUST NOT log any value obtained from `SensitiveString.unsafeUnwrap()`. Static analysis or runtime checks SHOULD enforce this.

### 6.3 Site-Side Validation Order

The site SDK MUST validate incoming signup requests in this order, from cheapest to most expensive. Fail fast on cheap checks to prevent CPU exhaustion attacks.

1. **Content-Type check**: Reject non-`application/json` requests.
2. **Request size check**: Reject payloads > 16 KB before parsing.
3. **JSON schema validation**: Validate token and payload structure against the JSON schema.
4. **Token expiry check**: Reject if `exp` < current time.
5. **Audience check**: Reject if `aud` does not match the site's registered origin.
6. **Nonce check**: Reject if `jti` is in the consumed nonce set.
7. **Rate limit check**: Reject if the agent key, user key, or IP has exceeded rate limits.
8. **Proof-of-work verification** (if required): Verify `SHA-256(challenge || nonce)` has the required leading zeros.
9. **Signature verification**: Verify the Ed25519 signature (this is the expensive step).
10. **Data hash verification**: Recompute `SHA-256` of the canonical PII payload and compare to `data_hash`.
11. **Field validation**: Validate PII field values against the site's schema.

### 6.4 Nonce Management for Distributed Deployments

Sites running multiple backend instances MUST coordinate nonce consumption to prevent replay attacks across instances.

**RECOMMENDED approach:** Use a shared cache (Redis, Memcached, or equivalent) with the following semantics:

```
Key:    "agent-signup:nonce:<jti>"
Value:  "1" (existence check only)
TTL:    max_token_expiry + clock_skew_tolerance (RECOMMENDED: 360 seconds)
SET:    NX (set-if-not-exists, atomic)
```

The `SET NX` operation is atomic -- if two instances receive the same `jti` concurrently, only one succeeds. The losing instance MUST reject the request.

**Clock skew tolerance:** Sites SHOULD allow up to 60 seconds of clock skew when checking `exp`. This is separate from the nonce TTL.

### 6.5 MCP Tool Interface Security

Since agents interact via MCP tools, the protocol MUST defend against prompt injection and tool misuse.

1. **Tool parameter validation**: All MCP tool inputs MUST be validated against a strict JSON schema before processing.
2. **PII never in tool descriptions**: Tool descriptions and schemas MUST NOT contain actual PII values. PII is passed as opaque references resolved by the vault.
3. **Agent sandboxing**: The MCP tool interface MUST expose only the vault API. No filesystem, network, or arbitrary code execution access.
4. **Prompt injection defense**: The consent UI is a separate trusted context. Even if an agent's LLM is prompt-injected, it cannot bypass the consent UI (which runs in the user's browser, not in the agent's context).

---

## 7. Privacy-by-Design and GDPR

### 7.1 Data Minimization Enforcement

| Principle | Protocol Mechanism |
|-----------|-------------------|
| **Collection minimization** | Sites MUST declare `required_fields` and `optional_fields` separately in their discovery manifest. The consent UI MUST clearly distinguish them. Users MAY approve required fields only and deny all optional fields. |
| **Purpose limitation** | The consent token's `scope.purpose` is a constrained enum (`account_creation`, `identity_verification`, `newsletter_signup`). Sites MUST declare field purposes in their discovery document. The consent UI MUST display the purpose. |
| **Storage minimization** | PII exists in exactly two places: the user's vault and the site's database. The agent is a transient relay with zero persistence. No intermediary server holds PII. |
| **Retention minimization** | Sites MUST declare `data_retention` in their discovery document (e.g., "Account lifetime + 30 days"). This is displayed to the user during consent. |

### 7.2 GDPR Compliance Matrix

Every right granted by the General Data Protection Regulation (Articles 13-22) is mapped to a protocol mechanism.

| GDPR Right | Article | Protocol Mechanism |
|------------|---------|-------------------|
| **Right to be informed** | Art. 13-14 | The site's discovery document MUST include `privacy_policy` URL, `field_purposes` (per-field explanations), and `data_retention` period. The consent UI MUST display all of this before the user approves. |
| **Right of access** | Art. 15 | The vault maintains an append-only consent log recording which sites received which fields, when. The user can review this log at any time via the vault UI. |
| **Right to rectification** | Art. 16 | User updates PII in their vault. For data already submitted to sites, the user must contact the site. A "data update" token type (signed by the user's key, containing corrected values) is planned for v1.1 to automate rectification. |
| **Right to erasure** | Art. 17 | User can request deletion from any site. A "deletion request" token (signed by the user's key) is planned for v1.1. Site SDK SHOULD support an automated deletion endpoint. The consent log provides the user with a record of which sites to contact. |
| **Right to restrict processing** | Art. 18 | Consent tokens are scoped to a specific purpose. Sites MUST NOT use the data for purposes not enumerated in the token's `scope.purpose`. Additional use requires a new consent token. |
| **Right to data portability** | Art. 20 | The vault itself is the portable data store. Users can export their encrypted vault and import it on another device. The vault format is documented (Section 5.3). |
| **Right to object** | Art. 21 | Users can revoke pre-authorized scopes at any time via the vault UI. Users can remove sites from their consent history. Future consent requests from revoked scopes require interactive consent. |
| **Right not to be subject to automated decisions** | Art. 22 | Every signup is either explicitly approved by the user (interactive consent) or pre-authorized with clear limits the user configured. The agent acts only with user authorization. Pre-authorized scopes have `max_uses`, `expiry`, and `allowed_origins` constraints. |

### 7.3 Consent Logging

The vault MUST maintain an **append-only** consent log. Entries MUST NOT be modified or deleted (only the entire vault can be deleted by the user, exercising their right to erasure of the log itself).

```typescript
interface ConsentLogEntry {
  /** ISO 8601 timestamp of the action. */
  timestamp: string;

  /** Action type. */
  action: "signup_submitted" | "signup_verified" | "signup_failed" | "scope_created" | "scope_revoked";

  /** The site's origin. */
  site_origin: string;

  /** Human-readable site name from the discovery manifest. */
  site_name: string;

  /** Agent's key fingerprint. */
  agent_fingerprint: string;

  /** List of field paths shared with the site. */
  fields_shared: string[];

  /** The jti of the consent token used. */
  consent_token_jti: string;

  /** Whether consent was explicit or pre-authorized. */
  consent_mode: "explicit" | "pre_authorized";

  /** If pre-authorized, the jti of the parent scope. */
  parent_scope_jti?: string;

  /** SHA-256 hash of the site's receipt (if received). */
  site_receipt_hash?: string;
}
```

Example log entry:

```json
{
  "timestamp": "2026-03-28T12:00:00Z",
  "action": "signup_submitted",
  "site_origin": "https://example.com",
  "site_name": "Example Corp",
  "agent_fingerprint": "b4c5d6e7f8a9b0c1...",
  "fields_shared": ["name.first", "name.last", "email"],
  "consent_token_jti": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "consent_mode": "explicit",
  "site_receipt_hash": "sha256:abc123..."
}
```

This log is encrypted as part of the vault and is accessible only to the user.

### 7.4 Sensitive PII Exclusions

The protocol MUST explicitly exclude certain categories of data from agent-mediated transmission.

| Category | Fields | Handling |
|----------|--------|----------|
| **Sensitive PII** | SSN, government ID numbers, financial account numbers, biometric data, health data | MUST NEVER be transmitted via the agent signup protocol. The vault MUST NOT store these field types. If a site requests them, the consent UI MUST show a prominent warning and refuse to transmit. |
| **Direct PII** | Name, email, phone, address, date of birth | Encrypted at rest in the vault. Released only with a valid consent token. Transmitted only over TLS 1.3. |
| **Pseudonymous identifiers** | User key fingerprint, agent key fingerprint | Used for protocol operations. Not directly identifying but can be correlated across sites. Treated as personal data under GDPR. |
| **Non-personal metadata** | Consent token structure, timestamps, protocol version | No special protection required beyond transport encryption. |

### 7.5 Right to Deletion Flow

When a user wishes to exercise their right to erasure:

1. User opens the consent log in their vault and identifies the site(s) to contact.
2. User initiates a deletion request through the vault UI.
3. The vault generates a signed "deletion request" token containing: the user's key fingerprint, the site's origin, and a timestamp.
4. The token is transmitted to the site's deletion endpoint (to be standardized in v1.1).
5. The site verifies the token's signature against the public key from the original signup receipt.
6. The site deletes the user's data and returns a signed confirmation.
7. The vault logs the deletion confirmation in the consent log.

> **Note:** The deletion request mechanism is specified here for completeness. The automated endpoint is a v1.1 deliverable. For v1.0, users exercise erasure rights by contacting sites directly, using the consent log as their record.

---

## 8. Security Headers and Transport

### 8.1 Required Security Headers

The site SDK MUST automatically set the following headers on all agent-signup endpoints. These headers MUST NOT be configurable by the site developer (they are security-critical defaults).

```typescript
const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking -- agent-signup endpoints MUST NOT be framed
  "X-Frame-Options": "DENY",

  // Enforce HTTPS with preload
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

  // Prevent information leakage via referrer
  "Referrer-Policy": "no-referrer",

  // Disable unnecessary browser features
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",

  // Content Security Policy (strict)
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",                        // No inline scripts, no eval
    "style-src 'self'",                          // No inline styles
    "img-src 'self' data:",                      // Allow data URIs for icons
    "connect-src 'self'",                        // Only same-origin API calls
    "frame-ancestors 'none'",                    // Cannot be framed
    "form-action 'self'",                        // Forms submit only to same origin
    "base-uri 'self'",                           // Prevent base tag injection
    "object-src 'none'",                         // No plugins
    "require-trusted-types-for 'script'",        // Trusted Types for DOM XSS prevention
  ].join("; "),

  // Prevent caching of PII responses
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",

  // Cross-origin isolation
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};
```

### 8.2 API Endpoint Requirements

| Requirement | Specification |
|-------------|--------------|
| **Content type** | `application/json` only. The SDK MUST reject all other content types with `415 Unsupported Media Type`. |
| **Request size** | Maximum 16 KB for signup payloads. Requests exceeding this limit MUST be rejected before parsing with `413 Payload Too Large`. |
| **Rate limiting headers** | Every response MUST include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. |
| **Error responses** | MUST NOT include stack traces, internal file paths, or PII. Use opaque error codes (e.g., `INVALID_TOKEN`, `RATE_LIMITED`, `FIELD_VALIDATION_FAILED`). |
| **CORS** | Agent-signup endpoints MUST use restrictive CORS: `Access-Control-Allow-Origin` set to the specific agent origin, not `*`. Credentials MUST NOT be allowed cross-origin. |
| **Request ID** | Every request MUST receive a unique `X-Request-Id` header for audit correlation. |

### 8.3 Consent UI Isolation Requirements

The consent UI is the trust anchor for user authorization. Its isolation requirements are the strictest in the system.

| Requirement | Specification |
|-------------|--------------|
| **Origin isolation** | The consent UI MUST run on a dedicated origin (e.g., `consent.agent-signup.local` for extensions, or a browser extension popup). It MUST NOT run in an iframe controlled by the agent or site. |
| **CSP** | Strictest possible: `script-src 'self'` with no `unsafe-inline` or `unsafe-eval`. |
| **Trusted Types** | MUST be enabled (`require-trusted-types-for 'script'`) to prevent DOM XSS. |
| **Subresource Integrity** | All scripts MUST be loaded with SRI hashes. |
| **Third-party scripts** | ZERO external scripts. No analytics, no tracking, no CDN-loaded libraries. Every byte of JavaScript in the consent UI MUST be first-party. |
| **DOM isolation** | If rendered inside a host page, MUST use a Shadow DOM with `mode: 'closed'` to prevent external script access to the consent UI's DOM tree. |

---

## 9. Implementation Checklist

### Phase 1: Core Security (Pre-Release -- MUST complete before any deployment)

All items in this phase are blocking for any release, including internal testing.

- [ ] **Vault encryption**: AES-256-GCM with Argon2id key derivation implemented and tested. Verify GCM authentication tag detects tampering.
- [ ] **Ed25519 signing**: Consent token creation and verification working end-to-end. Verify deterministic key derivation from seed.
- [ ] **Consent token validation**: All required claims enforced. Specifically: `aud` binding, `exp` freshness, `jti` uniqueness, `data_hash` integrity check.
- [ ] **Replay prevention**: Site SDK maintains nonce ledger with TTL-based pruning. Verify `jti` consumption is atomic (no TOCTOU race).
- [ ] **Field-level access control**: Vault API never releases fields not in the consent token's `scope.fields`. Verify with negative tests (request fields not in scope).
- [ ] **TLS enforcement**: Agent SDK refuses `http://` endpoints. Site SDK enforces HSTS. Verify no plaintext fallback path exists.
- [ ] **Input validation**: All API inputs validated against JSON schemas (Zod or equivalent). Verify malformed inputs are rejected before cryptographic operations.
- [ ] **Security headers**: All headers from Section 8.1 applied to site SDK endpoints. Verify with automated header scanning.
- [ ] **Rate limiting**: Per-agent-key and per-IP rate limits enforced in site SDK. Verify limits are applied before signature verification.
- [ ] **Error handling**: No PII or internal details in error responses. Verify error messages are opaque.
- [ ] **Consent UI isolation**: Runs in a separate trusted context from the agent. Verify origin isolation.
- [ ] **SensitiveString wrapper**: PII types override `toString()`, `toJSON()`, and `inspect()` to return `[REDACTED]`. Verify with serialization tests.
- [ ] **Auto-lock**: Vault locks after 15 min session TTL or 2 min idle. Verify master key is zeroed from memory on lock.

### Phase 2: Defense in Depth (Pre-Beta -- MUST complete before public beta)

These items harden the system against sophisticated attacks and establish non-repudiation.

- [ ] **Proof-of-work**: Hashcash-style challenge for signup submissions. Dynamic difficulty adjustment based on load.
- [ ] **Agent co-signing**: Agent appends its own Ed25519 signature to the submission for non-repudiation.
- [ ] **Site receipt**: Site SDK returns a signed receipt to the agent for the user's audit trail.
- [ ] **Pre-authorized scope management**: Creation, use counting, expiry enforcement, and revocation all working. Verify `remaining_uses` is decremented atomically.
- [ ] **Consent log**: Append-only log of all signups stored in the vault. Verify entries cannot be modified or deleted individually.
- [ ] **WebAuthn user-presence attestation**: For sites that require human-in-the-loop proof. Verify assertion recency.
- [ ] **Key rotation ceremony**: Passphrase change re-encrypts vault with new key, rotates signing keypair, adds old key to revocation list.
- [ ] **Dependency audit**: Site SDK has zero or near-zero runtime dependencies. Verify dependency tree.
- [ ] **npm package signing**: Site SDK published with npm provenance attestations.

### Phase 3: Ecosystem Hardening (Pre-GA -- MUST complete before general availability)

These items address ecosystem-level threats and prepare for adversarial production use.

- [ ] **Agent registry**: Public registry for agent key verification. Agents can register their public keys for cross-referencing.
- [ ] **Site verification**: Sites can register their keys for cross-referencing by agents and users.
- [ ] **Shared abuse blocklist**: Opt-in list of revoked and abusive agent keys shared across participating sites.
- [ ] **Deletion request token**: Protocol-native mechanism for GDPR Article 17 erasure requests.
- [ ] **Data update token**: Protocol-native mechanism for GDPR Article 16 rectification.
- [ ] **Audit export**: User can export consent log in machine-readable format (JSON) for regulatory compliance.
- [ ] **Third-party security audit**: Engage a reputable security firm to audit the protocol specification and all three reference implementations (site SDK, client library, agent tools).
- [ ] **Formal verification**: Consider formal verification (e.g., ProVerif, Tamarin) of the consent token validation logic and key derivation paths.
- [ ] **Bug bounty program**: Establish on HackerOne or Bugcrowd, covering the protocol specification, SDKs, and vault implementation.

---

## Appendix A: Cryptographic Algorithm Summary

| Purpose | Algorithm | Key/Output Size | Rationale |
|---------|-----------|-----------------|-----------|
| Passphrase stretching | Argon2id | 256-bit output | Memory-hard, resists GPU/ASIC attacks, OWASP recommended |
| Key derivation | HKDF-SHA256 | 256-bit input | Standard KDF (RFC 5869), domain separation via `info` parameter |
| Vault encryption | AES-256-GCM | 256-bit key | AEAD, hardware-accelerated (AES-NI), tamper detection via auth tag |
| Token signing | Ed25519 (EdDSA) | 32-byte key, 64-byte signature | Fast, compact, deterministic, no nonce-reuse vulnerability |
| Data hashing | SHA-256 | 256-bit digest | Standard, collision-resistant, universally supported |
| Nonce generation | CSPRNG (crypto.getRandomValues) | 128-bit (UUID v4) | Cryptographically secure, sufficient entropy for uniqueness |
| Proof of work | SHA-256 partial preimage | Configurable difficulty | Simple, well-understood, adjustable, constant-time verification |

## Appendix B: Threat-to-Mitigation Traceability

This table maps every identified threat to its primary mitigation and the component responsible for enforcement.

| Threat ID | Threat Summary | Primary Mitigation | Enforcement Component |
|-----------|---------------|-------------------|----------------------|
| S1 | Agent impersonation | Agent key registration + TOFU ceremony | Vault, Consent UI |
| S2 | Consent UI spoofing | Origin isolation, CSP, Trusted Types | Consent UI |
| S3 | Site impersonation | Origin binding (`aud`), TLS certificate verification | Agent SDK |
| S4 | User spoofing (stolen device) | Biometric unlock, short session TTL, auto-lock | Vault |
| T1 | PII tampering in transit | `data_hash` SHA-256 in consent token | Consent Token, Site SDK |
| T2 | Token tampering | Ed25519 signature over all claims | Consent Token |
| T3 | Vault tampering at rest | AES-256-GCM authenticated encryption | Vault |
| R1 | User denies consent | Cryptographic consent receipt (signed token) | Site SDK |
| R2 | Agent denies submission | Agent co-signature on submission | Agent SDK, Site SDK |
| R3 | Site denies receipt | Signed receipt from site to agent | Site SDK |
| I1 | Agent retains PII | Ephemeral handling mandate, SensitiveString | Agent SDK |
| I2 | PII in logs/dumps | SensitiveString wrapper, logging prohibition | Agent SDK |
| I3 | Excessive field collection | Required/optional distinction, consent UI | Consent UI, Protocol |
| I4 | Vault exfiltration via XSS | AES-256-GCM encryption, passphrase-gated, CSP | Vault, Consent UI |
| I5 | MITM interception | TLS 1.3 mandatory, certificate pinning | Agent SDK, Site SDK |
| D1 | Bot mass signups | 5-layer defense (identity, rate limit, PoW, presence, reputation) | Site SDK |
| D2 | Consent UI flooding | Per-agent rate limits, block/revoke, deduplication | Consent UI |
| D3 | Invalid token flood | Cheap validation before crypto, key banning | Site SDK |
| E1 | Pre-auth scope creep | Narrow scope definition, use counting, expiry | Vault |
| E2 | Cross-site token reuse | `aud` claim binding | Consent Token, Site SDK |
| E3 | Full vault access escalation | Field-level access control at vault layer | Vault API |
