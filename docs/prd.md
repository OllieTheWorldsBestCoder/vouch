# Agent Signup: Product Requirements Document

**Version:** 0.2.0 (Architecture Complete)
**Date:** 2026-03-28
**Status:** RFC -- Architecture resolved, seeking implementation feedback

**Companion documents:**
- `protocol.md` -- Wire protocol specification (discovery, API, MCP tools, consent flows)
- `security.md` -- Threat model, consent token spec, vault design, GDPR mapping
- `sdk-design.md` -- Package architecture and developer experience

---

## Executive Summary

Agent Signup is a two-sided SDK and protocol that lets AI agents register for online services on behalf of users -- the "Sign Up with Agent" button, analogous to what OAuth did for login delegation. Users store their identity data client-side in an encrypted vault. AI agents discover participating sites, request the user's consent, and broker signups by transmitting only the fields the site requires. No central server stores PII. Sites integrate via an npm package. Agents interact via REST API and MCP tools.

The first deliverable is this product specification and the accompanying architecture document. No production code yet.

---

## Problem Statement

**What problem does this solve?**

Signing up for online services is tedious, repetitive, and error-prone. Users fill out the same name/email/address fields hundreds of times. AI agents are increasingly capable of acting on a user's behalf, but there is no standardized, privacy-respecting protocol for an agent to register a user for a service. Today, agents either screen-scrape signup forms (fragile, often blocked) or cannot sign up at all.

**For whom?**

1. End users who want their AI agent to handle registrations without manually filling forms.
2. Site developers who want to accept agent-driven signups cleanly (not via bot traffic that looks like abuse).
3. AI agent developers who need a reliable, standardized way to register users for services.

**Why now?**

- AI agents (Claude, GPT, Gemini, open-source) are mainstream and increasingly autonomous.
- MCP (Model Context Protocol) has established a standard for agent-tool interaction.
- Users are growing comfortable delegating tasks to agents but lack infrastructure for it.
- Privacy regulations (GDPR, CCPA) make a client-side-only PII approach both necessary and marketable.

---

## Objectives

| Priority | Objective |
|----------|-----------|
| Primary | Define a protocol that allows AI agents to sign up for services on behalf of users with explicit consent |
| Primary | Keep all user PII client-side -- no central identity server |
| Secondary | Make site integration trivially easy (npm install + a few lines of code) |
| Secondary | Support both interactive consent (per-signup approval) and pre-authorized scopes |
| Tertiary | Achieve adoption by at least 3 agent frameworks and 10 participating sites within 6 months of launch |

---

## Success Metrics

### North Star Metric
**Successful agent-brokered signups per week** -- the count of signups that complete end-to-end (agent request -> user consent -> site registration confirmed).

### Leading Indicators

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| SDK npm downloads (site-side) | 0 | 500/week | 12 weeks post-launch |
| Sites with agent-signup enabled | 0 | 10 | 12 weeks post-launch |
| Agent frameworks with native support | 0 | 3 | 16 weeks post-launch |
| User vaults created | 0 | 1,000 | 12 weeks post-launch |

### Lagging Indicators

| Metric | Target | Timeline |
|--------|--------|----------|
| Successful signups/week | 200 | 16 weeks |
| User retention (vault active after 30d) | 60% | 20 weeks |
| Site developer satisfaction (NPS) | > 40 | 20 weeks |

### Guardrail Metrics (must NOT degrade)

| Metric | Constraint |
|--------|------------|
| Signup fraud rate via agent channel | < 2% of total agent signups |
| PII leakage incidents | 0 |
| Consent bypasses | 0 |
| Agent signup latency (p95) | < 5 seconds end-to-end |

---

## User Personas

### Persona 1: Alex -- The End User

- **Who:** A technically comfortable professional (25-45) who uses an AI assistant daily for productivity tasks. Not necessarily a developer, but comfortable with browser extensions and settings screens.
- **Goal:** Delegate the tedium of signing up for new services to their AI agent. Fill out identity info once, then let the agent handle it everywhere.
- **Pain:** Currently copies and pastes the same info into dozens of forms per year. Some forms are long and confusing. Worries about which sites have their data. Wants control.
- **Key behaviors:** Uses an AI agent (Claude, ChatGPT, etc.) through a chat interface or IDE. Willing to grant permissions but wants to review what is shared. Checks signup history occasionally.

### Persona 2: Jordan -- The Site Developer

- **Who:** A full-stack developer building a SaaS product, marketplace, or content platform. Uses Next.js or a similar framework. Wants more signups with less friction.
- **Goal:** Accept agent-driven signups as a new acquisition channel without rewriting their auth system. Drop-in integration.
- **Pain:** Current signup forms have high abandonment rates. Would love a frictionless channel but does not want to accept unverified bot traffic. Needs to trust the data is real and consented.
- **Key behaviors:** Evaluates libraries by ease of integration and documentation quality. Will not adopt anything that requires more than 30 minutes to set up. Needs to maintain control of their user model.

### Persona 3: Agent Runtime -- The AI Agent

- **Who:** An AI agent (Claude, GPT, open-source LLM) operating within a framework (MCP, LangChain, AutoGen, etc.) on behalf of a user.
- **Goal:** Discover which sites support agent signup, determine what fields are needed, obtain user consent, and complete the registration.
- **Pain:** Today there is no standard for this. Agents either fail silently, attempt fragile form-filling via browser automation, or skip the task entirely. No way to know if a site supports agent registration.
- **Key behaviors:** Reads `.well-known` discovery files. Calls REST APIs and MCP tools. Follows structured protocols. Needs clear error codes and retry semantics.

