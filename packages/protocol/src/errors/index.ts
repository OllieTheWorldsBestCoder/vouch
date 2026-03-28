import { ErrorCodes, type ErrorCode, type AgentSignupError } from "../schemas/error.js";

export { ErrorCodes, type ErrorCode, type AgentSignupError };

/** Create a structured Agent Signup error response. */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): AgentSignupError {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      request_id: crypto.randomUUID(),
    },
  };
}

/** Check if an error code is retryable. */
export function isRetryable(code: ErrorCode): boolean {
  return code === "RATE_LIMITED" || code === "INTERNAL_ERROR";
}
