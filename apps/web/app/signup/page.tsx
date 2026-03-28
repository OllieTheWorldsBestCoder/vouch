"use client";

import { useState } from "react";
import Link from "next/link";

type Path = null | "user" | "business";

export default function GetStartedPage() {
  const [path, setPath] = useState<Path>(null);

  return (
    <main className="flex-1 px-6 py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-12"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>

        {!path && (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Get started with Vouch
            </h1>
            <p className="text-muted mb-12 max-w-md">
              Choose your path. Users save their details for agent signups.
              Businesses accept agent signups on their site.
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <PathCard
                onClick={() => setPath("user")}
                icon={<UserIcon />}
                title="I use an AI agent"
                description="Set up Vouch so your agent can sign you up for things. Takes about 2 minutes."
                cta="Set up my vault"
              />
              <PathCard
                onClick={() => setPath("business")}
                icon={<BuildingIcon />}
                title="I have a website"
                description="Accept agent-driven signups on your site. Install the SDK in 15 minutes."
                cta="Add Vouch to my site"
              />
            </div>
          </div>
        )}

        {path === "user" && <UserPath onBack={() => setPath(null)} />}
        {path === "business" && <BusinessPath onBack={() => setPath(null)} />}
      </div>
    </main>
  );
}

/* ============================================================
   USER PATH
   ============================================================ */

