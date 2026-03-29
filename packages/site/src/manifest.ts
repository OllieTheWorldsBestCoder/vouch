import type { AgentSignupDiscovery } from "@vouchagents/protocol";
import type { AgentSignupConfig, FieldConfig, CustomFieldConfig } from "./types.js";

/**
 * Build the `.well-known/agent-signup.json` discovery document from the
 * site developer's configuration object.
 */
export function buildManifest(config: AgentSignupConfig): AgentSignupDiscovery {
  const base = config.site.url.replace(/\/+$/, "");

  const mapField = (
    f: FieldConfig | CustomFieldConfig,
    required: boolean,
  ) => ({
    field: f.field,
    type: f.type,
    required,
    ...(f.description ? { description: f.description } : {}),
    ...(f.validation ? { validation: f.validation } : {}),
    ...(f.purpose ? { purpose: f.purpose } : {}),
  });

  const requiredFields = config.fields.required.map((f) => mapField(f, true));
  const optionalFields = [
    ...(config.fields.optional ?? []).map((f) => mapField(f, false)),
    ...(config.fields.custom ?? []).map((f) => mapField(f, false)),
  ];

  // Build consent scopes from required fields
  const allFields = [
    ...config.fields.required.map((f) => f.field),
    ...(config.fields.optional ?? []).map((f) => f.field),
    ...(config.fields.custom ?? []).map((f) => f.field),
  ];

  const scopes = [
    {
      scope: "account_creation",
      fields: allFields,
      description: `Create an account on ${config.site.name}`,
    },
  ];

  const requiresVerification =
    config.verification?.method === "email";

  const rateLimit = config.rateLimit
    ? {
        requests_per_minute: config.rateLimit.perMinute ?? 10,
        burst: config.rateLimit.perMinute ?? 10,
      }
    : undefined;

  return {
    protocol_version: "1.0",
    issuer: base,
    updated_at: new Date().toISOString(),

    endpoints: {
      signup: `${base}/agent-signup/signup`,
      challenge: `${base}/agent-signup/challenge`,
      status: `${base}/agent-signup/status`,
      verify: requiresVerification
        ? `${base}/agent-signup/verify`
        : undefined,
    },

    fields: {
      required: requiredFields,
      optional: optionalFields,
    },

    consent: {
      scopes,
      token_max_age_seconds: 300,
      requires_email_verification: requiresVerification,
    },

    security: {
      supported_algorithms: ["EdDSA"],
      challenge_required: true,
      ...(rateLimit ? { rate_limit: rateLimit } : {}),
    },

    branding: {
      name: config.site.name,
      logo_url: config.site.logoUrl,
      privacy_policy_url: config.site.privacyUrl,
      terms_url: config.site.termsUrl,
      data_retention: config.site.dataRetention,
    },
  };
}
