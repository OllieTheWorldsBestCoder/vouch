/**
 * Email verification flow.
 *
 * Generates 6-digit codes, tracks verification state, and enforces a
 * configurable TTL (default 30 minutes).
 */

interface VerificationEntry {
  signupId: string;
  userId: string;
  email: string;
  code: string;
  attempts: number;
  expiresAt: number;
  verified: boolean;
}

export class VerificationManager {
  private readonly entries = new Map<string, VerificationEntry>();
  private readonly maxAttempts = 5;
  private readonly defaultTtlMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(timeoutMinutes = 30) {
    this.defaultTtlMs = timeoutMinutes * 60 * 1_000;

    this.sweepTimer = setInterval(() => this.sweep(), 60_000);
    if (this.sweepTimer && typeof (this.sweepTimer as unknown as { unref?: () => void }).unref === "function") {
      (this.sweepTimer as unknown as { unref: () => void }).unref();
    }
  }

  /** Generate a 6-digit verification code and store the entry. */
  create(signupId: string, userId: string, email: string): string {
    const code = String(
      Math.floor(100_000 + Math.random() * 900_000),
    );

    this.entries.set(signupId, {
      signupId,
      userId,
      email,
      code,
      attempts: 0,
      expiresAt: Date.now() + this.defaultTtlMs,
      verified: false,
    });

    return code;
  }

  /** Verify a code for a signup. Returns the userId on success. */
  verify(
    signupId: string,
    code: string,
  ): { success: true; userId: string } | { success: false; error: string } {
    const entry = this.entries.get(signupId);
    if (!entry) {
      return { success: false, error: "Verification not found" };
    }
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(signupId);
      return { success: false, error: "Verification expired" };
    }
    if (entry.verified) {
      return { success: false, error: "Already verified" };
    }
    entry.attempts += 1;
    if (entry.attempts > this.maxAttempts) {
      this.entries.delete(signupId);
      return { success: false, error: "Too many attempts" };
    }
    if (entry.code !== code) {
      return { success: false, error: "Invalid code" };
    }
    entry.verified = true;
    return { success: true, userId: entry.userId };
  }

  /** Check whether a signup has been verified. */
  isVerified(signupId: string): boolean {
    return this.entries.get(signupId)?.verified === true;
  }

  /** Get the email associated with a signup's verification. */
  getEmail(signupId: string): string | undefined {
    return this.entries.get(signupId)?.email;
  }

  /** Remove expired entries. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }

  /** Stop the background sweep timer. */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
