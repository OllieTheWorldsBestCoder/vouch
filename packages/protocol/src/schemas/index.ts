export {
  AgentSignupDiscoverySchema,
  FieldRequirementSchema,
  ConsentScopeSchema,
  type AgentSignupDiscovery,
  type FieldRequirement,
  type ConsentScope,
} from "./discovery.js";

export {
  ConsentTokenPayloadSchema,
  type ConsentTokenPayload,
} from "./consent.js";

export {
  SignupRequestSchema,
  SignupResponseSchema,
  SignupStatusSchema,
  type SignupRequest,
  type SignupResponse,
  type SignupStatus,
} from "./signup.js";

export {
  ChallengeRequestSchema,
  ChallengeResponseSchema,
  type ChallengeRequest,
  type ChallengeResponse,
} from "./challenge.js";

export {
  PreAuthorizedPolicySchema,
  type PreAuthorizedPolicy,
} from "./policy.js";

export {
  AgentSignupErrorSchema,
  ErrorCodeSchema,
  ErrorCodes,
  type AgentSignupError,
  type ErrorCode,
} from "./error.js";