---

## Protocol Overview

The Agent Signup protocol has four phases:

```
1. DISCOVER  -- Agent finds the site's agent-signup manifest
2. CONSENT   -- Agent requests user permission to share specific fields
3. REGISTER  -- Agent submits the signup payload to the site
4. VERIFY    -- Site confirms the signup (email verification, etc.)
```

### Discovery
Sites publish a manifest at `/.well-known/agent-signup.json` describing:
- Required fields (name, email, etc.)
- Optional fields
- Custom fields with descriptions
- Verification requirements (email, phone, CAPTCHA, none)
- Terms of service URL
- Protocol version

### Consent
The agent presents the manifest to the user's consent layer. Two modes:
1. **Interactive consent:** A UI prompt shows exactly which fields will be shared and with which site. User approves or denies.
2. **Pre-authorized scopes:** User has pre-configured rules like "share name + email with any site rated > 4 stars" or "auto-approve for sites in my bookmarks."

### Registration
The agent POSTs a signed payload to the site's agent-signup endpoint. The payload contains only the consented fields, a consent proof token, and a nonce.

### Verification
If the site requires email verification, the protocol handles it through a callback mechanism. The agent can poll for verification status.

---

## Scope

### MVP (Must Have) -- v1.0

**Protocol & Specification**
- Agent Signup protocol specification (discovery, consent, register, verify)
- `.well-known/agent-signup.json` manifest format
- REST API specification for the signup endpoint
- MCP tool definitions for agent interaction
- Consent token format and validation

**Site-Side SDK (`@agent-signup/site`)**
- npm package for site developers
- Express/Next.js middleware that serves the manifest and handles agent signup requests
- Field schema definition API (declarative, type-safe)
- Request validation (consent token verification, field validation)
- Webhook/callback for signup completion events
- Email verification flow support (generate token, verify token)

**User-Side Client (`@agent-signup/client`)**
- Local identity vault (encrypted, stored in browser storage or local file)
- Vault CRUD: add, update, delete identity fields
- Consent prompt UI component (embeddable in agent UIs)
- Consent token generation (signed, time-limited)
- Signup history log (local only)
- Pre-authorized scope configuration

**Agent-Side Tools (`@agent-signup/agent`)**
- MCP tool: `agent_signup_discover` -- fetch and parse a site's manifest
- MCP tool: `agent_signup_request_challenge` -- get a nonce for consent token signing
- MCP tool: `agent_signup_submit` -- POST the signup payload with consent token
- MCP tool: `agent_signup_check_status` -- poll for verification status
- MCP tool: `agent_signup_verify` -- submit a verification code
- REST client library wrapping the same operations
- Error handling with structured error codes

**Core Field Types (MVP)**
- `name` (first, last, display)
- `email`
- `phone` (optional)
- `username` (if site requires one)
- `password` (generated, stored in vault, never transmitted in plain text -- see Password section)
- `date_of_birth` (for age-gating)
- `country` / `locale`

### v1.1 (Should Have)

- **Address fields** -- street, city, state, zip, country (structured)
- **Profile photo** -- URL or base64, with size constraints
- **OAuth bridge** -- sites that also support "Sign in with Google" can link the agent signup to an OAuth identity
- **Agent identity verification** -- cryptographic proof that the agent is a recognized, non-malicious agent
- **Rate limiting specification** -- standard rate limit headers and backoff protocol
- **Batch signup** -- agent signs up for multiple sites in one consent flow
- **Vault portability** -- export/import vault between devices
- **CLI tool** -- `npx agent-signup init` to scaffold a site integration

### Later (Nice to Have)

- **Decentralized identity integration** -- DID/Verifiable Credentials compatibility
- **Browser extension** -- auto-detect signup forms and offer agent-signup as an alternative
- **Reputation system** -- sites rate agents, agents rate sites, shared trust scores
- **Multi-user vaults** -- family/team identity management
- **Payment field support** -- credit card or payment method for paid signups
- **Native mobile SDK** -- iOS/Android vault and consent UI
- **Agent marketplace** -- directory of agent-signup-enabled sites

### Explicitly Out of Scope

- **Central identity server or directory** -- no PII leaves the user's device except to the target site
- **Login/authentication protocol** -- this is signup only; login is a separate problem (use OAuth, passkeys, etc.)
- **Form-filling / browser automation** -- this is a structured protocol, not a screen-scraping tool
- **Payment processing** -- sites handle their own billing
- **Identity verification (KYC)** -- this protocol transmits user-provided data; it does not verify identity documents
- **CAPTCHA solving** -- if a site requires CAPTCHA, the agent must defer to the user or the site must waive it for agent-signup
- **User analytics or tracking** -- the protocol does not track user behavior across sites

---

## User Stories

### End User Stories

#### US-1: Initial Vault Setup
**As** Alex (end user), **I want to** create an identity vault and fill in my basic information once, **so that** my agent can use it for future signups without me re-entering data.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given I have not set up a vault before, when I open the Agent Signup client, then I see an onboarding flow asking for my name, email, and optional fields.
  - Given I complete onboarding, when I save, then my data is encrypted and stored locally (browser localStorage or a local config file, depending on the client).
  - Given I have a vault, when I return to the client, then I can view and edit my stored fields.
  - Given I am editing my vault, when I change my email, then the change is reflected in all future signups but does NOT retroactively update past signups.
