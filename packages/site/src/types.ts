import type { AgentSignupError } from "@vouchagents/protocol";

// ---------------------------------------------------------------------------
// Field configuration
// ---------------------------------------------------------------------------

export interface FieldConfig {
  field: string;
  type: "string" | "email" | "phone" | "date" | "boolean" | "address" | "url";
  description?: string;
  validation?: string;
  purpose?: string;
}

export interface CustomFieldConfig extends FieldConfig {
  label: string;
}

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

export interface PasswordPolicy {
  minLength: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSymbols?: boolean;
}

// ---------------------------------------------------------------------------
// Signup metadata passed to the onSignup callback
// ---------------------------------------------------------------------------

export interface SignupMetadata {
  signupId: string;
  agentName: string;
  agentVersion: string;
  mcpSessionId?: string;
  consentMode: "explicit" | "pre_authorized";
  purpose: string;
  fields: string[];
  ipAddress?: string;
}

// ---------------------------------------------------------------------------
// Nonce store interface
// ---------------------------------------------------------------------------

export interface NonceStore {
  /** Store a nonce with its associated public key. Returns true on success. */
  create(nonce: string, publicKey: string, ttlMs: number): Promise<boolean>;
  /** Consume a nonce. Returns the associated public key if valid, null otherwise. */
  consume(nonce: string): Promise<string | null>;
  /** Check if a nonce exists without consuming it. */
  exists(nonce: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Main configuration
// ---------------------------------------------------------------------------

export interface AgentSignupConfig {
  site: {
    name: string;
    url: string;
    privacyUrl: string;
    termsUrl: string;
    logoUrl?: string;
    dataRetention?: string;
  };

  fields: {
    required: FieldConfig[];
    optional?: FieldConfig[];
    custom?: CustomFieldConfig[];
  };

  password?: {
    required: boolean;
    policy: PasswordPolicy;
  };

  verification?: {
    method: "email" | "none";
    timeoutMinutes?: number;
    sendEmail?: (
      to: string,
      code: string,
      magicLink: string,
    ) => Promise<void>;
  };

  onSignup: (
    data: Record<string, unknown>,
    metadata: SignupMetadata,
  ) => Promise<{ userId: string }>;

  onVerified?: (signupId: string, userId: string) => Promise<void>;
  onFailed?: (signupId: string, error: AgentSignupError) => Promise<void>;
  onExpired?: (signupId: string) => Promise<void>;

  rateLimit?: {
    perMinute?: number;
    perHour?: number;
  };

  store?: "memory" | NonceStore;
}

// ---------------------------------------------------------------------------
// Handler result type (returned from GET / POST / DELETE handlers)
// ---------------------------------------------------------------------------

export interface HandlerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}
