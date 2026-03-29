#!/usr/bin/env node

import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { exportCommand } from "./commands/export.js";

const args = process.argv.slice(2);
const command = args[0];

// Parse --vault flag
const vaultIdx = args.indexOf("--vault");
const vaultPath = vaultIdx !== -1 ? args[vaultIdx + 1] : undefined;

switch (command) {
  case "init":
    await initCommand(vaultPath);
    break;

  case "status":
    await statusCommand(vaultPath);
    break;

  case "export": {
    const output = args[1];
    if (!output || output.startsWith("--")) {
      console.log("\n  Usage: vouch export <output-path>\n");
      process.exit(1);
    }
    await exportCommand(output, vaultPath);
    break;
  }

  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;

  default:
    console.log(`\n  Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

function printHelp() {
  console.log(`
  \x1b[1mvouch\x1b[0m - Manage your Vouch identity vault

  \x1b[1mUsage:\x1b[0m
    vouch <command> [options]

  \x1b[1mCommands:\x1b[0m
    init      Create a new encrypted vault
    status    Show vault contents and recent signups
    export    Export vault to a file (still encrypted)
    help      Show this help

  \x1b[1mOptions:\x1b[0m
    --vault <path>   Custom vault path (default: ~/.vouch/vault.json)

  \x1b[1mExamples:\x1b[0m
    vouch init
    vouch status
    vouch export ~/backup-vault.json
`);
}
