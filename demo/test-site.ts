/**
 * Demo: A minimal test site using @agent-signup/site.
 *
 * Run with: npx tsx demo/test-site.ts
 * Then run demo/agent-signup-flow.ts in another terminal.
 */
import { createServer } from "node:http";
import { createAgentSignupHandler } from "@agent-signup/site";

const PORT = 3456;
const SITE_URL = `http://localhost:${PORT}`;

// This is all a site developer needs to write:
const handler = createAgentSignupHandler({
  site: {
    name: "Demo App",
    url: SITE_URL,
    privacyUrl: `${SITE_URL}/privacy`,
    termsUrl: `${SITE_URL}/terms`,
  },

  fields: {
    required: [
      { field: "email", type: "email", label: "Email" },
      { field: "name", type: "string", label: "Full Name" },
    ],
    optional: [
      { field: "phone", type: "string", label: "Phone" },
    ],
  },

  verification: {
    method: "none", // Skip email verification for the demo
  },

  onSignup: async (data, metadata) => {
    console.log("\n  New signup received:");
    console.log(`    Name:    ${data.name}`);
    console.log(`    Email:   ${data.email}`);
    console.log(`    Agent:   ${metadata.agentName} v${metadata.agentVersion}`);
    console.log(`    Consent: ${metadata.consentMode}`);

    // In a real app, you'd create a user in your database here
    const userId = `user_${crypto.randomUUID().slice(0, 8)}`;
    console.log(`    UserID:  ${userId}\n`);
    return { userId };
  },
});

// Wrap in a Node.js HTTP server
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", SITE_URL);
  const method = req.method ?? "GET";

  // Read body for POST/DELETE
  let body = "";
  if (method === "POST" || method === "DELETE") {
    for await (const chunk of req) {
      body += chunk;
    }
  }

  // Build a Web API Request from the Node.js request
  const webReq = new Request(url.toString(), {
    method,
    headers: Object.fromEntries(
      Object.entries(req.headers)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!]),
    ),
    ...(body ? { body } : {}),
  });

  let webRes: Response;
  try {
    if (method === "GET") webRes = await handler.GET(webReq);
    else if (method === "POST") webRes = await handler.POST(webReq);
    else if (method === "DELETE") webRes = await handler.DELETE(webReq);
    else {
      res.writeHead(405).end("Method not allowed");
      return;
    }
  } catch (err) {
    console.error("Handler error:", err);
    res.writeHead(500).end("Internal server error");
    return;
  }

  // Write the Web API Response back to Node.js
  res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  const responseBody = await webRes.text();
  res.end(responseBody);
});

server.listen(PORT, () => {
  console.log(`\n  Demo site running at ${SITE_URL}`);
  console.log(`  Discovery: ${SITE_URL}/.well-known/agent-signup.json`);
  console.log(`  Waiting for agent signups...\n`);
});
