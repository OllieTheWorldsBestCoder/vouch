"use client";

import { useState } from "react";

type Tab = "users" | "businesses" | "developers";

export function AudienceTabs() {
  const [active, setActive] = useState<Tab>("users");

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 p-1 bg-card rounded-xl border border-card-border mb-8 max-w-md">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[420px]">
        {active === "users" && <UsersContent />}
        {active === "businesses" && <BusinessesContent />}
        {active === "developers" && <DevelopersContent />}
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "For you" },
  { id: "businesses", label: "For business" },
  { id: "developers", label: "For developers" },
];

function UsersContent() {
  return (
    <div className="animate-fade-up grid lg:grid-cols-2 gap-12 items-start">
      <div>
        <h3 className="text-2xl font-bold tracking-tight mb-3">
          Fill out your details once. Never again.
        </h3>
        <p className="text-muted leading-relaxed mb-6">
          Your AI agent discovers what a site needs, shows you what it&apos;ll share,
          and handles the rest. Your details stay encrypted on your device.
        </p>
        <div className="space-y-4">
          <Feature
            title="Encrypted on your device"
            description="AES-256 encryption. No cloud. No accounts. One file you own."
          />
          <Feature
            title="You approve every signup"
            description="See exactly what's shared before it's sent. Or set rules to auto-approve trusted sites."
          />
          <Feature
            title="Works everywhere"
            description="Even on sites that haven't installed Vouch, your agent opens the page and fills in the form."
          />
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-3 text-sm">
          <ChatBubble from="user">Sign me up for acme.com</ChatBubble>
          <ChatBubble from="agent">
            <span className="block mb-3">Sign up for ACME?</span>
            <span className="block text-xs text-muted mb-2 uppercase tracking-wider">They&apos;ll get</span>
            <span className="block">Alex Johnson</span>
            <span className="block text-muted">alex@example.com</span>
          </ChatBubble>
          <ChatBubble from="user">Go for it</ChatBubble>
          <ChatBubble from="agent">Done. Check your email to verify.</ChatBubble>
        </div>
      </div>
    </div>
  );
}

function BusinessesContent() {
  return (
    <div className="animate-fade-up grid lg:grid-cols-2 gap-12 items-start">
      <div>
        <h3 className="text-2xl font-bold tracking-tight mb-3">
          A new signup channel. Zero friction.
        </h3>
        <p className="text-muted leading-relaxed mb-6">
          Millions of people use AI agents daily. When they say &quot;sign me up,&quot;
          your site should be ready. Vouch lets agents register users for you
          with verified, consented data.
        </p>
        <div className="space-y-4">
          <Feature
            title="Higher conversion"
            description="Agent signups complete in seconds. No form abandonment. No typos."
          />
          <Feature
            title="Verified data"
            description="Cryptographic consent proves the user approved. Email verification built in."
          />
          <Feature
            title="New acquisition channel"
            description="Be discoverable to every AI agent. Your .well-known/vouch.json is your storefront."
          />
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-accent">3s</div>
          <div className="text-sm text-muted">Average signup time<br />vs 45s for traditional forms</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-accent">0%</div>
          <div className="text-sm text-muted">Form abandonment<br />Agent completes every signup it starts</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-accent">100%</div>
          <div className="text-sm text-muted">Verified consent<br />Cryptographic proof the user approved</div>
        </div>
      </div>
    </div>
  );
}

function DevelopersContent() {
  return (
    <div className="animate-fade-up grid lg:grid-cols-2 gap-12 items-start">
      <div>
        <h3 className="text-2xl font-bold tracking-tight mb-3">
          One function. That&apos;s the integration.
        </h3>
        <p className="text-muted leading-relaxed mb-6">
          Install the package. Define your fields. Write your signup handler.
          Vouch serves the discovery manifest, validates consent tokens, and handles
          verification.
        </p>
        <div className="space-y-4">
          <Feature
            title="15-minute integration"
            description="npm install, one function, two route handlers. Works with Next.js, Express, Fastify."
          />
          <Feature
            title="MCP + REST"
            description="Agents discover your site via .well-known/vouch.json. MCP tools and REST API included."
          />
          <Feature
            title="Open protocol"
            description="No vendor lock-in. Ed25519 signatures, JWS tokens, Zod schemas. Implement from spec if you want."
          />
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          <span className="ml-3 text-xs text-muted font-mono">route.ts</span>
        </div>
        <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-muted">
          <code>{`import { createVouchHandler } from "@vouch/site";

const handler = createVouchHandler({
  site: {
    name: "Your App",
    url: "https://yourapp.com",
  },
  fields: {
    required: [
      { field: "email", type: "email" },
      { field: "name", type: "string" },
    ],
  },
  onSignup: async (data) => {
    const user = await db.users.create({
      email: data.email,
      name: data.name,
    });
    return { userId: user.id };
  },
});

export const GET = handler.GET;
export const POST = handler.POST;`}</code>
        </pre>
      </div>
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
      <div>
        <p className="text-sm font-medium mb-0.5">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function ChatBubble({
  from,
  children,
}: {
  from: "user" | "agent";
  children: React.ReactNode;
}) {
  return (
    <div className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl leading-relaxed ${
          from === "user"
            ? "bg-accent/15 text-accent border border-accent/20 rounded-br-md"
            : "bg-[#1e1e22] border border-card-border rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
