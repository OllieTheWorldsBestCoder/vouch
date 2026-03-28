// Main API
export { createAgentSignupHandler } from "./handler.js";
export type { AgentSignupHandler } from "./handler.js";

// Configuration types
export type {
  AgentSignupConfig,
  FieldConfig,
  CustomFieldConfig,
  PasswordPolicy,
  SignupMetadata,
  NonceStore,
  HandlerResult,
} from "./types.js";

// Subsystem exports (for advanced usage / custom stores)
export { MemoryNonceStore } from "./nonce.js";
export { VerificationManager } from "./verification.js";
export { RateLimiter } from "./rate-limit.js";
export { buildManifest } from "./manifest.js";
