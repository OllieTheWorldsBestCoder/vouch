import { z } from "zod";

export const ChallengeRequestSchema = z.object({
  public_key: z.string(),
  site: z.string().url(),
});

export const ChallengeResponseSchema = z.object({
  nonce: z.string(),
  expires_at: z.string().datetime(),
});

export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;
