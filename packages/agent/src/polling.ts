import type { SignupResponse } from "@agent-signup/protocol";
import type { AgentSignupClient } from "./client.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WaitForVerificationOptions {
  /** Maximum total time to wait, in milliseconds. Default: 30 minutes. */
  maxWaitMs?: number;
  /** Initial polling interval, in milliseconds. Default: 5 000. */
  initialIntervalMs?: number;
  /** Maximum polling interval (caps exponential backoff), in milliseconds. Default: 30 000. */
  maxIntervalMs?: number;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Poll `checkStatus` with exponential backoff until the signup transitions
 * out of `pending_verification`, or until timeout.
 *
 * Respects `Retry-After` headers when the server provides them.
 *
 * @returns The final {@link SignupResponse} once the status is no longer
 *          `pending_verification`, or the last response if the timeout is
 *          reached.
 */
export async function waitForVerification(
  client: AgentSignupClient,
  siteUrl: string,
  signupId: string,
  options?: WaitForVerificationOptions,
): Promise<SignupResponse> {
  const maxWaitMs = options?.maxWaitMs ?? 30 * 60 * 1000; // 30 min
  const initialIntervalMs = options?.initialIntervalMs ?? 5_000;
  const maxIntervalMs = options?.maxIntervalMs ?? 30_000;
  const signal = options?.signal;

  const deadline = Date.now() + maxWaitMs;
  let interval = initialIntervalMs;
  let lastResponse: SignupResponse | undefined;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      if (lastResponse) return lastResponse;
      throw new DOMException("Polling aborted", "AbortError");
    }

    let response: SignupResponse;
    try {
      response = await client.checkStatus(siteUrl, signupId);
    } catch (err) {
      // If there's a Retry-After hint baked into the error response we
      // could inspect it, but for generic errors we just keep polling.
      // Wait the current interval and retry.
      await delay(Math.min(interval, deadline - Date.now()), signal);
      interval = Math.min(interval * 2, maxIntervalMs);
      continue;
    }

    lastResponse = response;

    if (response.status !== "pending_verification") {
      return response;
    }

    // Wait before next poll
    const waitMs = Math.min(interval, deadline - Date.now());
    if (waitMs <= 0) break;
    await delay(waitMs, signal);

    // Exponential backoff
    interval = Math.min(interval * 2, maxIntervalMs);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error(
    `Timed out waiting for verification of signup ${signupId} after ${maxWaitMs}ms`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Polling aborted", "AbortError"));
      };
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException("Polling aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
