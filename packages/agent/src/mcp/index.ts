import { AgentSignupClient } from "../client.js";
import { waitForVerification } from "../polling.js";

// ---------------------------------------------------------------------------
// MCP tool definition types
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

/**
 * Returns an array of MCP tool definitions that wrap the {@link AgentSignupClient}.
 *
 * Each tool exposes a `name`, human-readable `description`, a JSON-Schema
 * `inputSchema`, and an async `execute` function.
 *
 * @param client - An optional pre-configured client instance. If omitted a
 *                 fresh `AgentSignupClient` is created.
 */
export function getAgentSignupTools(
  client?: AgentSignupClient,
): McpToolDefinition[] {
  const c = client ?? new AgentSignupClient();

  return [
    // -----------------------------------------------------------------
    // 1. Discover
    // -----------------------------------------------------------------
    {
      name: "agent_signup_discover",
      description:
        "Discover whether a site supports the agent-signup protocol by fetching its /.well-known/agent-signup.json manifest.",
      inputSchema: {
        type: "object",
        properties: {
          site_url: {
            type: "string",
            description: "The base URL of the site to probe (e.g. https://example.com).",
          },
        },
        required: ["site_url"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const siteUrl = input.site_url as string;
        const manifest = await c.discover(siteUrl);
        if (!manifest) {
          return { supported: false, site_url: siteUrl };
        }
        return { supported: true, site_url: siteUrl, manifest };
      },
    },

    // -----------------------------------------------------------------
    // 2. Request challenge
    // -----------------------------------------------------------------
    {
      name: "agent_signup_request_challenge",
      description:
        "Request a cryptographic challenge from a site that supports agent-signup. Required before submitting a signup.",
      inputSchema: {
        type: "object",
        properties: {
          site_url: {
            type: "string",
            description: "The base URL of the target site.",
          },
          public_key: {
            type: "string",
            description: "The agent's Ed25519 public key (base64url-encoded).",
          },
        },
        required: ["site_url", "public_key"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const siteUrl = input.site_url as string;
        const publicKey = input.public_key as string;
        return c.requestChallenge(siteUrl, publicKey);
      },
    },

    // -----------------------------------------------------------------
    // 3. Submit signup
    // -----------------------------------------------------------------
    {
      name: "agent_signup_submit",
      description:
        "Submit a signup request to a site. The request must include a valid consent token, user data, and agent metadata.",
      inputSchema: {
        type: "object",
        properties: {
          site_url: {
            type: "string",
            description: "The base URL of the target site.",
          },
          consent_token: {
            type: "string",
            description: "Signed consent token authorising the signup.",
          },
          data: {
            type: "object",
            description: "User data fields as specified by the site's manifest.",
          },
          agent: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              mcp_session_id: { type: "string" },
            },
            required: ["name", "version"],
            description: "Agent identification metadata.",
          },
          idempotency_key: {
            type: "string",
            description: "UUID v4 idempotency key to prevent duplicate signups.",
          },
        },
        required: ["site_url", "consent_token", "data", "agent", "idempotency_key"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const siteUrl = input.site_url as string;
        const request = {
          consent_token: input.consent_token as string,
          data: input.data as Record<string, unknown>,
          agent: input.agent as {
            name: string;
            version: string;
            mcp_session_id?: string;
          },
          idempotency_key: input.idempotency_key as string,
        };
        return c.submitSignup(siteUrl, request);
      },
    },

    // -----------------------------------------------------------------
    // 4. Check status
    // -----------------------------------------------------------------
    {
      name: "agent_signup_check_status",
      description:
        "Check the current status of a previously submitted signup.",
      inputSchema: {
        type: "object",
        properties: {
          site_url: {
            type: "string",
            description: "The base URL of the target site.",
          },
          signup_id: {
            type: "string",
            description: "The signup ID returned from agent_signup_submit.",
          },
        },
        required: ["site_url", "signup_id"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const siteUrl = input.site_url as string;
        const signupId = input.signup_id as string;
        return c.checkStatus(siteUrl, signupId);
      },
    },

    // -----------------------------------------------------------------
    // 5. Submit verification
    // -----------------------------------------------------------------
    {
      name: "agent_signup_verify",
      description:
        "Submit a verification code (email or phone) to complete a signup that requires verification.",
      inputSchema: {
        type: "object",
        properties: {
          site_url: {
            type: "string",
            description: "The base URL of the target site.",
          },
          signup_id: {
            type: "string",
            description: "The signup ID to verify.",
          },
          code: {
            type: "string",
            description: "The verification code received by the user.",
          },
        },
        required: ["site_url", "signup_id", "code"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const siteUrl = input.site_url as string;
        const signupId = input.signup_id as string;
        const code = input.code as string;
        return c.submitVerification(siteUrl, signupId, code);
      },
    },
  ];
}
