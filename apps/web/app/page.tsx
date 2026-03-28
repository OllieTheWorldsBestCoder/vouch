import Link from "next/link";
import { AudienceTabs } from "./components/audience-tabs";
import { HeroConversation } from "./components/hero-conversation";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* AEO: Structured data for agent discoverability */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Vouch",
            applicationCategory: "DeveloperApplication",
            description:
              "Open protocol for AI agent-driven service registration. Agents discover site requirements via /.well-known/vouch.json, obtain user consent with Ed25519 cryptographic tokens, and submit verified signups. Install @vouch/site to accept agent signups. Install @vouch/agent for agent tooling.",
            url: "https://vouch.dev",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            keywords:
              "agent signup, AI agent registration, MCP tools, agent authentication, automated signup, vouch protocol, well-known vouch",
          }),
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-card-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">
            vouch<span className="text-accent">.</span>
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              How it works
            </a>
            <a
              href="#for-who"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Use cases
            </a>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-accent text-background hover:bg-accent/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent-soft text-accent text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
              Open protocol &middot; No vendor lock-in
            </div>
            <h1 className="animate-fade-up delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Your agent vouches
              <br />
              for you.
            </h1>
            <p className="animate-fade-up delay-200 text-lg text-muted leading-relaxed max-w-lg mb-8">
              Save your identity once. When your AI agent needs to sign you up for
              something, Vouch handles it &mdash; with your consent, your encryption,
              your rules.
            </p>
            <div className="animate-fade-up delay-300 flex gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent/90 transition-colors glow-accent"
              >
                Save your details
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-0.5">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a
                href="#for-who"
                className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium border border-card-border text-foreground hover:bg-card transition-colors"
              >
                Add Vouch to your site
              </a>
            </div>
          </div>

          <div className="animate-fade-up delay-500">
            <HeroConversation />
          </div>
        </div>
      </section>

      {/* How it works - 3 scenarios only */}
      <section id="how-it-works" className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Three scenarios. All handled.
          </h2>
          <p className="text-muted leading-relaxed mb-12 max-w-lg">
            Whether the site has Vouch installed or not, your agent makes signup
            as easy as possible.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <ScenarioCard
              number="01"
              title="Vouch-enabled site"
              tag="Instant"
              tagColor="text-success"
              description="You say 'sign me up.' Your agent handles everything automatically. Cryptographic consent, verified data, done."
              time="~3 seconds"
            />
            <ScenarioCard
              number="02"
              title="First time using Vouch"
              tag="Just-in-time"
              tagColor="text-accent"
              description="Your agent asks your name and email, saves them encrypted, and signs you up. The vault is created as a side effect."
              time="~30 seconds, once"
            />
            <ScenarioCard
              number="03"
              title="Site without Vouch"
              tag="Smart concierge"
              tagColor="text-blue-400"
              description="Your agent opens the signup page and fills the form with your saved details. You just review and submit."
              time="~1 minute"
            />
          </div>
        </div>
      </section>

      {/* Audience tabs */}
      <section id="for-who" className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
            Built for everyone in the loop
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            What Vouch means for you.
          </h2>
          <AudienceTabs />
        </div>
      </section>

      {/* Trust / Security strip */}
      <section className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8">
            <TrustItem icon="lock" label="AES-256-GCM" detail="Local encryption" />
            <TrustItem icon="key" label="Ed25519" detail="Signed consent" />
            <TrustItem icon="shield" label="Zero servers" detail="Your device only" />
            <TrustItem icon="code" label="Open protocol" detail="No vendor lock-in" />
          </div>
        </div>
      </section>

      {/* Agent discoverability / AEO section */}
      <section className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
                Agent-discoverable
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Agents find you automatically.
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                Add Vouch to your site and every AI agent can discover you.
                The <code className="text-xs px-1.5 py-0.5 rounded bg-card border border-card-border font-mono">.well-known/vouch.json</code> manifest
                tells agents what fields you need, how to sign up, and how to verify. No marketplace listing required.
              </p>
              <p className="text-muted leading-relaxed">
                MCP tool definitions are included. Agents with Vouch tools loaded will
                check for your manifest before attempting manual form-fill.
              </p>
            </div>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
                <span className="text-xs text-muted font-mono">/.well-known/vouch.json</span>
              </div>
              <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-muted">
                <code>{`{
  "protocol_version": "1.0",
  "issuer": "https://yourapp.com",
  "branding": {
    "name": "Your App",
    "privacy_policy_url": "..."
  },
  "fields": {
    "required": [
      { "field": "email", "type": "email" },
      { "field": "name", "type": "string" }
    ]
  },
  "endpoints": {
    "signup": "/api/vouch/signup",
    "challenge": "/api/vouch/challenge"
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Stop filling out forms.
          </h2>
          <p className="text-muted leading-relaxed mb-10 max-w-md mx-auto">
            Let your agent vouch for you.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium bg-accent text-background hover:bg-accent/90 transition-colors glow-accent"
            >
              Get started
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted">
          <span>
            vouch<span className="text-accent">.</span> protocol v1.0
          </span>
          <span>Open source &middot; No central server &middot; Your data, your device</span>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Sub-components ---------- */

function ScenarioCard({
  number,
  title,
  tag,
  tagColor,
  description,
  time,
}: {
  number: string;
  title: string;
  tag: string;
  tagColor: string;
  description: string;
  time: string;
}) {
  return (
    <div className="group bg-card border border-card-border rounded-xl p-6 hover:border-accent/30 transition-colors flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-mono text-muted">{number}</span>
        <span className={`text-xs font-medium ${tagColor}`}>{tag}</span>
      </div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-4 flex-1">{description}</p>
      <p className="text-xs text-muted font-mono">{time}</p>
    </div>
  );
}

function TrustItem({
  icon,
  label,
  detail,
}: {
  icon: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-lg bg-accent-soft border border-accent/20 flex items-center justify-center mx-auto mb-3 text-accent">
        {icon === "lock" && <LockIcon />}
        {icon === "key" && <KeyIcon />}
        {icon === "shield" && <ShieldIcon />}
        {icon === "code" && <CodeIcon />}
      </div>
      <p className="text-sm font-semibold font-mono">{label}</p>
      <p className="text-xs text-muted mt-1">{detail}</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