- **Edge Cases:**
  - User closes the browser mid-onboarding: partial state is not saved; they restart fresh.
  - User has multiple email addresses: vault supports multiple values per field type, with one marked as default.
  - User clears browser storage: vault is lost. A warning is shown before any destructive action. Export/import is a v1.1 feature.
- **Dependencies:** None (standalone client).

#### US-2: Interactive Consent for a Signup
**As** Alex, **I want to** review exactly which fields my agent will share with a specific site before the signup happens, **so that** I remain in control of my personal data.

- **Priority:** P0
- **Effort:** L
- **Acceptance Criteria:**
  - Given my agent has discovered a site's signup manifest, when it requests consent, then I see a UI showing: the site's name/URL, the fields being requested (required vs. optional), and the site's ToS link.
  - Given the consent prompt is shown, when I approve, then a time-limited consent token is generated and returned to the agent.
  - Given the consent prompt is shown, when I deny, then the agent receives a denial response and does not proceed.
  - Given a field is optional, when I uncheck it, then it is excluded from the consent token and not sent to the site.
  - Given I approve, when the consent token expires (default: 5 minutes), then the agent must re-request consent.
- **Edge Cases:**
  - Site requests a field not in my vault (e.g., phone number): the consent UI shows a warning and lets me enter it ad-hoc or skip it.
  - Agent requests consent while user is offline: the request queues and resolves when the user comes back online.
  - Multiple consent requests arrive simultaneously: they are queued and presented one at a time.
- **Dependencies:** US-1 (vault must exist).

#### US-3: Pre-Authorized Scopes
**As** Alex, **I want to** configure rules that auto-approve signups matching certain criteria, **so that** my agent can act faster without interrupting me for routine signups.

- **Priority:** P1
- **Effort:** M
- **Acceptance Criteria:**
  - Given I am in the settings screen, when I create a pre-authorization rule, then I can specify: which fields to share, conditions (e.g., specific domains, domain allowlists, all sites), and an expiration date for the rule.
  - Given a pre-authorization rule matches an incoming signup request, when my agent requests consent, then the consent is auto-granted without a UI prompt.
  - Given a pre-authorization was used, when I check my signup history, then the entry is clearly marked as "auto-approved" with the rule that matched.
  - Given I want to revoke a rule, when I delete it, then future requests matching that rule revert to interactive consent.
- **Edge Cases:**
  - A rule matches but the site requests additional fields beyond what the rule covers: falls back to interactive consent for the extra fields.
  - User creates conflicting rules (one allows, one denies): deny takes precedence.
  - Rule expiration: expired rules are visually marked and no longer match.
- **Dependencies:** US-1, US-2.

#### US-4: Reviewing Signup History
**As** Alex, **I want to** see a log of every signup my agent has performed on my behalf, **so that** I can audit where my data went and revoke or follow up if needed.

- **Priority:** P1
- **Effort:** S
- **Acceptance Criteria:**
  - Given signups have occurred, when I open the history view, then I see a chronological list with: site name, date, fields shared, consent mode (interactive vs. auto-approved), and verification status.
  - Given I select a signup entry, when I view details, then I see the full set of fields that were transmitted.
  - Given I want to find a specific signup, when I search or filter, then I can filter by site name, date range, or consent mode.
- **Edge Cases:**
  - Signup failed mid-way (e.g., verification timed out): entry shows as "incomplete" with a reason.
  - Hundreds of signups: list is paginated or virtualized.
  - User deletes vault: history is also deleted (it is part of the vault).
- **Dependencies:** US-1, US-2.

#### US-5: Password Generation and Storage
**As** Alex, **I want** my agent to generate a strong, unique password for each signup and store it in my vault, **so that** I do not reuse passwords and do not have to think about them.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given a site's manifest indicates a password is required, when my agent prepares the signup, then a cryptographically random password is generated meeting the site's stated requirements (length, character classes).
  - Given a password is generated, when the signup completes, then the password is stored in my vault, associated with the site.
  - Given I need to log in later, when I look up the site in my vault, then I can view or copy the stored password.
  - Given the site has no password requirements in its manifest, when a password is needed, then a default policy applies (20+ chars, mixed case, numbers, symbols).
- **Edge Cases:**
  - Site rejects the generated password (unexpected constraint): the agent retries with adjusted parameters, up to 3 attempts.
  - User wants to set their own password: consent UI offers an override field.
  - Password manager integration (1Password, Bitwarden): out of scope for MVP, tracked for v1.1.
- **Dependencies:** US-1.

---

### Site Developer Stories

#### US-6: Basic Integration
**As** Jordan (site developer), **I want to** install an npm package and add a few lines of code to accept agent-driven signups, **so that** I get a new signup channel without a major rewrite.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given I run `npm install @agent-signup/site`, when I follow the quickstart guide, then I have a working integration in under 15 minutes.
  - Given I add the middleware to my Next.js app, when an agent hits `/.well-known/agent-signup.json`, then the manifest is served correctly.
  - Given I define my signup fields in a schema, when an agent submits a signup, then the middleware validates the payload and calls my `onSignup` handler with typed, validated data.
  - Given the signup succeeds, when my handler returns, then the middleware sends a structured success response to the agent.
- **Edge Cases:**
  - Developer uses Express instead of Next.js: middleware works with any Node.js HTTP framework.
  - Developer's existing user model has fields not in the standard set: see US-8 (custom fields).
  - Developer already has rate limiting: the SDK respects existing middleware and does not conflict.
- **Dependencies:** Protocol specification.

