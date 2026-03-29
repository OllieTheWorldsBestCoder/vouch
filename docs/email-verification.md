# Email Verification: How Vouch Handles It

**Version:** 1.0
**Date:** 2026-03-29

The hardest UX problem in agent-driven signup: email verification breaks the flow. The user has to leave the conversation, open their inbox, find the email, click a link. Vouch solves this with a two-tier approach.

---

## Architecture

```
Tier 1: Vouch Relay (default, zero setup)
  Agent -> Signup with relay address -> Site sends email to relay
  -> Relay extracts code -> Auto-verifies -> Done

Tier 2: Direct Email (upgrade, if agent has email access)
  Agent -> Signup with real address -> Site sends email
  -> Agent reads inbox via MCP -> Extracts code -> Verifies -> Done
```

Both tiers are invisible to the user. They say "sign me up" and it's done.

---

## Tier 1: Vouch Verification Relay

### How it works

1. User's real email is `alex@example.com` (stored in vault)
2. During signup, the agent generates a relay address:
   `v-<short-id>@verify.vouch.dev`
3. The agent submits the signup with the **relay address** as the email
4. The site sends its verification email to the relay
5. Vouch's relay service receives the email
6. The relay extracts the verification code or magic link:
   - Scans the email body for 6-digit codes (regex)
   - Scans for magic links containing "verify", "confirm", "activate"
7. The relay submits the verification code to the site's verify endpoint
   (or visits the magic link)
8. Once verified, the relay calls the site's API to update the email
   from the relay address to the user's real address
9. The relay deletes the email (never stored)

### No email swap needed

The signup always uses the user's **real email**. The relay doesn't replace it -- instead, the site SDK automatically webhooks the verification code to the relay when it generates one.

```
1. Agent submits signup with alex@example.com (real email)
2. Site creates account with alex@example.com
3. Site generates verification code "847293"
4. Site sends verification email to alex@example.com (normal)
5. Site ALSO posts the code to the Vouch relay webhook
6. Relay receives the code, submits it to the site's verify endpoint
7. Account verified. No email swap. alex@example.com from the start.
```

The relay is not a mail server -- it's a **webhook receiver**. The site SDK posts the code to `https://verify.vouch.dev/webhook/<signup_id>` and the relay submits it back to the site's verify endpoint. This is simpler, requires no mail infrastructure, and never needs an email address change.

The site SDK handles step 5 automatically -- developers don't need to configure anything beyond `verification: { method: "email" }`.

### Relay service design

```
verify.vouch.dev
  |
  |-- POST /webhook/<signup_id>  (receives code from site SDK)
  |-- GET  /status/<signup_id>   (agent polls for completion)
  |-- Calls site's verify endpoint with the received code
  |-- Notifies agent that verification is complete
  |-- Stateless: signup_id -> { site_verify_url, code, status }
```

**Infrastructure**: A single HTTP endpoint. No mail server needed. Can be a Vercel function, Cloudflare Worker, or any serverless platform. The relay is stateless -- each signup ID maps to a pending verification.

**How the site SDK integrates**: When the site generates a verification code, the SDK automatically POSTs it to `https://verify.vouch.dev/webhook/<signup_id>`. This happens inside `createVouchHandler` -- the developer doesn't need to configure it.

```typescript
// Inside @vouch/site handler (automatic)
const code = generateVerificationCode();
await sendVerificationEmail(userEmail, code);

// Also notify the relay so the agent doesn't have to wait for the user
if (signupRequest.agent) {
  fetch(`https://verify.vouch.dev/webhook/${signupId}`, {
    method: "POST",
    body: JSON.stringify({ code, verify_endpoint: `${siteUrl}/api/vouch/verify` }),
  }).catch(() => {}); // fire-and-forget, non-blocking
}
```

**TTL**: Webhook entries expire after 30 minutes. The relay auto-verifies within seconds of receiving the code.

**Privacy**: The relay sees only the verification code and the site's verify URL. It never sees the user's email, name, or any PII. The code is consumed immediately and discarded.

### What the user sees

```
User:  "Sign me up for acme.com"
Agent: "Signing you up for ACME..."
       [submits signup with relay address]
       [relay receives verification email]
       [relay extracts code, submits it]
       [relay updates email to real address]
       "Done. Your ACME account is active (alex@example.com)."
