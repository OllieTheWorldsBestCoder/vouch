/**
 * Demo: An agent that discovers a site and signs up a user.
 *
 * This exercises the full flow:
 *   1. Discover site requirements
 *   2. Create a vault (just-in-time)
 *   3. Request a challenge nonce
 *   4. Sign a consent token
 *   5. Submit the signup
 *   6. Check status
 *
 * Run: npx tsx demo/agent-signup-flow.ts
 * (Make sure demo/test-site.ts is running first)
 */
import { AgentSignupClient } from "@agent-signup/agent";
import { Vault, MemoryStorage, ConsentManager } from "@agent-signup/client";

const SITE_URL = "http://localhost:3456";

async function main() {
  console.log("\n  Agent Signup Demo");
  console.log("  =================\n");

  // --- Step 1: Discover ---
  console.log("  1. Discovering site requirements...");
  const client = new AgentSignupClient();
  const manifest = await client.discover(SITE_URL);

  if (!manifest) {
    console.log("     Site doesn't support Agent Signup.");
    process.exit(1);
  }

  console.log(`     Found: ${manifest.branding.name}`);
  console.log(
    `     Requires: ${manifest.fields.required.map((f) => f.field).join(", ")}`,
  );

  // --- Step 2: Create vault (just-in-time) ---
  console.log("\n  2. Creating vault with user details...");
  const vault = await Vault.create({
    passphrase: "demo-password-123",
    storage: new MemoryStorage(),
  });

  await vault.setField("email", "alex@example.com");
  await vault.setField("name", "Alex Johnson");
  console.log("     Vault created. Fields: email, name");

  // --- Step 3: Request challenge ---
  console.log("\n  3. Requesting challenge nonce...");
  const identity = vault.getIdentity();
  const challenge = await client.requestChallenge(SITE_URL, identity.publicKey);
  console.log(`     Nonce received (expires: ${challenge.expires_at})`);

  // --- Step 4: Sign consent token ---
  console.log("\n  4. Signing consent token...");
  const consentManager = new ConsentManager(vault);
  const consent = await consentManager.requestConsent({
    site: { ...manifest.branding, url: SITE_URL },
    requestedFields: manifest.fields,
    nonce: challenge.nonce,
    siteEndpoint: `${SITE_URL}${manifest.endpoints.signup}`,
    agentId: "demo-agent/1.0",
  });

  if (!consent.approved) {
    console.log(`     Consent denied: ${consent.reason}`);
    process.exit(1);
  }
  console.log("     Consent token signed (explicit mode)");

  // --- Step 5: Submit signup ---
  console.log("\n  5. Submitting signup...");
  const result = await client.submitSignup(SITE_URL, {
    consent_token: consent.token,
    data: consent.fields,
    agent: { name: "demo-agent", version: "1.0" },
    idempotency_key: crypto.randomUUID(),
  });

  console.log(`     Signup ID: ${result.signup_id}`);
  console.log(`     Status: ${result.status}`);

  // --- Step 6: Check status ---
  console.log("\n  6. Checking signup status...");
  const status = await client.checkStatus(SITE_URL, result.signup_id);
  console.log(`     Status: ${status.status}`);

  console.log("\n  Done. Full flow completed successfully.\n");
}

main().catch((err) => {
  console.error("\n  Error:", err.message ?? err);
  process.exit(1);
});
