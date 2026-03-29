import { createInterface } from "node:readline";
import {
  AgentSignupClient,
  type StatusResponse,
  type VerificationResponse,
} from "@agent-signup/agent";
import {
  Vault,
  FileStorage,
  ConsentManager,
  defaultVaultPath,
  generatePassword,
  type ConsentRequest,
} from "@agent-signup/client";
import type { AgentSignupDiscovery, SignupResponse } from "@agent-signup/protocol";

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "vouch_discover",
    description:
      "Discover if a site supports the Vouch agent-signup protocol. Returns the site manifest (fields, endpoints, branding) or null if unsupported.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: {
          type: "string",
          description: "The URL of the site to check (e.g. https://example.com)",
        },
      },
      required: ["site_url"],
    },
  },
  {
    name: "vouch_signup",
    description:
      "Full signup flow: discover site, open vault, request challenge, sign consent, submit signup. Returns the signup result including verification instructions.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: {
          type: "string",
          description: "The URL of the site to sign up on",
        },
        password: {
          type: "string",
          description: "Vault passphrase to unlock the vault (required if vault is locked)",
        },
      },
      required: ["site_url"],
    },
  },
  {
    name: "vouch_status",
    description: "Check the status of an existing signup (pending, active, rejected, expired).",
    inputSchema: {
      type: "object",
      properties: {
        site_url: {
          type: "string",
          description: "The URL of the site",
        },
        signup_id: {
          type: "string",
          description: "The signup ID returned from the signup flow",
        },
      },
      required: ["site_url", "signup_id"],
    },
  },
  {
    name: "vouch_verify",
    description: "Submit a verification code (e.g. email or phone code) for a pending signup.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: {
          type: "string",
          description: "The URL of the site",
        },
        signup_id: {
          type: "string",
          description: "The signup ID returned from the signup flow",
        },
        code: {
          type: "string",
          description: "The verification code received via email or phone",
        },
      },
      required: ["site_url", "signup_id", "code"],
    },
  },
  {
    name: "vouch_vault_init",
    description:
      "Create a new Vouch vault with identity fields. The vault stores your name, email, and signing keys encrypted with a passphrase.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Full name for the vault identity",
        },
        email: {
          type: "string",
          description: "Email address for the vault identity",
        },
        password: {
          type: "string",
          description: "Passphrase to encrypt the vault",
        },
      },
      required: ["name", "email", "password"],
    },
  },
  {
    name: "vouch_vault_status",
    description:
      "Check if a Vouch vault exists and what fields are stored. Returns field names (not values), lock status, and identity info.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export interface McpServerOptions {
  vaultPath?: string;
}

export class VouchMcpServer {
  private client: AgentSignupClient;
  private vaultPath: string;
  private vault: Vault | null = null;

  constructor(options: McpServerOptions = {}) {
    this.client = new AgentSignupClient();
    this.vaultPath = options.vaultPath ?? defaultVaultPath();
  }

  /**
   * Start listening on stdio for JSON-RPC messages.
   */
  async listen(): Promise<void> {
    const rl = createInterface({ input: process.stdin });

    // Buffer for content-length framed messages (MCP standard transport)
    let contentBuffer = "";
    let expectedLength = -1;

    const processLine = async (line: string) => {
      // Handle Content-Length header-based framing (MCP stdio transport)
      if (line.startsWith("Content-Length:")) {
        expectedLength = parseInt(line.slice("Content-Length:".length).trim(), 10);
        contentBuffer = "";
        return;
      }

      // Empty line separates headers from body in HTTP-style framing
      if (line.trim() === "" && expectedLength > 0) {
        return;
      }

      // If we have a content-length expectation, accumulate body
      if (expectedLength > 0) {
        contentBuffer += line;
        if (Buffer.byteLength(contentBuffer, "utf-8") >= expectedLength) {
          const msg = contentBuffer;
          expectedLength = -1;
          contentBuffer = "";
          await this.handleMessage(msg);
          return;
        }
        return;
      }

      // Fallback: try to parse as raw JSON line
      const trimmed = line.trim();
      if (trimmed) {
        await this.handleMessage(trimmed);
      }
    };

    rl.on("line", processLine);

    // Keep process alive
    await new Promise<void>((resolve) => {
      rl.on("close", resolve);
      process.stdin.on("end", resolve);
    });
  }

