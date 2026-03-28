import Link from "next/link";
import { AudienceTabs } from "./components/audience-tabs";
import { HeroConversation } from "./components/hero-conversation";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* AEO structured data */}
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
              "Open protocol for AI agent-driven service registration. Agents discover site requirements via /.well-known/vouch.json, obtain user consent with Ed25519 cryptographic tokens, and submit verified signups.",
            url: "https://vouch.dev",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            keywords: "agent signup, AI agent registration, MCP tools, vouch protocol, well-known vouch",
          }),
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-card-border bg-background/90 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-2xl tracking-tight text-foreground">
            vouch<span className="text-accent">.</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors">
              How it works
            </a>
            <Link
              href="/signup"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h1 className="animate-fade-up font-display text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.05] mb-5 text-foreground">
              Your agent
              <br />
              vouches for you.
            </h1>
            <p className="animate-fade-up delay-100 text-base text-muted leading-relaxed max-w-md mb-8">
              Save your identity once. When your AI agent needs to sign you up
              for something, Vouch handles it &mdash; with your consent, your
              encryption, your rules.
            </p>
            <div className="animate-fade-up delay-200 flex items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Get started
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <span className="text-xs text-muted">
                Open protocol &middot; No vendor lock-in
              </span>
            </div>
          </div>

          <div className="animate-fade-up delay-300">
            <HeroConversation />
          </div>
        </div>
      </section>

      {/* How it works -- 3 scenarios with hierarchy */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-3 text-foreground">
            Three scenarios. All handled.
          </h2>
          <p className="text-muted mb-12 max-w-md">
            Whether the site has Vouch installed or not, your agent makes signup
            as easy as possible.
          </p>

          {/* Scenario 1: featured */}
          <div className="bg-card border border-card-border rounded-2xl p-8 mb-4">
            <div className="flex items-start justify-between mb-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Instant
              </div>
              <span className="text-xs font-mono text-muted">~3 seconds</span>
            </div>
            <h3 className="font-display text-2xl mb-2 text-foreground">Vouch-enabled site</h3>
            <p className="text-muted max-w-lg">
              You say &quot;sign me up.&quot; Your agent handles everything automatically.
              Cryptographic consent, verified data, done. Zero actions from you.
            </p>
          </div>

          {/* Scenarios 2 & 3: secondary */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-card-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-accent">Just-in-time</span>
                <span className="text-xs font-mono text-muted">~30s, once</span>
              </div>
              <h3 className="font-semibold mb-1.5 text-foreground">First time using Vouch</h3>
              <p className="text-sm text-muted">
                Your agent asks your name and email, saves them encrypted, and signs you up.
                The vault is created as a side effect.
              </p>
            </div>

            <div className="border border-card-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-blue-600">Smart concierge</span>
                <span className="text-xs font-mono text-muted">~1 minute</span>
              </div>
              <h3 className="font-semibold mb-1.5 text-foreground">Site without Vouch</h3>
              <p className="text-sm text-muted">
                Your agent opens the signup page and fills the form with your saved details.
                You just review and submit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Audience tabs */}
      <section className="py-20 px-6 border-t border-card-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-10 text-foreground">
            What Vouch means for you.
          </h2>
          <AudienceTabs />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-card-border">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mb-4 text-foreground">
            Stop filling out forms.
          </h2>
          <p className="text-muted mb-10 max-w-sm mx-auto">
            Let your agent vouch for you.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            Get started
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted">
          <span className="font-display text-base text-foreground">
            vouch<span className="text-accent">.</span>
          </span>
          <span>Open protocol &middot; No central server &middot; Your data, your device</span>
        </div>
      </footer>
    </main>
  );
}
