// Vault
export {
  Vault,
  FileStorage,
  LocalStorageBackend,
  MemoryStorage,
  defaultVaultPath,
  type StorageBackend,
  type VaultData,
  type SignupHistoryEntry,
  type PolicyEntry,
} from "./vault/index.js";

// Consent
export {
  ConsentManager,
  type ConsentRequest,
  type ConsentResult,
  type ConsentApproved,
  type ConsentDenied,
} from "./consent.js";

// Password
export { generatePassword, type PasswordPolicy } from "./password.js";
