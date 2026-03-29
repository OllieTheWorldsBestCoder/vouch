# Email Verification: How Vouch Handles It

**Version:** 1.1
**Date:** 2026-03-29

The hardest UX problem in agent-driven signup: email verification breaks the flow. Vouch solves this with a tiered approach based on what the site supports.

---

## Architecture

```
Tier 1: Site has Vouch SDK (default, fully automated)
  Agent submits signup with real email -> Site SDK generates code
  -> SDK auto-posts code to Vouch relay -> Relay auto-verifies
  -> Done in seconds. User sees nothing.

Tier 2: Site has no SDK, agent has email access
  Agent submits signup -> Site sends verification email
  -> Agent reads inbox via MCP -> Extracts code -> Verifies

Tier 3: Site has no SDK, no email access
  Agent submits signup -> Site sends verification email
  -> Agent asks user for the code -> User types it in
```

---

## Tier 1: Site Has Vouch SDK (Best Case)

This is the default for any Vouch-enabled site. The SDK handles everything automatically.

### How it works

1. Agent submits signup with `alex@example.com` (real email)
2. Site SDK creates the account and generates a verification code
3. Site sends the verification email to `alex@example.com` (normal)
4. **Simultaneously**, the SDK posts the verification code to the Vouch relay:
   `POST https://verify.vouch.dev/webhook/<signup_id>`
5. The relay receives the code and submits it back to the site's verify endpoint
6. Account verified. The user gets the welcome email for their records but didn't need to act on it.

### No email swap, no relay address

The signup always uses the user's **real email**. The relay isn't a mail server -- it's a webhook receiver. The site SDK sends the code directly to the relay as an HTTP POST. No temporary email addresses, no mail parsing, no MX records.

### What happens inside the site SDK

```typescript
// Inside @vouch/site handler -- this is automatic
// Developers just set verification: { method: "email" }

const code = generateVerificationCode();

// 1. Send normal verification email to the user
await config.verification.sendEmail(userEmail, code, magicLink);

// 2. Also post the code to the Vouch relay (fire-and-forget)
//    This lets the agent skip waiting for the user to click
if (signupRequest.agent) {
  fetch(`https://verify.vouch.dev/webhook/${signupId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      verify_endpoint: `${config.site.url}/api/vouch/verify`,
      signup_id: signupId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
  }).catch(() => {}); // non-blocking, best-effort
}
```

### What the user sees

```
User:  "Sign me up for acme.com"
Agent: "Done. Your ACME account is active."
```

That's it. The verification happened in the background in ~2-5 seconds. The user also gets the verification email in their inbox, but it's already been used.

### Relay service design

```
verify.vouch.dev (simple HTTP service)
  |
  POST /webhook/<signup_id>   -- receives code from site SDK
  GET  /status/<signup_id>    -- agent polls for completion
  |
  On receiving a code:
    1. Submit code to site's verify endpoint
    2. Update status to "verified"
    3. Expire after 30 minutes
```

**Infrastructure**: A single serverless function (Vercel, Cloudflare Worker, etc.). No mail server. Stateless with a simple KV store (Upstash Redis or similar) for tracking pending verifications.

**Privacy**: The relay sees only the verification code and the site's verify URL. It never sees the user's email, name, or any PII.

**Fallback**: If the relay is down, the agent falls through to Tier 2 or 3. The verification email still reaches the user normally.

---

## Tier 2: No SDK, Agent Has Email Access

For sites that haven't installed Vouch, but the agent has email MCP tools (Gmail, Outlook, etc.).

### How it works

1. Agent submits signup (via form-fill or manual guidance)
2. Site sends verification email to `alex@example.com`
3. Agent watches the inbox using email MCP tools:
   - Searches for emails from the site's domain
   - Filters by subject containing "verify", "confirm", "activate"
   - Looks for emails received in the last 5 minutes
4. Agent extracts the verification code or magic link:
   - Regex scan for 6-digit codes
   - URL scan for verification links
5. Agent submits the code or visits the link

### MCP tool requirements

The agent needs email search + read capability:
- Gmail MCP: `gmail_search_messages`, `gmail_read_message`
- Outlook MCP: equivalent search/read
- Any email MCP with: search by sender/subject/date + read body

### What the user sees

```
User:  "Sign me up for oldsite.com"
Agent: [fills form, submits]
       "Checking your email for the verification..."
       [reads inbox, finds email, extracts code]
       "Verified. Your account is active."
```

Time: ~10-30 seconds (depends on email delivery speed).

---

## Tier 3: No SDK, No Email Access

The fallback. The agent has done everything it can -- now it needs the user.

### How it works

1. Agent submits signup (via form-fill or manual guidance)
2. Site sends verification email
3. Agent tells the user to check their email

### What the user sees

```
User:  "Sign me up for oldsite.com"
Agent: [fills form, submits]
       "Check your email for a code from OldSite."
User:  "847293"
Agent: [submits code]
       "Verified. You're all set."
```

Or if it's a magic link (not a code):

```
Agent: "Check your email from OldSite and click the
        verification link. Let me know when you're done."
User:  "Done"
Agent: "Your account is active."
```

---

## Agent Decision Logic

```typescript
async function handleVerification(
  siteUrl: string,
  signupId: string,
  manifest: AgentSignupDiscovery | null,
  agent: AgentContext,
): Promise<void> {

  // Tier 1: Site has Vouch SDK (relay handles it)
  if (manifest) {
    // The site SDK already posted the code to the relay
    // Just poll until the relay confirms verification
    const status = await agent.waitForVerification(siteUrl, signupId, {
      maxWaitMs: 30_000, // 30 seconds -- relay is fast
    });
    if (status === "active") return;
    // If relay failed, fall through
  }

  // Tier 2: Agent has email access
  if (agent.hasEmailAccess()) {
    const hostname = new URL(siteUrl).hostname;
    const code = await agent.watchForVerificationEmail({
      fromDomain: hostname,
      maxWaitMs: 60_000,
      patterns: [/\b\d{6}\b/, /verify|confirm|activate/i],
    });
    if (code) {
      await agent.submitVerification(siteUrl, signupId, code);
      return;
    }
  }

  // Tier 3: Ask the user
  const code = await agent.ask(
    `Check your email for a verification code from ${hostname}.`
  );
  await agent.submitVerification(siteUrl, signupId, code);
}
```

---

## Summary

| Tier | When | Who verifies | User action | Time |
|------|------|-------------|-------------|------|
| **1** | Site has Vouch SDK | Relay (automatic) | None | ~2-5s |
| **2** | No SDK, agent has email | Agent reads inbox | None | ~10-30s |
| **3** | No SDK, no email access | User | Types code | ~1-2 min |

The goal: Tier 1 should cover most signups as Vouch adoption grows. Tier 2 covers the long tail. Tier 3 is the safe fallback that always works.

---

## Security

- **Relay sees only verification codes**, never PII
- Webhook entries expire after 30 minutes
- Relay-to-site verification uses the same consent token
- Rate limit: max 10 active relays per vault
- The relay cannot create accounts -- it only verifies
- If the relay is compromised, the worst case is auto-verification of pending signups (accounts the user already consented to create)
