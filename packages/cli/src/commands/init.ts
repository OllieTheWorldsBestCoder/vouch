import { Vault, FileStorage, defaultVaultPath } from "@agent-signup/client";
import { ask, askSecret, close } from "../prompt.js";

export async function initCommand(vaultPath?: string) {
  const path = vaultPath ?? defaultVaultPath();
  const storage = new FileStorage(path);

  // Check if vault already exists
  if (await storage.exists()) {
    console.log(`\n  A vault already exists at ${path}`);
    console.log("  Run `vouch status` to see what's stored.");
    console.log("  Run `vouch init --force` to overwrite.\n");
    close();
    return;
  }

  console.log("\n  Setting up Vouch...\n");

  const name = await ask("  What name should we use? ");
  if (!name) {
    console.log("  Name is required.");
    close();
    process.exit(1);
  }

  const email = await ask("  Email? ");
  if (!email) {
    console.log("  Email is required.");
    close();
    process.exit(1);
  }

  const password = await askSecret("  Set a password to protect your vault: ");
  if (!password || password.length < 6) {
    console.log("\n  Password must be at least 6 characters.");
    close();
    process.exit(1);
  }

  console.log("\n  Creating vault...");

  try {
    const vault = await Vault.create({ passphrase: password, storage });
    await vault.setField("name", name);
    await vault.setField("email", email);

    const identity = vault.getIdentity();

    console.log(`\n  \x1b[32mVault created at ${path}\x1b[0m`);
    console.log(`  \x1b[32mEd25519 signing key generated\x1b[0m`);
    console.log(`\n  Key ID: ${identity.keyId}`);
    console.log("  Your details are encrypted. Run `vouch status` to check.\n");
  } catch (err) {
    console.error(`\n  Failed to create vault: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  close();
}
