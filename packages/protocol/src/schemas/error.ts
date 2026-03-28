import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "DISCOVERY_NOT_FOUND",
  "INVALID_CONSENT_TOKEN",
  "CONSENT_EXPIRED",
  "CONSENT_SCOPE_MISMATCH",
  "CHALLENGE_EXPIRED",
  "CHALLENGE_REUSE",
  "INVALID_SIGNATURE",
  "MISSING_REQUIRED_FIELD",
  "FIELD_VALIDATION_FAILED",
  "DUPLICATE_SIGNUP",
  "RATE_LIMITED",
  "VERIFICATION_FAILED",
  "SIGNUP_EXPIRED",
  "INTERNAL_ERROR",
]);

export const AgentSignupErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    request_id: z.string(),
  }),
});

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type AgentSignupError = z.infer<typeof AgentSignupErrorSchema>;

export const ErrorCodes = ErrorCodeSchema.enum;