function UserPath({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="animate-fade-up max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-foreground transition-colors mb-8 flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Choose a different path
      </button>

      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Set up Vouch
      </h1>
      <p className="text-muted mb-10">
        Two steps: create your encrypted vault, then connect it to your AI agent.
      </p>

      {/* Steps */}
      <div className="space-y-8">
        {/* Step 1: Install + create vault */}
        <StepBlock
          number={1}
          title="Create your vault"
          active={step >= 1}
          done={step > 1}
        >
          <p className="text-sm text-muted mb-4">
            Run this in your terminal. It asks for your name, email, and a password
            to encrypt everything. Your data stays in a single file on your device.
          </p>
          <CodeBlock
            code="npx @vouch/cli init"
            language="terminal"
          />
          <div className="mt-4 bg-code-bg rounded-xl p-4 text-sm font-mono text-code-fg leading-relaxed">
            <p className="text-amber-700">$ npx @vouch/cli init</p>
            <p className="mt-2">Setting up Vouch...</p>
            <p className="mt-1">What name should we use? <span className="text-foreground">Alex Johnson</span></p>
            <p>Email? <span className="text-foreground">alex@example.com</span></p>
            <p>Set a password to protect your vault: <span className="text-foreground">********</span></p>
            <p className="mt-2 text-success">Vault created at ~/.vouch/vault.json</p>
            <p className="text-success">Ed25519 signing key generated</p>
            <p className="text-muted mt-1">Your details are encrypted. Run `vouch status` to check.</p>
          </div>
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="mt-4 text-sm text-amber-700 hover:underline"
            >
              I&apos;ve done this, next step
            </button>
          )}
        </StepBlock>

        {/* Step 2: Connect to agent */}
        <StepBlock
          number={2}
          title="Connect to your agent"
          active={step >= 2}
          done={step > 2}
        >
          <p className="text-sm text-muted mb-4">
            Add Vouch&apos;s MCP tools to your AI agent so it can discover sites
            and sign you up. Choose your agent:
          </p>

          <AgentSetup />

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              className="mt-6 text-sm text-amber-700 hover:underline"
            >
              I&apos;ve done this, what&apos;s next?
            </button>
          )}
        </StepBlock>

        {/* Done */}
        {step >= 3 && (
          <div className="animate-fade-up bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="font-semibold">You&apos;re ready.</h3>
            </div>
            <p className="text-sm text-muted mb-4">
              Next time you ask your agent to sign you up for something, it&apos;ll
              check for Vouch support and handle it automatically. Try it:
            </p>
            <div className="bg-code-bg border border-card-border rounded-lg p-4 text-sm">
              <p className="text-muted italic">&quot;Sign me up for [any-site.com]&quot;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentSetup() {
  const [agent, setAgent] = useState<"claude" | "other">("claude");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setAgent("claude")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            agent === "claude"
              ? "bg-accent/15 text-amber-700 border border-accent/20"
              : "text-muted border border-card-border hover:text-foreground"
          }`}
        >
          Claude Code
        </button>
        <button
          onClick={() => setAgent("other")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            agent === "other"
              ? "bg-accent/15 text-amber-700 border border-accent/20"
              : "text-muted border border-card-border hover:text-foreground"
          }`}
        >
          Other MCP agent
        </button>
      </div>

      {agent === "claude" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Add the Vouch MCP server to Claude Code:
          </p>
          <CodeBlock
            code="claude mcp add vouch -- npx @vouch/mcp-server"
            language="terminal"
          />
          <p className="text-sm text-muted">
            That&apos;s it. Claude will now check for <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">.well-known/vouch.json</code> on
            any site you ask it to sign up for, and use your vault for the details.
          </p>
        </div>
      )}

      {agent === "other" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Install the MCP tools package and point your agent at the server:
          </p>
          <CodeBlock
            code="npm install -g @vouch/mcp-server"
            language="terminal"
          />
          <p className="text-sm text-muted">
            Then configure your agent&apos;s MCP settings to connect to:
          </p>
          <CodeBlock
            code="vouch-mcp-server --vault ~/.vouch/vault.json"
            language="terminal"
          />
          <p className="text-sm text-muted">
            The server exposes 5 tools: <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">vouch_discover</code>,{" "}
            <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">vouch_challenge</code>,{" "}
            <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">vouch_signup</code>,{" "}
            <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">vouch_status</code>,{" "}
            <code className="text-xs px-1 py-0.5 rounded bg-card border border-card-border font-mono">vouch_verify</code>.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BUSINESS PATH
   ============================================================ */

function BusinessPath({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="animate-fade-up max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-foreground transition-colors mb-8 flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Choose a different path
      </button>

      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Add Vouch to your site
      </h1>
      <p className="text-muted mb-10">
        Three steps: install the package, add the handler, deploy. Every AI agent
        will be able to discover your site and register users.
      </p>

      <div className="space-y-8">
        {/* Step 1: Install */}
        <StepBlock number={1} title="Install the SDK" active={step >= 1} done={step > 1}>
          <CodeBlock code="npm install @vouch/site" language="terminal" />
          <p className="text-sm text-muted mt-3">
            Works with any Node.js framework: Next.js, Express, Fastify, Hono.
          </p>
          {step === 1 && (
            <button onClick={() => setStep(2)} className="mt-4 text-sm text-amber-700 hover:underline">
              Installed, next step
            </button>
          )}
        </StepBlock>

        {/* Step 2: Add handler */}
        <StepBlock number={2} title="Add the signup handler" active={step >= 2} done={step > 2}>
          <p className="text-sm text-muted mb-4">
            Create an API route that handles agent signups. This one function serves
            the discovery manifest, validates consent tokens, and processes registrations.
          </p>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted font-mono">app/api/vouch/[...path]/route.ts</span>
            </div>
            <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-muted">
              <code>{businessCodeExample}</code>
            </pre>
          </div>

          <p className="text-sm text-muted mt-4">
            Then add a rewrite so agents can discover you:
          </p>
          <div className="bg-card border border-card-border rounded-xl overflow-hidden mt-3">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
              <span className="ml-0 text-xs text-muted font-mono">next.config.ts</span>
            </div>
            <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-muted">
              <code>{rewriteExample}</code>
            </pre>
          </div>

          {step === 2 && (
            <button onClick={() => setStep(3)} className="mt-4 text-sm text-amber-700 hover:underline">
              Added, next step
            </button>
          )}
        </StepBlock>

        {/* Step 3: Deploy */}
        <StepBlock number={3} title="Deploy" active={step >= 3} done={step > 3}>
          <p className="text-sm text-muted mb-4">
            Deploy your app. Once live, any AI agent can discover your signup
            requirements at:
          </p>
          <CodeBlock
            code="https://yoursite.com/.well-known/vouch.json"
            language="url"
          />
          <p className="text-sm text-muted mt-4">
            Test it by fetching the manifest:
          </p>
          <CodeBlock
            code="curl https://yoursite.com/.well-known/vouch.json | jq"
            language="terminal"
          />

          {step === 3 && (
            <button onClick={() => setStep(4)} className="mt-4 text-sm text-amber-700 hover:underline">
              Deployed
            </button>
          )}
        </StepBlock>

        {/* Done */}
        {step >= 4 && (
          <div className="animate-fade-up bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="font-semibold">Your site is Vouch-enabled.</h3>
            </div>
            <p className="text-sm text-muted">
              AI agents can now discover your site and sign up users with
              verified, cryptographic consent. No marketplace listing needed --
              the <code className="text-xs px-1 py-0.5 rounded bg-code-bg border border-card-border font-mono">.well-known/vouch.json</code> manifest
              is your storefront.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function PathCard({
  onClick,
  icon,
  title,
  description,
  cta,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-card border border-card-border rounded-xl p-6 text-left hover:border-accent/30 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-amber-700 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-5">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
        {cta}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function StepBlock({
  number,
  title,
  active,
  done,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`transition-opacity ${active ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            done
              ? "bg-success/15 text-success border border-success/20"
              : active
                ? "bg-accent/15 text-amber-700 border border-accent/20"
                : "bg-card border border-card-border text-muted"
          }`}
        >
          {done ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            number
          )}
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="ml-10">{children}</div>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative bg-code-bg border border-card-border rounded-lg px-4 py-3 font-mono text-sm">
      {language === "terminal" && <span className="text-muted select-none">$ </span>}
      <span className="text-foreground">{code}</span>
      <button
        onClick={copy}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

const businessCodeExample = `import { createVouchHandler } from "@vouch/site";

const handler = createVouchHandler({
  site: {
    name: "Your App",
    url: "https://yourapp.com",
    privacyUrl: "https://yourapp.com/privacy",
    termsUrl: "https://yourapp.com/terms",
  },
  fields: {
    required: [
      { field: "email", type: "email", label: "Email" },
      { field: "name", type: "string", label: "Name" },
    ],
  },
  onSignup: async (data, metadata) => {
    const user = await db.users.create({
      email: data.email,
      name: data.name,
      source: "vouch",
      agentId: metadata.agentName,
    });
    return { userId: user.id };
  },
});

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;`;

const rewriteExample = `// next.config.ts
const config = {
  rewrites: async () => [
    {
      source: "/.well-known/vouch.json",
      destination: "/api/vouch/manifest",
    },
  ],
};

export default config;`;
