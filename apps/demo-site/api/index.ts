import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAgentSignupHandler } from "@vouchagents/site";

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3456";

const handler = createAgentSignupHandler({
  site: {
    name: "Vouch Demo",
    url: SITE_URL,
    privacyUrl: `${SITE_URL}/privacy`,
    termsUrl: `${SITE_URL}/terms`,
  },
  fields: {
    required: [
      { field: "email", type: "email" as const },
      { field: "name", type: "string" as const },
    ],
    optional: [
      { field: "phone", type: "string" as const },
    ],
  },
  verification: { method: "none" as const },
  onSignup: async (data, metadata) => {
    console.log("Signup received:", JSON.stringify({
      name: data.name,
      email: data.email,
      agent: metadata.agentName,
    }));
    const userId = `user_${crypto.randomUUID().slice(0, 8)}`;
    return { userId };
  },
});

export default async function handle(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Build a Web API Request from Vercel's request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;

  let body: string | undefined;
  if (req.method === "POST" || req.method === "DELETE") {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const webReq = new Request(url, {
    method: req.method || "GET",
    headers: Object.fromEntries(
      Object.entries(req.headers)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!]),
    ),
    ...(body ? { body } : {}),
  });

  // Route
  let webRes: Response;
  try {
    if (req.method === "GET") webRes = await handler.GET(webReq);
    else if (req.method === "POST") webRes = await handler.POST(webReq);
    else if (req.method === "DELETE") webRes = await handler.DELETE(webReq);
    else return res.status(405).send("Method not allowed");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  // Write response
  const responseBody = await webRes.text();
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  return res.send(responseBody);
}
