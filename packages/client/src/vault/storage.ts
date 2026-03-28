/** Storage backend interface. The vault doesn't care where the encrypted blob lives. */
export interface StorageBackend {
  read(): Promise<string | null>;
  write(data: string): Promise<void>;
  exists(): Promise<boolean>;
}

/** File-based storage (~/.agent-signup/vault.json). Works in Node.js/Bun. */
export class FileStorage implements StorageBackend {
  constructor(private path: string) {}

  async read(): Promise<string | null> {
    try {
      const fs = await import("node:fs/promises");
      return await fs.readFile(this.path, "utf-8");
    } catch {
      return null;
    }
  }

  async write(data: string): Promise<void> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    await fs.writeFile(this.path, data, "utf-8");
  }

  async exists(): Promise<boolean> {
    try {
      const fs = await import("node:fs/promises");
      await fs.access(this.path);
      return true;
    } catch {
      return false;
    }
  }
}

/** localStorage-based storage. Works in browsers. */
export class LocalStorageBackend implements StorageBackend {
  constructor(private key: string = "agent-signup:vault") {}

  async read(): Promise<string | null> {
    return globalThis.localStorage?.getItem(this.key) ?? null;
  }

  async write(data: string): Promise<void> {
    globalThis.localStorage?.setItem(this.key, data);
  }

  async exists(): Promise<boolean> {
    return globalThis.localStorage?.getItem(this.key) !== null;
  }
}

/** In-memory storage for testing. */
export class MemoryStorage implements StorageBackend {
  private data: string | null = null;

  async read(): Promise<string | null> {
    return this.data;
  }

  async write(data: string): Promise<void> {
    this.data = data;
  }

  async exists(): Promise<boolean> {
    return this.data !== null;
  }
}

/** Get the default vault file path. */
export function defaultVaultPath(): string {
  const home =
    typeof process !== "undefined"
      ? process.env.HOME || process.env.USERPROFILE || "."
      : ".";
  return `${home}/.agent-signup/vault.json`;
}