  private async handleMessage(raw: string): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(raw);
    } catch {
      this.sendResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    // Handle notifications (no id) silently
    if (request.id === undefined || request.id === null) {
      // Notifications like "notifications/initialized" - just acknowledge
      return;
    }

    try {
      const result = await this.dispatch(request);
      this.sendResponse({ jsonrpc: "2.0", id: request.id, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendResponse({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message },
      });
    }
  }

  private async dispatch(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request.params ?? {});
      case "tools/list":
        return this.handleToolsList();
      case "tools/call":
        return this.handleToolsCall(request.params as { name: string; arguments?: Record<string, unknown> });
      case "ping":
        return {};
      default:
        throw new JsonRpcError(-32601, `Method not found: ${request.method}`);
    }
  }

  // -----------------------------------------------------------------------
  // MCP protocol handlers
  // -----------------------------------------------------------------------

  private handleInitialize(_params: Record<string, unknown>): unknown {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "vouch-mcp-server",
        version: "0.1.0",
      },
    };
  }

  private handleToolsList(): unknown {
    return {
      tools: TOOLS,
    };
  }

  private async handleToolsCall(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    const args = params.arguments ?? {};

    switch (params.name) {
      case "vouch_discover":
        return this.toolDiscover(args as { site_url: string });
      case "vouch_signup":
        return this.toolSignup(args as { site_url: string; password?: string });
      case "vouch_status":
        return this.toolStatus(args as { site_url: string; signup_id: string });
      case "vouch_verify":
        return this.toolVerify(args as { site_url: string; signup_id: string; code: string });
      case "vouch_vault_init":
        return this.toolVaultInit(args as { name: string; email: string; password: string });
      case "vouch_vault_status":
        return this.toolVaultStatus();
      default:
        throw new JsonRpcError(-32602, `Unknown tool: ${params.name}`);
    }
  }

  // -----------------------------------------------------------------------
  // Tool implementations
  // -----------------------------------------------------------------------

  private async toolDiscover(args: { site_url: string }): Promise<unknown> {
    const manifest = await this.client.discover(args.site_url);
    if (!manifest) {
      return contentResult(
        `Site ${args.site_url} does not support the Vouch agent-signup protocol.`,
      );
    }
    return contentResult(JSON.stringify(manifest, null, 2));
  }

  private async toolSignup(args: {
    site_url: string;
    password?: string;
  }): Promise<unknown> {
    // Step 1: Discover
    const manifest = await this.client.discover(args.site_url);
    if (!manifest) {
      return contentResult(
        `Site ${args.site_url} does not support the Vouch agent-signup protocol.`,
        true,
      );
    }

    // Step 2: Open vault
    const vault = await this.getOrOpenVault(args.password);
    if (!vault) {
      return contentResult(
        "Vault is locked or does not exist. Provide a password argument or create a vault first with vouch_vault_init.",
        true,
      );
    }

    // Step 3: Request challenge
    const identity = vault.getIdentity();
    const challenge = await this.client.requestChallenge(
      args.site_url,
      identity.publicKey,
    );

    // Step 4: Sign consent token
    const consentManager = new ConsentManager(vault);
    const consentRequest: ConsentRequest = {
      site: { ...manifest.branding, url: args.site_url },
      requestedFields: {
        required: manifest.fields.required.map((f) => ({ field: f.field })),
        optional: manifest.fields.optional.map((f) => ({ field: f.field })),
      },
      nonce: challenge.nonce,
      siteEndpoint: manifest.endpoints.signup,
      agentId: "vouch-mcp-server/0.1.0",
    };

    const consent = await consentManager.requestConsent(consentRequest);
    if (!consent.approved) {
      return contentResult(
        `Consent denied: ${consent.reason}. Make sure your vault has the required fields: ${manifest.fields.required.map((f) => f.field).join(", ")}`,
        true,
      );
    }

    // Step 5: Generate password for the site if needed
    const sitePassword = generatePassword();
    await vault.setPassword(args.site_url, sitePassword);

    // Step 6: Submit signup
    const signupData: Record<string, unknown> = { ...consent.fields };

    const signupResult: SignupResponse = await this.client.submitSignup(
      args.site_url,
      {
        consent_token: consent.token,
        data: signupData,
        agent: {
          name: "vouch-mcp-server",
          version: "0.1.0",
        },
        idempotency_key: crypto.randomUUID(),
      },
    );

    // Step 7: Record in vault history
    await vault.addHistory({
      id: signupResult.signup_id,
      site: manifest.branding.name,
      siteUrl: args.site_url,
      fields: manifest.fields.required.map((f) => f.field),
      consentMode: "explicit",
      status: signupResult.status === "active" ? "verified" : "pending",
      timestamp: new Date().toISOString(),
    });

    // Format result
    const lines: string[] = [
      `Signup successful for ${manifest.branding.name}!`,
      `  Signup ID: ${signupResult.signup_id}`,
      `  Status: ${signupResult.status}`,
    ];
    if (signupResult.verification.required) {
      lines.push(
        `  Verification required via ${signupResult.verification.method}`,
      );
      if (signupResult.verification.sent_to) {
        lines.push(`  Sent to: ${signupResult.verification.sent_to}`);
      }
      lines.push(
        `  Use vouch_verify to submit the verification code.`,
      );
    }
    if (signupResult.expires_at) {
      lines.push(`  Expires: ${signupResult.expires_at}`);
    }

    return contentResult(lines.join("\n"));
  }

  private async toolStatus(args: {
    site_url: string;
    signup_id: string;
  }): Promise<unknown> {
    const status: StatusResponse = await this.client.checkStatus(
      args.site_url,
      args.signup_id,
    );
    return contentResult(JSON.stringify(status, null, 2));
  }

  private async toolVerify(args: {
    site_url: string;
    signup_id: string;
    code: string;
  }): Promise<unknown> {
    const result: VerificationResponse = await this.client.submitVerification(
      args.site_url,
      args.signup_id,
      args.code,
    );
    return contentResult(JSON.stringify(result, null, 2));
  }

  private async toolVaultInit(args: {
    name: string;
    email: string;
    password: string;
  }): Promise<unknown> {
    const storage = new FileStorage(this.vaultPath);
    const exists = await Vault.exists(storage);
    if (exists) {
      return contentResult(
        `A vault already exists at ${this.vaultPath}. To use it, call vouch_signup with a password.`,
        true,
      );
    }

    const vault = await Vault.create({
      passphrase: args.password,
      storage,
    });

    // Store identity fields
    await vault.setField("name", args.name);
    await vault.setField("email", args.email);

    this.vault = vault;

    const identity = vault.getIdentity();
    return contentResult(
      [
        `Vault created at ${this.vaultPath}`,
        `  Public Key: ${identity.publicKey}`,
        `  Key ID: ${identity.keyId}`,
        `  Fields: name, email`,
        ``,
        `You can now use vouch_signup to sign up for sites.`,
      ].join("\n"),
    );
  }

  private async toolVaultStatus(): Promise<unknown> {
    const storage = new FileStorage(this.vaultPath);
    const exists = await Vault.exists(storage);

    if (!exists) {
      return contentResult(
        `No vault found at ${this.vaultPath}. Use vouch_vault_init to create one.`,
      );
    }

    // If vault is already open and unlocked, show details
    if (this.vault && this.vault.isUnlocked()) {
      const fields = await this.vault.listFields();
      const identity = this.vault.getIdentity();
      const history = await this.vault.getHistory({ limit: 5 });

      const lines: string[] = [
        `Vault: ${this.vaultPath}`,
        `  Status: unlocked`,
        `  Public Key: ${identity.publicKey}`,
        `  Key ID: ${identity.keyId}`,
        `  Fields: ${fields.join(", ") || "(none)"}`,
      ];
      if (history.length > 0) {
        lines.push(`  Recent signups:`);
        for (const entry of history) {
          lines.push(`    - ${entry.site} (${entry.status}) ${entry.timestamp}`);
        }
      }
      return contentResult(lines.join("\n"));
    }

    // Vault exists but is locked
    return contentResult(
      [
        `Vault: ${this.vaultPath}`,
        `  Status: locked`,
        `  Provide a password via vouch_signup or open it to see details.`,
      ].join("\n"),
    );
  }

  // -----------------------------------------------------------------------
  // Vault helpers
  // -----------------------------------------------------------------------

  private async getOrOpenVault(password?: string): Promise<Vault | null> {
    // If already unlocked, return it
    if (this.vault && this.vault.isUnlocked()) {
      return this.vault;
    }

    if (!password) {
      return null;
    }

    const storage = new FileStorage(this.vaultPath);
    const exists = await Vault.exists(storage);
    if (!exists) {
      return null;
    }

    try {
      this.vault = await Vault.open({ passphrase: password, storage });
      return this.vault;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Transport
  // -----------------------------------------------------------------------

  private sendResponse(response: JsonRpcResponse): void {
    const body = JSON.stringify(response);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf-8")}\r\n\r\n`;
    process.stdout.write(header + body);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentResult(text: string, isError = false): unknown {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

class JsonRpcError extends Error {
  public readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}
