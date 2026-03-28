# Agent Journey: Every Scenario

**Version:** 1.0
**Date:** 2026-03-28

How the agent handles every combination of site readiness and user readiness. The goal: signing up should feel effortless regardless of whether the site has installed the SDK.

**Companion documents:**
- `prd.md` -- Product requirements
- `protocol.md` -- Wire protocol
- `security.md` -- Security design
- `sdk-design.md` -- SDK architecture
- `interaction-design.md` -- Voice, visual design, and UX copy guidelines

---

## Table of Contents

1. [The Decision Tree](#1-the-decision-tree)
2. [Quadrant 1: SDK + Vault (Happy Path)](#2-quadrant-1-sdk--vault)
3. [Quadrant 2: SDK + No Vault (Just-in-Time Onboarding)](#3-quadrant-2-sdk--no-vault)
4. [Quadrant 3: No SDK + Vault (Smart Concierge)](#4-quadrant-3-no-sdk--vault)
5. [Quadrant 4: No SDK + No Vault (Cold Start)](#5-quadrant-4-no-sdk--no-vault)
6. [Edge Cases](#6-edge-cases)
7. [Agent Decision Tree (Implementation)](#7-agent-decision-tree-implementation)
8. [UX Copy Guidelines](#8-ux-copy-guidelines)
9. [Implications for SDK Design](#9-implications-for-sdk-design)

---

## 1. The Decision Tree

When a user says "sign me up for X", the agent runs this:

```
User: "Sign me up for {site}"
          |
          v
    [1] Check /.well-known/agent-signup.json
          |
    +-----+-----+
    |             |
  Found        Not found
    |             |
    v             v
  [2] Check    [3] Find signup
  for vault    page URL
    |             |
  +-+-+         +-+-+
  |   |         |   |
 Yes  No       Yes  No
  |   |         |   |
  v   v         v   v
 Q1  Q2        Q3/4  "Can't find
                      signup page"
```

| Quadrant | Site | User | Experience |
|----------|------|------|------------|
| **Q1** | Has SDK | Has vault | Fully automated. 0 user actions. |
| **Q2** | Has SDK | No vault | Just-in-time vault creation embedded in signup flow. ~30 seconds. |
| **Q3** | No SDK | Has vault | Agent opens signup page + serves data field-by-field. ~1 minute. |
| **Q4** | No SDK | No vault | Agent opens signup page + collects data + creates vault. ~2 minutes. |

The principle: **every quadrant ends with the user signed up**. The only difference is how much the agent can automate.

---

## 2. Quadrant 1: SDK + Vault

The happy path. Both sides are ready.

### What the user sees

```
User:  "Sign me up for acme.com"
Agent: "Done. Check alex@example.com for their verification email."

  [a few minutes pass, user clicks email link]

Agent: "Your ACME account is all set."
```

That's it. Under the hood: discover -> challenge -> consent (auto) -> submit -> poll. The user sees two sentences.

If interactive consent is needed (no auto-approve rule matches):

```
User:  "Sign me up for acme.com"

  +--------------------------------------------------+
  |  Sign up for ACME?                                |
  |  acme.com                                         |
  |                                                   |
  |  They'll get:                                     |
  |    Alex Johnson                                   |
  |    alex@example.com                               |
  |                                                   |
  |  [Not now]                    [Sign me up]        |
  +--------------------------------------------------+

Agent: "Done. Check your email."
```

### User actions required: 0-1

- 0 if auto-approve rule matches
- 1 if consent prompt shown (tap "Sign me up")

### Time: ~5 seconds (plus email verification)

---

## 3. Quadrant 2: SDK + No Vault

The critical onboarding moment. The vault setup is invisible -- it happens as part of the signup.

### What the user sees

```
User:  "Sign me up for acme.com"

Agent: "I can handle that. What name should I use?"
User:  "Alex Johnson"

Agent: "And your email?"
User:  "alex@example.com"

Agent: "Set a password to keep your details safe.
        This stays on your device."
User:  ********

Agent: "Signing you up for ACME...
        Done. Check alex@example.com for their verification email.

        I saved your details for next time."
```

No mention of vaults, encryption, or file paths. The user just answered three questions and got signed up. They'll notice future signups are faster and connect the dots.

### Key design decisions

- **No separate setup step.** Their saved details materialize as a side effect of the first signup.
- **Implicit consent for the first signup.** The user just typed their name and email specifically for this signup. Asking "do you consent to share your name and email?" immediately after would be patronizing. The consent prompt appears on the SECOND signup, when the agent draws from stored data.
- **The password is the only friction.** And it's framed as protection ("keep your details safe"), not as a system requirement.
- **Optional fields are skipped.** The agent only asks for what's needed right now. Extra fields (phone, address) are collected later when a site actually needs them.
- **No file paths.** Power users will find `~/.agent-signup/vault.json` if they look. Most won't look.

### What if the user declines?

```
Agent: "No problem. Want me to open ACME's signup page for you?"
```

Falls through to Quadrant 3 behavior (smart concierge).

---

## 4. Quadrant 3: No SDK + Vault

The "smart concierge" pattern. The site doesn't participate in the protocol, but the agent makes signup as painless as possible.

### What the user sees

The agent adapts to whatever tools it has:

**With browser access:**

```
User:  "Sign me up for oldsite.com"

Agent: "Opening their signup page."
       [Opens https://oldsite.com/register]

Agent: "I can fill in the form for you. Sound good?"
User:  "Yeah"

Agent: [Fills name, email, generates password]
       "Filled in. Take a look and hit submit when you're ready.
        I saved the password for you."
```

**Without browser (CLI, chat):**

```
User:  "Sign me up for oldsite.com"

Agent: "Here's their signup page and your details:

        oldsite.com/register

        Alex Johnson
        alex@example.com
        Password: [copy]

        I saved the password for you."
```

**No signup page found:**

```
User:  "Sign me up for obscuresite.com"

Agent: "I can't find their signup page. Do you have a link?"
User:  "obscuresite.com/join"
Agent: "Got it. Opening that now."
       [Continues with the flow above]
```

Notice what's absent: no mention that the site "doesn't support automated signup." The user doesn't care about the protocol. They care about getting signed up. The agent just does what it can and doesn't explain what it can't.

### Data Serving Modes (technical reference)

**Mode A: Browser available (e.g., Claude with browser tools, desktop agent)**

Agent opens the page, reads the form, fills fields, generates and saves a password. User reviews and submits.

**Mode B: No browser (CLI agent, API-only)**

```
Agent: "Here's your info for oldsite.com/register:

        Name:     Alex Johnson
        Email:    alex@example.com
        Password: [generated, copied to clipboard]

        I've saved the password to your vault.
        Open this link to sign up:
        https://oldsite.com/register"
```

**Mode C: Chat interface (e.g., Slack bot, web chat)**

```
Agent: "Here's everything you need for oldsite.com:

        Signup page: https://oldsite.com/register

        Your details:
        - Name: Alex Johnson
        - Email: alex@example.com
        - Password: ******* (tap to reveal/copy)

        I've saved the password to your vault for later."
```

### Signup Page Discovery

When a site has no SDK, the agent needs to find the signup page. Strategy:

```typescript
// @agent-signup/agent - signup page discovery for non-participating sites

const COMMON_SIGNUP_PATHS = [
  "/signup",
  "/register",
  "/join",
  "/create-account",
  "/sign-up",
  "/get-started",
  "/start",
];

async function findSignupPage(siteUrl: string): Promise<string | null> {
  // 1. Check common paths (HEAD requests, look for 200)
  for (const path of COMMON_SIGNUP_PATHS) {
    const res = await fetch(`${siteUrl}${path}`, { method: "HEAD" });
    if (res.ok) return `${siteUrl}${path}`;
  }

  // 2. Fetch homepage, look for signup links in HTML
  const html = await fetch(siteUrl).then(r => r.text());
  const signupLink = extractSignupLink(html);
  if (signupLink) return signupLink;

  // 3. Give up
  return null;
}
```

### Password generation for non-SDK sites

Even without the SDK, the agent can generate and store passwords:

```
Agent generates password -> stores in vault under site URL ->
presents to user (clipboard or form fill)
```

The vault becomes a lightweight password manager as a side effect.

---

## 5. Quadrant 4: No SDK + No Vault

Cold start. Neither side is ready. The agent bootstraps everything.

### Flow

```
User: "Sign me up for oldsite.com"

Agent:
  1. GET /.well-known/agent-signup.json -> 404
  2. Check vault -> not found
  3. Search for signup page -> found https://oldsite.com/register

Agent: "I'll help you sign up for oldsite.com. Since this is your
        first time, I'll also set up your identity vault so future
        signups are faster.

        What's your name?"

User: "Alex Johnson"

Agent: "Email?"

User: "alex@example.com"

Agent: "Set a passphrase to protect your vault:"

User: ********

Agent:
  4. Create vault
  5. Generate password for oldsite.com, store in vault
  6. Open signup page / present data

Agent: "Vault created. Here's everything for oldsite.com:

        Signup page: https://oldsite.com/register

        Your details:
        - Name: Alex Johnson
        - Email: alex@example.com
        - Password: [copied to clipboard]

        Next time you sign up somewhere that supports Agent Signup,
        I'll handle it automatically."
```

### Key insight

Even in the worst case (no SDK, no vault), the user gets:
1. Their vault created
2. A password generated and stored
3. The signup page found and opened
4. Their data presented ready to use

The only thing the agent can't do is submit the form. And even that is possible with browser automation.

---

## 6. Edge Cases

### 6.1 Vault is locked

```
Agent: "Your vault is locked. Passphrase?"
User: ********
Agent: [Unlocks, continues flow]
```

If passphrase is wrong (3 attempts):
```
Agent: "That passphrase doesn't match. Try again? (2 attempts left)"
```

If forgotten:
```
Agent: "I can't unlock the vault without the passphrase.
        Options:
        1. Try again later
        2. Create a new vault (old data is lost)
        3. If you have a backup of vault.json, I can try that"
```

### 6.2 Vault missing required fields

```
Agent: "acme.com needs your phone number, which isn't in your
        vault yet. What's your phone number?"
User: "+15550123"
Agent: [Adds to vault, continues signup]
Agent: "Added to your vault for future use."
```

### 6.3 Site has custom fields

```
Agent: "acme.com needs a couple extra things:
        - Company Name (required)
        - Referral Code (optional, press enter to skip)"
User: "Momentum Labs" [enter]
Agent: [Stores company name in vault under custom fields]
```

Custom fields from a site are stored in the vault under a `custom` namespace so they're available if another site asks for the same thing.

### 6.4 Duplicate signup (409 Conflict)

```
Agent: "Looks like you already have an account on acme.com
        (registered with alex@example.com).

        Want me to help you log in instead?"
```

### 6.5 Email verification timeout

```
[30 minutes after signup]
Agent: "The verification email for acme.com expired.
        Want me to:
        1. Try signing up again (new verification email)
        2. Skip for now"
```

### 6.6 Rate limited (429)

```
Agent: "acme.com is limiting signup requests right now.
        I'll try again in 5 minutes."
[Automatically retries after Retry-After header]
```

### 6.7 Site requires CAPTCHA

```
Agent: "acme.com requires a CAPTCHA to sign up. I can't solve
        that, but I've opened the page and pre-filled your details.
        Just complete the CAPTCHA and submit."
```

### 6.8 Multiple email addresses in vault

```
Agent: "Which email for acme.com?
        1. alex@example.com (default)
        2. alex.work@company.com"
User: "2"
```

### 6.9 Site is down or unreachable

```
Agent: "I can't reach acme.com right now. Want me to try again
        later, or save a reminder?"
```

### 6.10 Agent can't find signup page (Q3/Q4)

```
Agent: "I couldn't find a signup page on oldsite.com.
        Do you have a direct link, or should I search
        for 'oldsite.com signup'?"
```

---

## 7. Agent Decision Tree (Implementation)

The complete decision tree as pseudocode. This is what `@agent-signup/agent` implements.

```typescript
async function handleSignupRequest(siteUrl: string, agent: AgentContext) {
  // Step 1: Check site support
  const manifest = await agent.discover(siteUrl);
  const hasSDK = manifest !== null;

  // Step 2: Check vault
  const vault = await agent.getVault();
  const hasVault = vault !== null && vault.isUnlocked();

  // Step 3: Route to quadrant
  if (hasSDK && hasVault) {
    return await quadrant1_happyPath(siteUrl, manifest, vault, agent);
  }
  if (hasSDK && !hasVault) {
    return await quadrant2_justInTimeOnboarding(siteUrl, manifest, agent);
  }
  if (!hasSDK && hasVault) {
    return await quadrant3_smartConcierge(siteUrl, vault, agent);
  }
  return await quadrant4_coldStart(siteUrl, agent);
}

// Q1: Fully automated
async function quadrant1_happyPath(siteUrl, manifest, vault, agent) {
  // Check for missing required fields
  const missing = findMissingFields(manifest.fields.required, vault);
  if (missing.length > 0) {
    const values = await agent.askUser(
      `I need a few more details: ${missing.map(f => f.label).join(", ")}`
    );
    await vault.addFields(values);
  }

  // Challenge
  const identity = vault.getIdentity();
  const challenge = await agent.requestChallenge(siteUrl, identity.publicKey);

  // Consent
  const consent = await vault.requestConsent({
    site: manifest.branding,
    requestedFields: manifest.fields,
    nonce: challenge.nonce,
  });

  if (!consent.approved) {
    return { success: false, reason: "User denied consent" };
  }

  // Submit
  const result = await agent.submitSignup(siteUrl, {
    consentToken: consent.token,
    data: consent.fields,
    agent: agent.identity,
  });

  // Handle verification
  if (result.status === "pending_verification") {
    agent.tell(`Check ${result.verification.sent_to} to verify.`);
    const final = await agent.waitForVerification(siteUrl, result.signup_id);
    return { success: final.status === "active", signupId: result.signup_id };
  }

  return { success: true, signupId: result.signup_id };
}

// Q2: SDK site, no vault yet
async function quadrant2_justInTimeOnboarding(siteUrl, manifest, agent) {
  agent.tell(
    `${manifest.branding.name} supports instant signup. ` +
    `I just need a few details to set up your identity vault.`
  );

  // Collect required fields
  const fields = await agent.collectFields(manifest.fields.required);

  // Create vault
  const passphrase = await agent.askSecure("Set a passphrase to protect your vault:");
  const vault = await Vault.create({ passphrase, storage: agent.defaultStorage });
  await vault.addFields(fields);

  agent.tell("Vault created. Signing you up now...");

  // Continue with Q1 flow (consent is implicit for first signup)
  return await quadrant1_happyPath(siteUrl, manifest, vault, agent);
}

// Q3: No SDK, has vault
async function quadrant3_smartConcierge(siteUrl, vault, agent) {
  // Find signup page
  const signupUrl = await findSignupPage(siteUrl);
  if (!signupUrl) {
    const url = await agent.askUser(
      `I couldn't find a signup page on ${siteUrl}. Do you have a link?`
    );
    if (!url) return { success: false, reason: "No signup page found" };
  }

  // Generate password
  const password = PasswordGenerator.generate({ minLength: 16 });
  await vault.setPassword(siteUrl, password);

  // Get user's fields
  const fields = {
    name: await vault.getField("name.first") + " " + await vault.getField("name.last"),
    email: await vault.getField("email"),
    password: password,
  };

  // Serve data based on agent capabilities
  if (agent.hasBrowser()) {
    await agent.openUrl(signupUrl);
    agent.tell("Opened the signup page. Want me to fill in the form?");
    const fill = await agent.askYesNo();
    if (fill) {
      await agent.fillForm(signupUrl, fields);
      agent.tell("Form filled. Review and hit Submit when ready.");
    } else {
      agent.tell(formatFieldsForCopy(fields));
    }
  } else {
    agent.tell(
      `Signup page: ${signupUrl}\n\n` +
      `Your details:\n` +
      formatFieldsForCopy(fields) +
      `\nPassword saved to your vault.`
    );
  }

  // Log to history (even manual signups)
  await vault.logSignup({
    site: siteUrl,
    fields: Object.keys(fields),
    method: "manual",
    status: "user_directed",
  });

  return { success: true, method: "manual" };
}

// Q4: No SDK, no vault
async function quadrant4_coldStart(siteUrl, agent) {
  const signupUrl = await findSignupPage(siteUrl);

  agent.tell(
    `I'll help you sign up for ${siteUrl}. Since this is your ` +
    `first time, I'll also create your identity vault.`
  );

  // Collect basic fields
  const name = await agent.askUser("What's your name?");
  const email = await agent.askUser("Email?");
  const passphrase = await agent.askSecure("Set a passphrase for your vault:");

  // Create vault
  const vault = await Vault.create({ passphrase, storage: agent.defaultStorage });
  await vault.setField("name", name);
  await vault.setField("email", email);

  agent.tell("Vault created.");

  // Continue with Q3 flow
  return await quadrant3_smartConcierge(siteUrl, vault, agent);
}
```

---

## 8. UX Copy and Interaction Design

See `interaction-design.md` for the complete voice guide, visual design principles, and before/after examples for every touchpoint.

### Key phrases by quadrant (updated)

| Quadrant | What the user hears |
|----------|-------------|
| Q1 | "Done. Check your email." |
| Q2 | "I can handle that. What name should I use?" |
| Q3 | "Opening their signup page." |
| Q4 | "I'll help you sign up. What name should I use?" |

### The rule

If you wouldn't say it to a friend, rewrite it.

---

## 9. Implications for SDK Design

This journey map reveals features needed in `@agent-signup/agent` that aren't in the current SDK design:

### 9.1 Signup page discovery (new)

```typescript
// @agent-signup/agent/discovery

// Find a signup page on a non-participating site
export function findSignupPage(siteUrl: string): Promise<string | null>;
```

Checks common paths (`/signup`, `/register`, `/join`, etc.), then parses the homepage for signup links. Used in Q3 and Q4.

### 9.2 Just-in-time vault creation (new flow in client)

```typescript
// @agent-signup/client

// Create a vault and immediately use it for a signup
// Combines Vault.create() + setFields() + requestConsent() in one flow
export async function createVaultAndSignup(options: {
  passphrase: string;
  fields: Record<string, string>;
  manifest: AgentSignupDiscovery;
  nonce: string;
  storage: "file" | "localstorage";
}): Promise<{ vault: Vault; consentToken: string; signupFields: Record<string, SensitiveString> }>;
```

### 9.3 Password generation for non-SDK sites (new)

The vault already stores passwords per-site. But the agent needs to generate passwords even for non-participating sites (no manifest, no password policy). Default policy:

```typescript
const DEFAULT_PASSWORD_POLICY = {
  minLength: 20,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};
```

### 9.4 Manual signup history logging (new)

Even when the agent can't automate the signup (Q3, Q4), it should log to the vault's history:

```typescript
interface ManualSignupEntry {
  site: string;
  signupUrl: string;
  fields: string[];          // Which fields were provided
  method: "manual";          // vs "automated" for SDK signups
  status: "user_directed";   // Agent provided data, user submitted
  timestamp: string;
}
```

### 9.5 Agent capability detection (new)

The agent needs to know what it can do:

```typescript
interface AgentCapabilities {
  hasBrowser: boolean;      // Can open URLs and interact with pages
  hasClipboard: boolean;    // Can copy to clipboard
  hasFileSystem: boolean;   // Can write vault.json to disk
  isInteractive: boolean;   // Can prompt the user for input
}
```

This determines which data-serving mode to use in Q3/Q4.

### 9.6 Custom field memory (new)

When a non-standard custom field is collected (e.g., "Company Name"), store it in the vault for reuse:

```typescript
// Vault stores custom fields under a namespace
await vault.setField("custom.company_name", "Momentum Labs");

// Next time any site asks for "company_name", the vault has it
const company = await vault.getField("custom.company_name");
```

---

## Appendix: The Adoption Flywheel

```
User creates vault (Q2 or Q4)
          |
          v
User signs up for more sites (Q1 or Q3)
          |
          v
Vault accumulates data + history
          |
          v
Agent gets faster (pre-authorized scopes, cached fields)
          |
          v
User tells friends ("my agent signs me up for stuff")
          |
          v
More users with vaults
          |
          v
Sites see agent-signup traffic in logs
          |
          v
Sites install SDK to capture the channel
          |
          v
More Q1 experiences, less Q3
          |
          v
Protocol becomes standard
```

The smart concierge (Q3) is the bridge. It delivers value even without site adoption, while creating demand for the SDK on the site side.
