import { z } from "zod";

export const ConsentTokenPayloadSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  aud: z.string(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string(),

  scope: z.object({
    fields: z.array(z.string()),
    purpose: z.enum([
      "account_creation",
      "identity_verification",
      "newsletter_signup",
    ]),
    site_endpoint: z.string(),
  }),

  data_hash: z.string(),
  consent_mode: z.enum(["explicit", "pre_authorized"]),
  policy_id: z.string().optional(),
  user_presence: z.string().optional(),

  pow: z
    .object({
      challenge: z.string(),
      nonce: z.string(),
      difficulty: z.number(),
    })
    .optional(),
});

export type ConsentTokenPayload = z.infer<typeof ConsentTokenPayloadSchema>;