**Integration code example (target DX):**
```typescript
// app/api/agent-signup/route.ts (Next.js App Router)
import { createAgentSignupHandler } from '@agent-signup/site';

const handler = createAgentSignupHandler({
  fields: {
    required: ['name', 'email'],
    optional: ['phone', 'username'],
  },
  verification: 'email',
  onSignup: async (userData, metadata) => {
    // userData is typed: { name: { first: string, last: string }, email: string, ... }
    // metadata includes: agentId, consentProof, timestamp
    const user = await db.users.create({
      email: userData.email,
      name: `${userData.name.first} ${userData.name.last}`,
      source: 'agent-signup',
      agentId: metadata.agentId,
    });
    return { userId: user.id }; // returned to the agent
  },
});

export const POST = handler.POST;
export const GET = handler.GET; // serves the manifest
```

#### US-7: Email Verification Flow
**As** Jordan, **I want** agent signups to go through the same email verification as manual signups, **so that** I know the email address is valid and owned by the user.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given I set `verification: 'email'` in my config, when an agent signup arrives, then the SDK sends a verification email to the provided address using my configured email provider (or a built-in sender).
  - Given a verification email is sent, when the user clicks the link, then the signup is marked as verified and a webhook/callback fires.
  - Given the agent polls `check_verification`, when the email is verified, then the agent receives a `verified: true` response.
  - Given 30 minutes pass without verification, when the agent polls, then it receives `expired: true` and the signup is invalidated.
- **Edge Cases:**
  - Email provider is down: the signup enters a `pending_verification` state; the site can retry sending.
  - User clicks the link after expiration: they see a "link expired" page with a resend option.
  - The email goes to spam: not a protocol problem, but documentation should advise sites to configure SPF/DKIM.
- **Dependencies:** US-6.

#### US-8: Custom Fields
**As** Jordan, **I want to** define custom fields beyond the standard set, **so that** I can collect information specific to my application (e.g., company name, role, referral code).

- **Priority:** P1
- **Effort:** S
- **Acceptance Criteria:**
  - Given I add a custom field to my schema, when I define it with a name, type, description, and validation rules, then it appears in my manifest.
  - Given the agent reads the manifest, when it encounters a custom field, then it presents it to the user with the description from the manifest.
  - Given the user provides a value, when the agent submits, then the custom field is included in the payload and validated server-side.
  - Given a custom field is required, when the agent omits it, then the request is rejected with a clear error.
- **Edge Cases:**
  - Custom field type is complex (e.g., multi-select): supported types are limited to `string`, `number`, `boolean`, `enum`, `date` for MVP. Complex types are v1.1.
  - Custom field name collides with a standard field name: the SDK rejects the schema at build time with a clear error.
  - Agent does not understand the custom field description: the agent should present it as a free-text input to the user.
- **Dependencies:** US-6.

**Custom field schema example:**
```typescript
fields: {
  required: ['name', 'email'],
  optional: ['phone'],
  custom: [
    {
      key: 'company_name',
      type: 'string',
      label: 'Company Name',
      description: 'Your company or organization name',
      required: true,
      validation: { minLength: 1, maxLength: 200 },
    },
    {
      key: 'referral_code',
      type: 'string',
      label: 'Referral Code',
      description: 'Optional referral code from an existing user',
      required: false,
    },
    {
      key: 'plan',
      type: 'enum',
      label: 'Plan',
      description: 'Which plan would you like to start with?',
      options: ['free', 'pro', 'enterprise'],
      required: true,
    },
  ],
}
```

#### US-9: Signup Event Handling
**As** Jordan, **I want to** receive structured events when agent signups occur, **so that** I can trigger my existing onboarding flows (welcome emails, CRM updates, analytics).

- **Priority:** P1
- **Effort:** S
- **Acceptance Criteria:**
  - Given I configure an `onSignupComplete` callback, when a signup is fully verified, then the callback fires with the user data and signup metadata.
  - Given I configure a webhook URL, when a signup completes, then a POST is sent to the URL with the same payload.
  - Given a signup fails validation, when the `onSignupError` callback is configured, then it fires with the error details.
- **Edge Cases:**
  - Webhook URL is unreachable: retry 3 times with exponential backoff, then mark as failed.
  - `onSignup` handler throws: the agent receives a `500` with a generic error (no internal details leaked).
- **Dependencies:** US-6.

---

### Agent Stories

#### US-10: Site Discovery
**As** an AI agent, **I want to** discover whether a site supports agent signup and what fields it requires, **so that** I can determine if I can register the user there.

- **Priority:** P0
- **Effort:** S
- **Acceptance Criteria:**
  - Given I have a site URL, when I fetch `https://{domain}/.well-known/agent-signup.json`, then I receive a manifest or a 404.
  - Given the manifest exists, when I parse it, then I get structured data: required fields, optional fields, custom fields, verification method, ToS URL, and protocol version.
  - Given the manifest specifies protocol version 1, when I am a v1-compatible agent, then I can proceed with the signup flow.
  - Given the manifest does not exist (404), when I check, then I conclude the site does not support agent signup.
- **Edge Cases:**
  - Manifest is malformed JSON: agent logs an error, reports to user that the site's agent-signup is misconfigured.
  - Manifest uses a newer protocol version: agent reports incompatibility to the user.
  - Site returns a redirect for the `.well-known` URL: agent follows up to 3 redirects.
  - Site is behind Cloudflare/CDN and returns a challenge page: agent treats it as unsupported.
  - DNS failure: agent reports the site is unreachable.
