import { z } from "zod";

export const FieldRequirementSchema = z.object({
  field: z.string(),
  type: z.enum([
    "string",
    "email",
    "phone",
    "date",
    "boolean",
    "address",
    "url",
  ]),
  required: z.boolean(),
  description: z.string().optional(),
  validation: z.string().optional(),
  purpose: z.string().optional(),
});

export const ConsentScopeSchema = z.object({
  scope: z.string(),
  fields: z.array(z.string()),
  description: z.string(),
});

export const AgentSignupDiscoverySchema = z.object({
  protocol_version: z.literal("1.0"),
  issuer: z.string().url(),
  updated_at: z.string().datetime(),

  endpoints: z.object({
    signup: z.string(),
    challenge: z.string(),
    status: z.string(),
    verify: z.string().optional(),
    mcp: z.string().optional(),
  }),

  fields: z.object({
    required: z.array(FieldRequirementSchema),
    optional: z.array(FieldRequirementSchema),
  }),

  consent: z.object({
    scopes: z.array(ConsentScopeSchema),
    token_max_age_seconds: z.number().default(300),
    requires_email_verification: z.boolean().default(true),
  }),

  security: z.object({
    supported_algorithms: z.array(z.string()).default(["EdDSA"]),
    challenge_required: z.boolean().default(true),
    rate_limit: z
      .object({
        requests_per_minute: z.number(),
        burst: z.number(),
      })
      .optional(),
  }),

  branding: z.object({
    name: z.string(),
    logo_url: z.string().url().optional(),
    privacy_policy_url: z.string().url(),
    terms_url: z.string().url(),
    data_retention: z.string().optional(),
  }),
});

export type AgentSignupDiscovery = z.infer<typeof AgentSignupDiscoverySchema>;
export type FieldRequirement = z.infer<typeof FieldRequirementSchema>;
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;
