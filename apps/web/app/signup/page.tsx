"use client";

import { useState } from "react";
import Link from "next/link";

type Path = null | "user" | "business";

export default function GetStartedPage() {
  const [path, setPath] = useState<Path>(null);

  return (
    <main id="main-content" className="flex-1 px-6 py-24">
      <div className="max-w-4xl mx-auto">
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
            <h1 className="font-display text-4xl tracking-tight mb-3">
              Get started with Vouch
            </h1>
            <p className="text-muted mb-12 max-w-md">
              Choose your path. Users set up their agent. Businesses add the SDK.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <PathCard
                onClick={() => setPath("user")}
                icon={<UserIcon />}
                title="I use an AI agent"
                description="One command. Your agent handles the rest. Takes 30 seconds."
                cta="Set up Vouch"
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
   USER PATH - One command, agent handles the rest
   ============================================================ */

function UserPath({ onBack }: { onBack: () => void }) {
  const [done, setDone] = useState(false);
  const [agent, setAgent] = useState<"claude" | "other">("claude");

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

      <h1 className="font-display text-4xl tracking-tight mb-3">
        One command. That&apos;s it.
      </h1>
      <p className="text-muted mb-8">
        Paste this into your terminal. It connects Vouch to your agent. The first time you ask it to sign you up for something, it sets up your details automatically.
      </p>

      {/* Agent selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setAgent("claude")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            agent === "claude"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "text-muted border border-card-border hover:text-foreground"
          }`}
        >
          Claude Code
        </button>
        <button
          onClick={() => setAgent("other")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            agent === "other"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "text-muted border border-card-border hover:text-foreground"
          }`}
        >
          Other MCP agent
        </button>
      </div>

      {agent === "claude" && (
        <div className="space-y-4">
          <CodeBlock code="claude mcp add vouch -- npx @vouchagents/mcp-server" language="terminal" />
          <p className="text-sm text-muted">
            Paste this into your terminal. That&apos;s the entire setup.
          </p>
        </div>
      )}

      {agent === "other" && (
        <div className="space-y-4">
          <CodeBlock code="npx @vouchagents/mcp-server" language="terminal" />
          <p className="text-sm text-muted">
            Point your agent&apos;s MCP settings at this server. It exposes 6 tools for discovering sites and signing you up.
          </p>
        </div>
      )}

      {/* What happens next */}
      <div className="mt-10 border-t border-card-border pt-8">
        <p className="text-sm font-semibold mb-4">What happens next</p>
        <div className="bg-code-bg rounded-xl p-5 text-sm font-mono text-code-fg leading-relaxed space-y-2">
          <p><span className="text-zinc-500">You:</span> <span className="text-zinc-100">&quot;Sign me up for acme.com&quot;</span></p>
          <p><span className="text-zinc-500">Agent:</span> <span className="text-zinc-300">&quot;I need to set up Vouch first. What name should I use?&quot;</span></p>
          <p><span className="text-zinc-500">You:</span> <span className="text-zinc-100">&quot;Alex Johnson&quot;</span></p>
          <p><span className="text-zinc-500">Agent:</span> <span className="text-zinc-300">&quot;Email?&quot;</span></p>
          <p><span className="text-zinc-500">You:</span> <span className="text-zinc-100">&quot;alex@example.com&quot;</span></p>
          <p><span className="text-zinc-500">Agent:</span> <span className="text-zinc-300">&quot;Set a password to protect your details:&quot;</span></p>
          <p><span className="text-zinc-500">You:</span> <span className="text-zinc-100">&quot;********&quot;</span></p>
          <p className="pt-1"><span className="text-zinc-500">Agent:</span> <span className="text-emerald-400">&quot;Done. Signed up for ACME. Check your email.&quot;</span></p>
          <p className="text-zinc-600 pt-2 text-xs">Your details are saved. Next signup is instant.</p>
        </div>
      </div>

      {!done && (
        <button onClick={() => setDone(true)} className="mt-8 text-sm text-amber-700 hover:underline">
          I&apos;ve pasted the command
        </button>
      )}

      {done && (
        <div className="mt-8 animate-fade-up bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="font-semibold">You&apos;re ready.</h3>
          </div>
          <p className="text-sm text-muted">
            Ask your agent to sign you up for anything. It&apos;ll walk you through saving your details the first time, then handle everything automatically after that.
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

      <h1 className="font-display text-4xl tracking-tight mb-3">
        Add Vouch to your site
      </h1>
      <p className="text-muted mb-10">
        Three steps: install, add the handler, deploy. Every AI agent will discover your site.
      </p>

      <div className="space-y-8">
        <StepBlock number={1} title="Install the SDK" active={step >= 1} done={step > 1}>
          <CodeBlock code="npm install @vouchagents/site" language="terminal" />
          <p className="text-sm text-muted mt-3">
            Works with Next.js, Express, Fastify, Hono -- any Node.js framework.
          </p>
          {step === 1 && (
            <button onClick={() => setStep(2)} className="mt-4 text-sm text-amber-700 hover:underline">
              Installed, next step
            </button>
          )}
        </StepBlock>

        <StepBlock number={2} title="Add the signup handler" active={step >= 2} done={step > 2}>
          <p className="text-sm text-muted mb-4">
            One function that serves the discovery manifest, validates consent, and processes signups.
          </p>
          <div className="bg-code-bg border border-card-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-zinc-500 font-mono">route.ts</span>
            </div>
            <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-code-fg">
              <code>{businessCodeExample}</code>
            </pre>
          </div>
          {step === 2 && (
            <button onClick={() => setStep(3)} className="mt-4 text-sm text-amber-700 hover:underline">
              Added, next step
            </button>
          )}
        </StepBlock>

        <StepBlock number={3} title="Deploy" active={step >= 3} done={step > 3}>
          <p className="text-sm text-muted mb-4">
            Deploy your app. Test by fetching the manifest:
          </p>
          <CodeBlock code="curl https://yoursite.com/.well-known/vouch.json | jq" language="terminal" />
          {step === 3 && (
            <button onClick={() => setStep(4)} className="mt-4 text-sm text-amber-700 hover:underline">
              Deployed
            </button>
          )}
        </StepBlock>

        {step >= 4 && (
          <div className="animate-fade-up bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="font-semibold">Your site is Vouch-enabled.</h3>
            </div>
            <p className="text-sm text-muted">
              AI agents can now discover your site and sign up users with verified consent. No marketplace listing needed.
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

function PathCard({ onClick, icon, title, description, cta }: {
  onClick: () => void; icon: React.ReactNode; title: string; description: string; cta: string;
}) {
  return (
    <button onClick={onClick} className="group bg-card border border-card-border rounded-xl p-6 text-left hover:border-accent/30 transition-all">
      <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-5">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-amber-700 transition-colors">{title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-5">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
        {cta}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </button>
  );
}

function StepBlock({ number, title, active, done, children }: {
  number: number; title: string; active: boolean; done: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`transition-opacity ${active ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          done ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : active ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-card border border-card-border text-muted"
        }`}>
          {done ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : number}
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
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="group relative bg-code-bg border border-card-border rounded-lg px-4 py-3 font-mono text-sm">
      {language === "terminal" && <span className="text-zinc-500 select-none">$ </span>}
      <span className="text-code-fg">{code}</span>
      <button onClick={copy} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function UserIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}

function BuildingIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" /></svg>;
}

const businessCodeExample = `import { createVouchHandler } from "@vouchagents/site";

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
  onSignup: async (data) => {
    const user = await db.users.create({
      email: data.email,
      name: data.name,
      source: "vouch",
    });
    return { userId: user.id };
  },
});

export const GET = handler.GET;
export const POST = handler.POST;`;