- **Dependencies:** Protocol specification.

#### US-11: Consent Request
**As** an AI agent, **I want to** request the user's consent to share specific fields with a specific site, **so that** I act only with explicit permission.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given I have a parsed manifest, when I call `request_consent` (MCP tool) with the site URL and requested fields, then the user's consent layer is invoked.
  - Given the user approves, when the consent layer responds, then I receive a signed consent token valid for 5 minutes.
  - Given the user denies, when the consent layer responds, then I receive a denial with an optional reason.
  - Given a pre-authorization rule matches, when I call `request_consent`, then I receive a consent token immediately without user interaction.
- **Edge Cases:**
  - Consent layer is unreachable (user offline): agent receives a timeout error and informs the user.
  - User takes longer than 5 minutes to decide: the request times out; the agent can re-request.
  - Agent requests fields not in the manifest: the consent layer rejects the request.
- **Dependencies:** US-2, US-10.

#### US-12: Submit Signup
**As** an AI agent, **I want to** submit a signed signup payload to a site's endpoint, **so that** the user is registered.

- **Priority:** P0
- **Effort:** M
- **Acceptance Criteria:**
  - Given I have a consent token and user data, when I POST to the site's agent-signup endpoint, then the site validates the token and processes the signup.
  - Given the signup succeeds, when the site responds, then I receive a success response with a signup ID and verification status.
  - Given the signup requires verification, when the site responds with `status: 'pending_verification'`, then I know to poll the verification endpoint.
  - Given the signup fails validation, when the site responds with a 422, then I receive structured error details (which fields failed, why).
- **Edge Cases:**
  - Consent token has expired: site returns `401` with `token_expired` error; agent must re-request consent.
  - Site is under maintenance: site returns `503`; agent backs off and retries.
  - Network failure mid-request: agent retries with the same nonce (idempotent by design).
  - Duplicate signup (same email): site returns `409` with `already_registered`; agent informs the user.
- **Dependencies:** US-10, US-11.

#### US-13: Verification Polling
**As** an AI agent, **I want to** check whether email verification has completed, **so that** I can inform the user when their signup is fully active.

- **Priority:** P1
- **Effort:** S
- **Acceptance Criteria:**
  - Given a signup is pending verification, when I call `check_verification` with the signup ID, then I receive the current status (`pending`, `verified`, `expired`, `failed`).
  - Given the status is `verified`, when I inform the user, then the signup is complete.
  - Given the status is `expired`, when I inform the user, then I offer to retry the signup.
  - Given I poll, when the site includes a `Retry-After` header, then I respect the interval.
- **Edge Cases:**
  - Agent polls too aggressively: site returns `429 Too Many Requests` with a `Retry-After` header.
  - Signup ID is invalid: site returns `404`.
  - Verification method changes (site updates their manifest): does not affect in-flight signups.
- **Dependencies:** US-12.

---

## User-Side Experience: Detailed Design

### Vault Setup Flow

1. **First launch:** User opens the Agent Signup client (web app, browser extension, or desktop app). Sees a clean onboarding screen: "Set up your identity vault to let your AI agent sign up for services on your behalf."
2. **Core fields:** User enters: first name, last name, email(s), and optionally phone, date of birth, country. These map to the protocol's standard field types.
3. **Encryption:** User sets a vault passphrase (or uses device biometrics if available). All data is encrypted with AES-256-GCM before being written to local storage.
4. **Confirmation:** Vault is created. User sees a summary of stored fields and a link to agent integration instructions.

**Storage locations by platform:**
- CLI / Desktop: Encrypted JSON file at `~/.agent-signup/vault.json`. Users can back up by copying the file.
- Browser: `localStorage` with AES-256-GCM encryption (the ciphertext is opaque to XSS). Key: `agent-signup:vault`.

### Consent UI

The consent prompt is a modal or dedicated view that shows:

```
+---------------------------------------------------------+
|  Agent Signup Request                                    |
|                                                          |
|  [Agent Icon] Your agent wants to sign you up for:      |
|                                                          |
|  ACME Corp (https://acme.com)                           |
|  "Project management for teams"                          |
|                                                          |
|  Fields to share:                                        |
|  [x] Full Name         Alex Johnson        (required)   |
|  [x] Email             alex@example.com    (required)   |
|  [ ] Phone             +1-555-0123         (optional)   |
|  [x] Company Name      ____________        (custom)     |
|                                                          |
|  A password will be generated and stored in your vault.  |
|                                                          |
|  Terms of Service: https://acme.com/terms                |
|                                                          |
|  [Deny]                               [Approve Signup]   |
+---------------------------------------------------------+
```

Key behaviors:
- Required fields are pre-checked and cannot be unchecked (but user can edit values).
- Optional fields are unchecked by default.
- Custom fields show the site's description and allow inline entry.
- The site URL is always shown to prevent phishing (agent cannot misrepresent the target site).
- "Terms of Service" link opens in a new tab.
- If the user's vault is missing a required field, an inline form appears to collect it.

### Pre-Authorized Scopes UI

Settings panel where users create rules:

```
+---------------------------------------------------------+
|  Pre-Authorization Rules                                 |
|                                                          |
|  + New Rule                                              |
|                                                          |
|  Rule 1: "Trusted sites"                                |
|  Domains: acme.com, example.com, trusted.io              |
|  Fields: name, email                                     |
|  Expires: 2026-06-28                                     |
|  [Edit] [Delete]                                         |
|                                                          |
|  Rule 2: "Basic signups anywhere"                        |
|  Domains: * (all)                                        |
|  Fields: name, email                                     |
|  Expires: 2026-04-28                                     |
|  [Edit] [Delete]                                         |
|                                                          |
|  Note: If a site requests fields beyond what a rule      |
|  covers, you will still be prompted for approval.        |
+---------------------------------------------------------+
```