```

Total time: ~10-15 seconds. Zero user actions.

---

## Tier 2: Direct Email Access

### How it works

If the agent has email MCP tools (Gmail, Outlook, etc.), it can skip the relay entirely:

1. Agent submits signup with the user's **real email**
2. Site sends verification email to the real address
3. Agent watches the inbox for the verification email:
   - Searches for emails from the site's domain
   - Filters by subject containing "verify", "confirm", "activate"
   - Looks for emails received in the last 5 minutes
4. Agent extracts the verification code or magic link
5. Agent submits the code via `vouch_verify`

### What the user sees

```
User:  "Sign me up for acme.com"
Agent: "Signing you up for ACME...
        Checking your email for the verification..."
       [reads inbox, finds email, extracts code]
       "Verified. Your ACME account is active."
```

Total time: ~5-10 seconds (depends on email delivery speed).

### MCP tool requirements

The agent needs one of:
- Gmail MCP: `gmail_search_messages`, `gmail_read_message`
- Outlook MCP: equivalent search/read tools
- Generic email MCP with search capability

### Fallback chain

```
1. Does the agent have email MCP tools?
   Yes -> Use Tier 2 (direct email)
   No  -> Continue to step 2

2. Is Vouch relay available?
   Yes -> Use Tier 1 (relay)
   No  -> Continue to step 3

3. Fallback: ask the user
   Agent: "Check your email for a verification code from ACME."
   User:  "847293"
   Agent: [submits code]
```

---

## Protocol Changes

### New manifest field

```json
{
  "verification": {
    "method": "email",
    "supports_email_update": true,
    "update_endpoint": "/api/vouch/update-email"
  }
}
```

`supports_email_update`: Indicates the site supports changing the account email after verification. This is required for the relay approach.

### New endpoint: POST /api/vouch/update-email

```typescript
interface UpdateEmailRequest {
  signup_id: string;
  consent_token: string;  // Must match the original signup's consent
  new_email: string;      // The user's real email
}

interface UpdateEmailResponse {
  updated: boolean;
  email: string;  // Masked: a***@example.com
}
```

The consent token ensures only the original signer can change the email. The site verifies the token signature and checks that the signup ID matches.

### New MCP tool: vouch_update_email

```json
{
  "name": "vouch_update_email",
  "description": "Update the account email from a relay address to the user's real email after verification.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_url": { "type": "string" },
      "signup_id": { "type": "string" },
      "new_email": { "type": "string" }
    },
    "required": ["site_url", "signup_id", "new_email"]
  }
}
```

---

## Agent Decision Logic

```typescript
async function handleVerification(
  signupResult: SignupResponse,
  siteUrl: string,
  userEmail: string,
  agent: AgentContext,
): Promise<void> {
  if (signupResult.status !== "pending_verification") return;

  // Tier 2: Direct email (if agent has email tools)
  if (agent.hasEmailAccess()) {
    const code = await agent.watchForVerificationEmail({
      from: new URL(siteUrl).hostname,
      maxWaitMs: 60_000,
    });
    if (code) {
      await agent.submitVerification(siteUrl, signupResult.signup_id, code);
      return;
    }
  }

  // Tier 1: Relay (if available and site supports email update)
  if (agent.hasRelay() && manifest.verification?.supports_email_update) {
    // The signup was already submitted with a relay address
    // The relay will auto-verify and notify us
    await agent.waitForRelayVerification(signupResult.signup_id);
    // Update email to real address
    await agent.updateEmail(siteUrl, signupResult.signup_id, userEmail);
    return;
  }

  // Tier 3: Ask the user
  const code = await agent.ask(
    "Check your email for a verification code from " +
    manifest.branding.name
  );
  await agent.submitVerification(siteUrl, signupResult.signup_id, code);
}
```

---

## Security Considerations

### Relay privacy
- The relay never stores emails
- The relay never knows the user's real email (only the agent does)
- Relay addresses are single-use and expire in 30 minutes
- The relay cannot create accounts -- it only verifies

### Email update security
- The `update-email` endpoint requires the original consent token
- Only the holder of the Ed25519 private key can update the email
- Sites should send a notification to the NEW email confirming the change
- Rate limit: 1 email update per signup

### Abuse prevention
- Relay addresses rate-limited per vault (max 10 active relays)
- Relay rejects emails > 1MB (verification emails are small)
- Relay rejects emails not matching expected sender domains
- Relay addresses are cryptographically bound to the signup ID
