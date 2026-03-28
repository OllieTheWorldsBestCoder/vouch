/**
 * Heuristic signup-page finder for sites that do NOT implement the
 * agent-signup protocol.  Probes common paths with HEAD requests and
 * returns the first one that responds with HTTP 200.
 */

const COMMON_SIGNUP_PATHS = [
  "/signup",
  "/register",
  "/join",
  "/create-account",
  "/sign-up",
  "/get-started",
] as const;

/**
 * Attempt to locate a signup page on a site by checking common paths.
 *
 * @param siteUrl - The base URL of the site (e.g. `https://example.com`).
 * @returns The full URL of the first path that returns a 200, or `null`.
 */
export async function findSignupPage(
  siteUrl: string,
): Promise<string | null> {
  for (const path of COMMON_SIGNUP_PATHS) {
    const url = new URL(path, siteUrl).href;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
      });
      if (res.ok) {
        return url;
      }
    } catch {
      // Network error — skip this path
    }
  }
  return null;
}