Rule conditions (MVP):
- Domain allowlist (specific domains or wildcard `*`)
- Field allowlist (which fields can be auto-shared)
- Expiration date
- Max signups per day (rate limit)

### Signup History View

```
+---------------------------------------------------------+
|  Signup History                                          |
|                                                          |
|  [Search...] [Filter: All v]                            |
|                                                          |
|  Mar 28, 2026  ACME Corp (acme.com)                     |
|  Fields: name, email | Verified | Auto-approved (Rule 1)|
|                                                          |
|  Mar 27, 2026  Beta App (beta.io)                       |
|  Fields: name, email, phone | Verified | Manual approval |
|                                                          |
|  Mar 25, 2026  Gamma SaaS (gamma.dev)                   |
|  Fields: name, email | Pending verification              |
|                                                          |
|  Mar 20, 2026  Delta Tool (delta.tools)                 |
|  Fields: name, email | Failed - email bounced            |
+---------------------------------------------------------+
```

---

## Site-Developer Experience: Detailed Design

### Integration Steps

1. **Install:** `npm install @agent-signup/site`
2. **Configure:** Define your field schema and signup handler.
3. **Mount:** Add the route handler to your app (Next.js, Express, Fastify, etc.).
4. **Test:** Use the provided CLI tool or test agent to simulate a signup.
5. **Deploy:** The `.well-known/agent-signup.json` is served automatically.

Total time target: **under 15 minutes** from install to first test signup.

### Manifest Schema (`.well-known/agent-signup.json`)

> **Note:** The canonical manifest schema is defined in `protocol.md` Section 2 (Discovery Protocol) with full Zod schema and field descriptions. The example below shows the conceptual structure for this PRD. Implementors MUST follow `protocol.md`.

The manifest includes: `protocol_version`, `issuer`, `endpoints` (signup, status, verify, MCP), `fields` (required/optional with types and purposes), `consent` (scopes, token TTL, verification requirements), `security` (supported algorithms, challenge requirement, rate limits), and `branding` (name, logo, privacy/terms URLs). See `protocol.md` for the full schema and a complete example document.

### Backend Handler API

The `onSignup` handler receives typed data and metadata:

```typescript
interface SignupData {
  name: { first: string; last: string; display?: string };
  email: string;
  phone?: string;
  username?: string;
  password: string; // The hashed password; site never sees plaintext
  dateOfBirth?: string; // ISO 8601
  country?: string; // ISO 3166-1 alpha-2
  locale?: string; // BCP 47
  custom: Record<string, string | number | boolean>;
}

interface SignupMetadata {
  agentId: string; // Identifies the agent framework
  consentProof: string; // JWT-like token proving user consent
  timestamp: string; // ISO 8601
  nonce: string; // For idempotency
  protocolVersion: string;
  clientIP?: string; // If available
}

interface SignupResult {
  userId: string;
  status: 'active' | 'pending_verification';
  verificationId?: string;
}
```

### Password Handling

Passwords require special treatment since they are security-critical:

1. **Generation:** The client generates the password locally based on the site's policy from the manifest.
2. **Transmission:** The password is transmitted over HTTPS to the site's endpoint. The site is expected to hash it (bcrypt, argon2, etc.) before storage, just like a normal signup.
3. **Vault storage:** The plaintext password is stored encrypted in the user's local vault, associated with the site URL. This functions like a built-in password manager.
4. **No protocol-level hashing:** The protocol transmits the password as the user would type it in a form. Sites handle hashing according to their own standards.

---

## Edge Cases Document

### EC-1: Custom Field the Protocol Does Not Cover
**Scenario:** A site requires "company size" as a dropdown with ranges ("1-10", "11-50", etc.).
**Handling:** The site defines it as a custom field with type `enum` and options. The agent presents the options to the user. The consent UI renders a dropdown or selection interface.
**If the type is too complex for MVP:** The site uses type `string` with a description explaining the expected values. The agent presents it as free text. v1.1 will support richer types.

### EC-2: Email Verification Fails or Times Out
**Scenario:** The verification email never arrives (spam filter, typo in email, mail server down).
**Handling:**
- After 30 minutes (configurable), the signup enters `expired` state.
- The agent reports this to the user: "Verification for ACME Corp timed out."
- The agent can offer to retry with a different email address (which requires a new consent flow).
- The site's `onSignupExpired` hook fires so the site can clean up the pending user record.

### EC-3: Site Requires a Password
**Scenario:** Most sites require a password.
**Handling:** The manifest declares `password.required: true` with a policy. The client generates a compliant password, stores it in the vault, and includes it in the signup payload. See Password Handling section above.

### EC-4: Multi-Factor Authentication Requirements
**Scenario:** A site requires MFA setup during signup (e.g., TOTP authenticator app).
**Handling (MVP):** Out of scope. If the site's `onSignup` handler needs MFA, it should return the user a setup link (email or in the response) that the user completes manually. The agent can surface this link.
**Handling (v1.1):** The protocol could support a `post_signup_actions` field in the response, with structured steps like "set up TOTP" that the agent can guide the user through.

