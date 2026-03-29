import { Vault, FileStorage, defaultVaultPath } from "@vouchagents/client";
import { writeFile } from "node:fs/promises";
import { askSecret, close } from "../prompt.js";

export async function exportCommand(outputPath: string, vaultPath?: string) {
  const path = vaultPath ?? defaultVaultPath();
  const storage = new FileStorage(path);

  if (!(await storage.exists())) {
    console.log(`\n  No vault found at ${path}\n`);
    close();
    return;
  }

  const password = await askSecret("  Vault password: ");
  close();

  try {
    // Verify the password works by opening
    await Vault.open({ passphrase: password, storage });

    // Export the raw encrypted file
    const data = await storage.read();
    if (!data) {
      console.log("\n  Failed to read vault.\n");
      process.exit(1);
    }

    await writeFile(outputPath, data, "utf-8");
    console.log(`\n  \x1b[32mVault exported to ${outputPath}\x1b[0m`);
    console.log("  This file is encrypted. You need your password to use it.\n");
  } catch {
    console.log("\n  Wrong password.\n");
    process.exit(1);
  }
}
