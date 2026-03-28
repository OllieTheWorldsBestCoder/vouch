import {
  createConsentToken,
  canonicalHash,
  SensitiveString,
  type AgentSignupDiscovery,
} from "@agent-signup/protocol";
import type { Vault } from "./vault/vault.js";

export interface ConsentRequest {
  site: AgentSignupDiscovery["branding"] & { url: string };
  requestedFields: {
    required: Array<{ field: string }>;
    optional?: Array<{ field: string }>;
  };
  nonce: string;
  siteEndpoint: string;
  agentId?: string;
}

export interface ConsentApproved {
  approved: true;
  token: string;
  fields: Record<string, string>;
}

export interface ConsentDenied {
  approved: false;
  reason: "user_denied" | "timeout" | "missing_fields" | "vault_locked";
}

export type ConsentResult = ConsentApproved | ConsentDenied;

export class ConsentManager {
  constructor(private vault: Vault) {}

  /** Request consent for a signup. Checks for matching auto-approve policies first. */
  async requestConsent(request: ConsentRequest): Promise<ConsentResult> {
    if (!this.vault.isUnlocked()) {
      return { approved: false, reason: "vault_locked" };
    }

    const requiredFieldNames = request.requestedFields.required.map(
      (f) => f.field,
    );

    // Check for matching auto-approve policy
    const policy = await this.vault.findMatchingPolicy(
      request.site.url,
      requiredFieldNames,
    );

    // Get the field values
    const fields = await this.vault.getFieldsRaw(requiredFieldNames);

    // Check all required fields are available
    const missing = requiredFieldNames.filter((f) => !fields[f]);
    if (missing.length > 0) {
      return { approved: false, reason: "missing_fields" };
    }

    // Create consent token
    const keyPair = this.vault.getKeyPair();
    const token = await createConsentToken({
      userKeyPair: keyPair,
      agentId: request.agentId ?? "unknown-agent",
      audience: request.site.url,
      nonce: request.nonce,
      fields: requiredFieldNames,
      data: fields,
      purpose: "account_creation",
      consentMode: policy ? "pre_authorized" : "explicit",
      siteEndpoint: request.siteEndpoint,
      policyId: policy?.id,
    });

    // Decrement policy uses if auto-approved
    if (policy && policy.remainingUses !== undefined) {
      policy.remainingUses--;
    }

    return { approved: true, token, fields };
  }
}
