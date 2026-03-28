// Schemas
export {
  AgentSignupDiscoverySchema,
  FieldRequirementSchema,
  ConsentScopeSchema,
  ConsentTokenPayloadSchema,
  SignupRequestSchema,
  SignupResponseSchema,
  SignupStatusSchema,
  ChallengeRequestSchema,
  ChallengeResponseSchema,
  PreAuthorizedPolicySchema,
  AgentSignupErrorSchema,
  ErrorCodeSchema,
  ErrorCodes,
  type AgentSignupDiscovery,
  type FieldRequirement,
  type ConsentScope,
  type ConsentTokenPayload,
  type SignupRequest,
  type SignupResponse,
  type SignupStatus,
  type ChallengeRequest,
  type ChallengeResponse,
  type PreAuthorizedPolicy,
  type AgentSignupError,
  type ErrorCode,
} from "./schemas/index.js";

// Crypto
export {
  generateKeyPair,
  sign,
  verify,
  fingerprint,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  canonicalHash,
  generateSalt,
  base64urlEncode,
  base64urlDecode,
  type KeyPair,
} from "./crypto/index.js";

// Tokens
export {
  createConsentToken,
  validateConsentToken,
  type CreateConsentTokenInput,
  type ValidateConsentTokenInput,
  type ValidateConsentTokenResult,
} from "./tokens/index.js";

// Errors
export { createError, isRetryable } from "./errors/index.js";

// Sensitive
export { SensitiveString } from "./sensitive.js";