### EC-5: GDPR and Privacy Considerations
**Scenario:** European users need to know their rights. Sites must handle data correctly.
**Handling:**
- The protocol requires sites to declare a `privacy_url` in the manifest. The consent UI always shows it.
- The consent token includes a `purpose` field (constrained enum: `account_creation`, `identity_verification`, `newsletter_signup`).
- The vault stores no data remotely. All PII is on the user's device.
- Sites receive only the fields the user explicitly consented to share (data minimization enforced at protocol level).
- The signup history in the vault serves as the user's personal record of data sharing (append-only consent log).
- **Data deletion:** The protocol includes a `DELETE /api/v1/agent-signup/signup/:id` endpoint for data deletion requests. The signup history helps users know which sites to contact.
- GDPR's "lawful basis" for the site is consent (the cryptographic consent token serves as proof, satisfying Article 7).
- **Right of access (Article 15):** The vault itself is the user's data store -- they already have a complete record.
- **Right to rectification (Article 16):** Users update their vault; future signups use corrected data. Past signups are the site's responsibility.
- **Sensitive PII exclusions:** The protocol explicitly excludes SSN, financial account numbers, and health data. These categories require purpose-built protocols.
- See `security.md` Section 7 for the full GDPR article-by-article mapping.

### EC-6: Agent Impersonation / Phishing
**Scenario:** A malicious agent tries to sign the user up for a phishing site, or misrepresents the target site.
**Handling:**
- The consent UI always shows the actual site URL (fetched from the manifest at the real domain), not the agent's description.
- The consent token is bound to a specific domain, preventing replay to a different site.
- v1.1 will add agent identity verification (cryptographic agent IDs).

### EC-7: Duplicate Signups
**Scenario:** User already has an account on the site; agent tries to sign up again.
**Handling:** The site returns `409 Conflict` with error code `already_registered`. The agent informs the user: "You already have an account on ACME Corp." The signup history can be checked locally to warn before attempting.

### EC-8: Site Changes Its Manifest
**Scenario:** A site adds new required fields after the agent last cached the manifest.
**Handling:** Agents should re-fetch the manifest before each signup (or respect `Cache-Control` headers). If the manifest has changed, the agent re-runs the consent flow with the updated fields.

### EC-9: Network Interruption Mid-Signup
**Scenario:** Network drops after consent but before the signup POST completes.
**Handling:** The signup payload includes a `nonce`. The agent retries the request with the same nonce. The site's SDK deduplicates based on the nonce (idempotency key). If the consent token expires before retry, the agent must re-request consent.

### EC-10: User Has Multiple Identities
**Scenario:** User wants to sign up for some sites with their work email and others with their personal email.
**Handling:** The vault supports multiple values per field type (e.g., two email addresses). During consent, the user can choose which value to use for each field. The default value is pre-selected but changeable.

### EC-11: Vault Encryption Key Lost
**Scenario:** User forgets their vault passphrase.
**Handling (MVP):** The vault cannot be recovered. The user must create a new vault and re-enter their data. This is a deliberate trade-off: no central server means no "forgot password" flow. The UI warns about this during setup.
**Handling (v1.1):** Recovery via encrypted backup export to a user-controlled location (e.g., cloud drive).

### EC-12: Site's Signup Endpoint Returns Unexpected Errors
**Scenario:** Site returns a 500, malformed JSON, or HTML error page.
**Handling:** The agent SDK maps all non-standard errors to a structured error response. The agent retries once for 5xx errors, then reports the failure to the user with the HTTP status code and any parseable message.

### EC-13: Concurrent Agents
**Scenario:** User has two agents (e.g., Claude and a custom agent) both trying to sign up for the same site simultaneously.
**Handling:** Each agent goes through its own consent flow. The nonce-based idempotency prevents duplicate accounts if both succeed. If the first signup succeeds and the second hits `409 already_registered`, the second agent reports accordingly.

### EC-14: Site Behind Authentication Wall
**Scenario:** The `.well-known/agent-signup.json` itself is behind authentication (site returns 401 for the manifest).
**Handling:** The agent treats this as "site does not support agent signup." The manifest must be publicly accessible. This is documented in the site integration guide.

### EC-15: Very Long Custom Field Values
**Scenario:** A custom field allows a "bio" with no max length, and the user enters 10,000 characters.
**Handling:** The protocol enforces that custom fields must declare validation rules. If `maxLength` is not set, the SDK applies a default maximum of 5,000 characters. The agent warns the user if their input is truncated.

---

## Risks and Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low site adoption -- developers do not see value in adding another signup channel | Medium | High | Focus on DX excellence; make integration < 15 minutes. Offer analytics on agent-signup conversion rates. Target early-adopter dev communities. |
| Abuse -- bots use the protocol for mass account creation | Medium | High | Rate limiting in the protocol spec. Consent tokens are cryptographically signed and time-limited. Sites can still require CAPTCHA as a fallback. v1.1 adds agent identity verification. |
| Privacy concerns -- users do not trust client-side vault | Low | Medium | Open-source the vault code. Third-party security audit before launch. Clear documentation of encryption approach. |
| Fragmentation -- multiple competing protocols emerge | Medium | Medium | Propose as an open standard early. Seek adoption from major agent frameworks (Anthropic MCP, OpenAI plugins). |
| Email verification creates friction | High | Low | This is intentional friction for trust. Document that sites can choose `verification: 'none'` if they prefer frictionless signups. |
| Manifest spoofing -- malicious site serves a misleading manifest | Low | High | Consent UI shows the real domain. HTTPS is required. v1.1 adds domain verification badges. |

