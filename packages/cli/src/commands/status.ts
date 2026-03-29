import { Vault, FileStorage, defaultVaultPath } from "@vouchagents/client";
import { askSecret, close } from "../prompt.js";

export async function statusCommand(vaultPath?: string) {
  const path = vaultPath ?? defaultVaultPath();
  const storage = new FileStorage(path);

  if (!(await storage.exists())) {
    console.log(`\n  No vault found at ${path}`);
    console.log("  Run `vouch init` to create one.\n");
    close();
    return;
  }

  const password = await askSecret("  Vault password: ");
  close();

  try {
    const vault = await Vault.open({ passphrase: password, storage });
    const fields = await vault.listFields();
    const identity = vault.getIdentity();
    const history = await vault.getHistory({ limit: 5 });

    console.log("\n  \x1b[1mVouch Vault\x1b[0m");
    console.log(`  Location: ${path}`);
    console.log(`  Key ID:   ${identity.keyId}\n`);

    console.log("  \x1b[1mStored fields:\x1b[0m");
    for (const field of fields) {
      const val = await vault.getField(field);
      const masked =
        val && field === "email"
          ? maskEmail(val.unsafeUnwrap())
          : val
            ? val.unsafeUnwrap().slice(0, 2) + "***"
            : "(empty)";
      console.log(`    ${field}: ${masked}`);
    }

    if (history.length > 0) {
      console.log(`\n  \x1b[1mRecent signups:\x1b[0m`);
      for (const entry of history) {
        const date = new Date(entry.timestamp).toLocaleDateString();
        console.log(`    ${date}  ${entry.site}  ${entry.status}`);
      }
    } else {
      console.log("\n  No signups yet.");
    }

    console.log();
  } catch {
    console.log("\n  Wrong password.\n");
    process.exit(1);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return local.slice(0, 2) + "***@" + domain;
}
