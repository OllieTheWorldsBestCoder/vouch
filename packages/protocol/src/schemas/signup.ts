import { z } from "zod";

export const SignupStatusSchema = z.enum([
  "pending_verification",
  "active",
  "rejected",
  "expired",
]);

export const SignupRequestSchema = z.object({
  consent_token: z.string(),
  data: z.record(z.unknown()),
  agent: z.object({
    name: z.string(),
    version: z.string(),
    mcp_session_id: z.string().optional(),
  }),
  idempotency_key: z.string().uuid(),
});

export const SignupResponseSchema = z.object({
  signup_id: z.string(),
  status: SignupStatusSchema,
  verification: z.object({
    required: z.boolean(),
    method: z.enum(["email", "phone", "none"]),
    sent_to: z.string().optional(),
  }),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
});

export type SignupStatus = z.infer<typeof SignupStatusSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type SignupResponse = z.infer<typeof SignupResponseSchema>;