### Assumptions

| Assumption | Validation |
|------------|------------|
| Users are willing to set up an identity vault | Validate with user research: survey 50+ AI agent users on willingness. |
| Site developers will adopt a new npm package for a new signup channel | Validate with developer interviews: pitch to 10 developers, measure intent-to-integrate. |
| AI agents can reliably follow structured protocols (discovery -> consent -> signup) | Validate with prototype: build a reference agent implementation and test against 5 sites. |
| Client-side-only PII storage is sufficient (no sync needed for MVP) | Validate with user testing: track how often users switch devices during the pilot. |
| Consent tokens can be made secure without a central authority | Validate with security review: engage a cryptographer to review the consent token design (asymmetric signing with user's key pair). |
| Email verification is the most common verification method | Validate by surveying 50 sites' current signup flows. |

---

## Technical Decisions (Resolved)

These decisions were resolved during architecture design. See `protocol.md` and `security.md` for full details.

1. **Consent token format:** JWS (JSON Web Signature, RFC 7515) with Ed25519 signatures. The user's client generates an Ed25519 keypair on vault setup. Consent tokens include a `data_hash` claim (SHA-256 of the canonical PII payload) that cryptographically binds the token to the exact data values, preventing agent tampering.
2. **Vault encryption:** AES-256-GCM with key derived from user passphrase via Argon2id (time=3, memory=64MB). Simplified two-key model: one AES key for vault encryption, one randomly generated Ed25519 keypair stored encrypted inside the vault. No HKDF hierarchy for MVP.
3. **Agent-to-consent-layer communication:** MCP tools (`request_consent`) bridge to the user-side SDK. The user-side SDK exposes a narrow `VaultAPI` interface that enforces field-level access control -- the vault never releases fields not listed in a valid consent token.
4. **Manifest caching strategy:** Discovery documents served with `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` and `ETag`. Agents use `If-None-Match`.
5. **Replay prevention:** Challenge-response protocol. Site issues a single-use nonce (5-min TTL). The nonce is embedded in the consent token. Site maintains a nonce ledger (pruned after expiry). No central server needed.
6. **Bot abuse prevention:** 5-layer defense: agent key registration, per-key/user/IP rate limiting, hashcash proof-of-work, WebAuthn user-presence attestation, agent reputation scoring.

---

## Release Plan

| Phase | Content | Timeline |
|-------|---------|----------|
| Phase 0 | Product spec (this document) + architecture doc | Week 0-2 |
| Phase 1 | Protocol specification (formal spec, JSON schemas) | Week 2-4 |
| Phase 2 | Reference implementations: site SDK, client library, agent tools | Week 4-10 |
| Phase 3 | Test suite + documentation site | Week 10-12 |
| Phase 4 | Public beta: 3 partner sites, 2 agent frameworks | Week 12-16 |
| Phase 5 | v1.0 launch | Week 16-20 |

---

## Open Questions

1. **Should the vault support syncing across devices?** Current answer: No for MVP. Encrypted export/import is in v1.1 scope. Since Ed25519 keys are deterministically derived from the passphrase via HKDF, the same passphrase on a new device can reconstruct the keypair -- but the PII data itself requires an explicit export/import step. This is the #1 usability risk. Revisit after user testing.
2. **Should the protocol support "Sign In with Agent" (login), not just signup?** Current answer: Out of scope. But the protocol is designed to be extensible -- the `purpose` field in consent tokens can be extended to `"authentication"` in a future version.
3. **Should there be a directory of agent-signup-enabled sites?** Current answer: Not in the protocol (it is decentralized). But a community-maintained registry would be valuable and is tracked for post-v1.0.
4. ~~**Should the consent token be verifiable without the user's public key?**~~ **Resolved:** The consent token is a JWS with the user's public key embedded in the header (`jwk` claim). Tokens are self-contained -- sites do not need to fetch the key from anywhere.
5. ~~**How does the password reach the site securely beyond HTTPS?**~~ **Resolved:** HTTPS (TLS 1.3 mandatory) is sufficient. The password is transmitted like a normal form submission. The `data_hash` in the consent token ensures the password value matches what the user consented to. No additional encryption layer is needed.
6. ~~**Should the protocol mandate HTTPS for the signup endpoint?**~~ **Resolved:** Yes. TLS 1.3 is mandatory for all endpoints. The SDK allows HTTP for `localhost` only (development mode).
7. **Should agents have their own keypairs?** The security model includes an `sub` claim for agent identity in consent tokens. For MVP, agents are identified by a name/version string. Agent key registration and co-signing is tracked for v1.1 (Phase 2 of the security implementation checklist).

---

## Appendix: Competitive Landscape

| Solution | How it differs from Agent Signup |
|----------|----------------------------------|
| OAuth / "Sign in with Google" | Handles login, not signup. Requires the user to have an account with the identity provider. Centralized. |
| Autofill (browser) | Fills forms but is not agent-driven. No consent protocol. No structured API. Fragile with complex forms. |
| Password managers (1Password, etc.) | Store credentials but do not broker signups. No discovery protocol. Not agent-aware. |
| Apple Sign In | Identity provider model. Centralized. Does not support custom fields. |
| Decentralized Identity (DID) | Aligned philosophy but heavier protocol. No agent-specific tooling. Not yet mainstream. |

Agent Signup occupies a unique position: it is agent-native, privacy-preserving (client-side PII), and designed for the signup use case specifically (not login, not form-filling).
