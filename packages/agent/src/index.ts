export { AgentSignupClient, AgentSignupClientError } from "./client.js";
export type { StatusResponse, VerificationResponse } from "./client.js";

export { DiscoveryCache, discoverSite } from "./discovery.js";

export { waitForVerification } from "./polling.js";
export type { WaitForVerificationOptions } from "./polling.js";

export { findSignupPage } from "./signup-finder.js";
