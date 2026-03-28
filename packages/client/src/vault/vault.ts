import {
  generateKeyPair,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  generateSalt,
  base64urlEncode,
  base64urlDecode,
  type KeyPair,
  SensitiveString,
} from "@agent-signup/protocol";
import type { StorageBackend } from "./storage.js";

export interface VaultData {
  fields: Record<string, string>;
  passwords: Record<string, string>;
  history: SignupHistoryEntry[];
  policies: PolicyEntry[];
  custom: Record<string, string>;
}

export interface SignupHistoryEntry {
  id: string;
  site: string;
  siteUrl: string;
  fields: string[];
  consentMode: "explicit" | "pre_authorized" | "manual";
  status: "pending" | "verified" | "expired" | "failed" | "user_directed";
  timestamp: string;
}

export interface PolicyEntry {
  id: string;
  name: string;
  scopes: string[];
  allowedOrigins: string[];
  allowedFields: string[];
  maxUses?: number;
  remainingUses?: number;
  expiresAt: string;
  createdAt: string;
}

interface VaultFile {
  version: 1;
  kdf: {
    algorithm: "pbkdf2";
    iterations: number;
    salt: string;
  };
  vault: string;
  vault_iv: string;
  signing_public_key: string;
  created_at: string;
  updated_at: string;
}

export class Vault {
  private encryptionKey: CryptoKey | null = null;
  private keyPair: KeyPair | null = null;
  private data: VaultData | null = null;
  private vaultFile: VaultFile | null = null;
  private lockedAt: number = 0;
  private readonly autoLockMs = 15 * 60 * 1000; // 15 minutes

  private constructor(private storage: StorageBackend) {}

  /** Create a new vault with a passphrase. */
  static async create(options: {
    passphrase: string;
    storage: StorageBackend;
  }): Promise<Vault> {
    const vault = new Vault(options.storage);
    const salt = generateSalt();
    const encryptionKey = await deriveEncryptionKey(options.passphrase, salt);
    const keyPair = await generateKeyPair();

    vault.encryptionKey = encryptionKey;
    vault.keyPair = keyPair;
    vault.data = {
      fields: {},
      passwords: {},
      history: [],
      policies: [],
      custom: {},
    };

    vault.vaultFile = {
      version: 1,
      kdf: {
        algorithm: "pbkdf2",
        iterations: 600_000,
        salt: base64urlEncode(salt),
      },
      vault: "", // filled on save
      vault_iv: "",
      signing_public_key: base64urlEncode(keyPair.publicKey),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vault.lockedAt = Date.now();
    await vault.save();
    return vault;
  }

  /** Open an existing vault with a passphrase. */
  static async open(options: {
    passphrase: string;
    storage: StorageBackend;
  }): Promise<Vault> {
    const vault = new Vault(options.storage);
    const raw = await options.storage.read();
    if (!raw) {
      throw new Error("No vault found");
    }

    const vaultFile: VaultFile = JSON.parse(raw);
    vault.vaultFile = vaultFile;

    const salt = base64urlDecode(vaultFile.kdf.salt);
    const encryptionKey = await deriveEncryptionKey(options.passphrase, salt);
    vault.encryptionKey = encryptionKey;

    // Decrypt the vault data
    const ciphertext = base64urlDecode(vaultFile.vault);
    const iv = base64urlDecode(vaultFile.vault_iv);

    try {
      const decrypted = await decrypt(ciphertext, encryptionKey, iv);
      const json = new TextDecoder().decode(decrypted);
      const parsed = JSON.parse(json);
      vault.data = parsed.data;
      vault.keyPair = {
        publicKey: base64urlDecode(vaultFile.signing_public_key),
        privateKey: base64urlDecode(parsed.privateKey),
        keyId: parsed.keyId,
      };
    } catch {
      throw new Error("Wrong passphrase");
    }

    vault.lockedAt = Date.now();
    return vault;
  }

  /** Check if a vault exists at the storage location. */
  static async exists(storage: StorageBackend): Promise<boolean> {
    return storage.exists();
  }

  // --- Field operations ---

  async setField(name: string, value: string): Promise<void> {
    this.ensureUnlocked();
    this.data!.fields[name] = value;
    await this.save();
  }

  async getField(name: string): Promise<SensitiveString | null> {
    this.ensureUnlocked();
    const value = this.data!.fields[name];
    return value ? new SensitiveString(value) : null;
  }

  async listFields(): Promise<string[]> {
    this.ensureUnlocked();
    return Object.keys(this.data!.fields);
  }

  async getFieldsRaw(fieldNames: string[]): Promise<Record<string, string>> {
    this.ensureUnlocked();
    const result: Record<string, string> = {};
    for (const name of fieldNames) {
      const value = this.data!.fields[name] ?? this.data!.custom[name];
      if (value) result[name] = value;
    }
    return result;
  }

  // --- Password operations ---

  async setPassword(siteUrl: string, password: SensitiveString): Promise<void> {
    this.ensureUnlocked();
    this.data!.passwords[siteUrl] = password.unsafeUnwrap();
    await this.save();
  }

  async getPassword(siteUrl: string): Promise<SensitiveString | null> {
    this.ensureUnlocked();
    const value = this.data!.passwords[siteUrl];
    return value ? new SensitiveString(value) : null;
  }

  // --- Custom fields ---

  async setCustomField(name: string, value: string): Promise<void> {
    this.ensureUnlocked();
    this.data!.custom[name] = value;
    await this.save();
  }

  // --- History ---

  async addHistory(entry: SignupHistoryEntry): Promise<void> {
    this.ensureUnlocked();
    this.data!.history.unshift(entry);
    await this.save();
  }

  async getHistory(options?: {
    limit?: number;
    siteUrl?: string;
  }): Promise<SignupHistoryEntry[]> {
    this.ensureUnlocked();
    let entries = this.data!.history;
    if (options?.siteUrl) {
      entries = entries.filter((e) => e.siteUrl === options.siteUrl);
    }
    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }
    return entries;
  }

