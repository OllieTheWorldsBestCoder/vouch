"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "users" | "businesses" | "developers";

export function AudienceTabs() {
  const [active, setActive] = useState<Tab>("users");

  return (
    <div>
      <div className="flex gap-1 p-1 bg-surface rounded-lg border border-card-border mb-10 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "users" && <UsersContent />}
      {active === "businesses" && <BusinessesContent />}
      {active === "developers" && <DevelopersContent />}
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
    <div className="animate-fade-up">
      <div className="grid lg:grid-cols-5 gap-10 items-start">
        <div className="lg:col-span-3">
          <h3 className="font-display text-3xl mb-3 text-foreground">
            Fill out your details once.<br />Never again.
          </h3>
          <p className="text-muted leading-relaxed mb-8 max-w-md">
            Your AI agent discovers what a site needs, shows you what it&apos;ll share,
            and handles the rest. Everything stays encrypted on your device.
          </p>

          <div className="space-y-5 mb-8">
            <Feature title="Encrypted on your device" description="One file, one password. No cloud. No accounts." />
            <Feature title="You approve every signup" description="See exactly what's shared. Or set rules to auto-approve trusted sites." />
            <Feature title="Works even without Vouch" description="Your agent opens the page and fills the form with your saved details." />
          </div>

          <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
            Set up your vault
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>

        <div className="lg:col-span-2 bg-code-bg rounded-xl p-5 text-sm space-y-2.5">
          <ChatBubble from="user">Sign me up for acme.com</ChatBubble>
          <ChatBubble from="agent">Sign up for ACME? They&apos;ll get your name and email.</ChatBubble>
          <ChatBubble from="user">Go for it</ChatBubble>
          <ChatBubble from="agent">Done. Check your email.</ChatBubble>
        </div>
      </div>
    </div>
  );
}

function BusinessesContent() {
  return (
    <div className="animate-fade-up">
      <div className="grid lg:grid-cols-5 gap-10 items-start">
        <div className="lg:col-span-3">
          <h3 className="font-display text-3xl mb-3 text-foreground">
            A new signup channel.<br />Zero friction.
          </h3>
          <p className="text-muted leading-relaxed mb-8 max-w-md">
            Millions use AI agents daily. When they say &quot;sign me up,&quot;
            your site should be ready. Vouch lets agents register users with
            verified, consented data.
          </p>

          <div className="space-y-5 mb-8">
            <Feature title="Higher conversion" description="Agent signups complete in seconds. No form abandonment, no typos." />
            <Feature title="Verified data" description="Cryptographic consent proves the user approved. Email verification built in." />
            <Feature title="Discoverable by every agent" description="Your .well-known/vouch.json is your storefront. No marketplace listing needed." />
          </div>

          <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
            Add Vouch to your site
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Stat value="~3s" label="Average signup" detail="vs 45s for forms" />
          <Stat value="0%" label="Form abandonment" detail="Agents complete every signup" />
          <Stat value="100%" label="Verified consent" detail="Cryptographic proof" />
        </div>
      </div>
    </div>
  );
}

function DevelopersContent() {
  return (
    <div className="animate-fade-up">
      <div className="grid lg:grid-cols-5 gap-10 items-start">
        <div className="lg:col-span-3">
          <h3 className="font-display text-3xl mb-3 text-foreground">
            One function.<br />That&apos;s the integration.
          </h3>
          <p className="text-muted leading-relaxed mb-8 max-w-md">
            Install the package. Define your fields. Write your handler.
            Vouch serves the discovery manifest, validates consent tokens,
            and handles verification. Open protocol, no lock-in.
          </p>

          <div className="space-y-5 mb-8">
            <Feature title="15-minute integration" description="npm install, one function, two route handlers. Next.js, Express, Fastify." />
            <Feature title="MCP + REST" description="Agents discover you via .well-known/vouch.json. MCP tools and REST included." />
            <Feature title="Agents find you automatically" description="No marketplace listing. Your manifest is your storefront." />
          </div>

          <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
            Install the SDK
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-code-bg rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-mono">route.ts</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-code-fg">
              <code>{`import { createVouchHandler }
  from "@vouch/site";

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
      </div>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function Stat({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="border-l-2 border-accent-border pl-4 py-1">
      <span className="font-display text-2xl text-foreground">{value}</span>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}

function ChatBubble({ from, children }: { from: "user" | "agent"; children: React.ReactNode }) {
  return (
    <div className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed ${
        from === "user"
          ? "bg-amber-900/40 text-amber-200 rounded-br-sm"
          : "bg-zinc-800 text-zinc-300 rounded-bl-sm"
      }`}>
        {children}
      </div>
    </div>
  );
}
