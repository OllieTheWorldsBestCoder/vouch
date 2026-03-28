import { z } from "zod";

export const PreAuthorizedPolicySchema = z.object({
  policy_id: z.string().uuid(),
  user_key_id: z.string(),
  scopes: z.array(z.string()),
  field_allowlist: z.array(z.string()),
  site_patterns: z.array(z.string()),
  max_uses: z.number().optional(),
  remaining_uses: z.number().optional(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
});

export type PreAuthorizedPolicy = z.infer<typeof PreAuthorizedPolicySchema>;
