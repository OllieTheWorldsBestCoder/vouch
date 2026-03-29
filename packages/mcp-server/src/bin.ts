#!/usr/bin/env node

import { VouchMcpServer } from "./server.js";

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { vaultPath?: string } {
  const args = argv.slice(2); // skip node and script path
  let vaultPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vault" && i + 1 < args.length) {
      vaultPath = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.error(`Usage: vouch-mcp-server [options]

Options:
  --vault <path>  Path to vault file (default: ~/.vouch/vault.json)
  --help, -h      Show this help message

The Vouch MCP server exposes tools for AI agents to discover sites
that support the Vouch agent-signup protocol and sign up users.

Tools:
  vouch_discover      Discover if a site supports Vouch
  vouch_signup        Full signup flow (discover + challenge + consent + submit)
  vouch_status        Check signup status
  vouch_verify        Submit a verification code
  vouch_vault_init    Create a new vault
  vouch_vault_status  Check vault existence and stored fields
`);
      process.exit(0);
    }
  }

  return { vaultPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { vaultPath } = parseArgs(process.argv);

  const server = new VouchMcpServer({ vaultPath });

  // Log to stderr so it doesn't interfere with JSON-RPC on stdout
  process.stderr.write(
    `[vouch-mcp-server] Starting on stdio (vault: ${vaultPath ?? "~/.vouch/vault.json"})\n`,
  );

  await server.listen();
}

main().catch((err) => {
  process.stderr.write(`[vouch-mcp-server] Fatal error: ${err}\n`);
  process.exit(1);
});