  // --- Policies ---

  async addPolicy(policy: PolicyEntry): Promise<void> {
    this.ensureUnlocked();
    this.data!.policies.push(policy);
    await this.save();
  }

  async getPolicies(): Promise<PolicyEntry[]> {
    this.ensureUnlocked();
    return this.data!.policies.filter(
      (p) => new Date(p.expiresAt) > new Date(),
    );
  }

  async removePolicy(policyId: string): Promise<void> {
    this.ensureUnlocked();
    this.data!.policies = this.data!.policies.filter((p) => p.id !== policyId);
    await this.save();
  }

  async findMatchingPolicy(
    origin: string,
    fields: string[],
  ): Promise<PolicyEntry | null> {
    this.ensureUnlocked();
    const now = new Date();
    return (
      this.data!.policies.find((p) => {
        if (new Date(p.expiresAt) <= now) return false;
        if (p.remainingUses !== undefined && p.remainingUses <= 0) return false;
        const originMatch = p.allowedOrigins.some(
          (o) => o === "*" || origin.includes(o),
        );
        if (!originMatch) return false;
        return fields.every((f) => p.allowedFields.includes(f));
      }) ?? null
    );
  }

  // --- Identity ---

  getIdentity(): { publicKey: string; keyId: string } {
    this.ensureUnlocked();
    return {
      publicKey: base64urlEncode(this.keyPair!.publicKey),
      keyId: this.keyPair!.keyId,
    };
  }

  getKeyPair(): KeyPair {
    this.ensureUnlocked();
    return this.keyPair!;
  }

  // --- Lock/unlock ---

  isUnlocked(): boolean {
    if (!this.encryptionKey || !this.data) return false;
    if (Date.now() - this.lockedAt > this.autoLockMs) {
      this.lock();
      return false;
    }
    return true;
  }

  lock(): void {
    this.encryptionKey = null;
    this.keyPair = null;
    this.data = null;
  }

  // --- Export/import ---

  async export(): Promise<string> {
    const raw = await this.storage.read();
    if (!raw) throw new Error("No vault to export");
    return raw;
  }

  static async import(
    exported: string,
    options: { passphrase: string; storage: StorageBackend },
  ): Promise<Vault> {
    await options.storage.write(exported);
    return Vault.open(options);
  }

  // --- Internal ---

  private ensureUnlocked(): void {
    if (!this.isUnlocked()) {
      throw new Error("Vault is locked");
    }
    this.lockedAt = Date.now(); // reset idle timer
  }

  private async save(): Promise<void> {
    if (!this.encryptionKey || !this.data || !this.keyPair || !this.vaultFile) {
      throw new Error("Cannot save: vault not initialized");
    }

    const plaintext = JSON.stringify({
      data: this.data,
      privateKey: base64urlEncode(this.keyPair.privateKey),
      keyId: this.keyPair.keyId,
    });

    const encoded = new TextEncoder().encode(plaintext);
    const { ciphertext, iv } = await encrypt(encoded, this.encryptionKey);

    this.vaultFile.vault = base64urlEncode(ciphertext);
    this.vaultFile.vault_iv = base64urlEncode(iv);
    this.vaultFile.updated_at = new Date().toISOString();

    await this.storage.write(JSON.stringify(this.vaultFile, null, 2));
  }
}
