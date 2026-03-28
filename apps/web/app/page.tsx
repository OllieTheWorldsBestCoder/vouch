import Link from "next/link";
import { HeroConversation } from "./components/hero-conversation";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-card-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">
            agent<span className="text-accent">signup</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#developers" className="text-sm text-muted hover:text-foreground transition-colors">
              Developers
            </a>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-accent text-background hover:bg-accent/90 transition-colors"
            >
              Try it
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="animate-fade-up text-accent text-sm font-medium tracking-wider uppercase mb-4">
              The signup protocol for AI agents
            </p>
            <h1 className="animate-fade-up delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Your agent handles
              <br />
              the paperwork.
            </h1>
            <p className="animate-fade-up delay-200 text-lg text-muted leading-relaxed max-w-lg mb-8">
              Save your details once. Your AI agent discovers sites, gets your
              consent, and signs you up. No forms. No copy-paste. No friction.
            </p>
            <div className="animate-fade-up delay-300 flex gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent/90 transition-colors glow-accent"
              >
                Get started
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-0.5">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a
                href="#developers"
                className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium border border-card-border text-foreground hover:bg-card transition-colors"
              >
                Add to your site
              </a>
            </div>
          </div>

          <div className="animate-fade-up delay-500">
            <HeroConversation />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-16">
            Four scenarios. All seamless.
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card
              number="01"
              title="Site supports it, you're set up"
              description="Fully automated. You say 'sign me up' and it's done. Zero actions required."
              tag="Instant"
              tagColor="text-success"
            />
            <Card
              number="02"
              title="Site supports it, first time"
              description="Your agent asks your name and email, saves them, and signs you up. 30 seconds, once."
              tag="Just-in-time"
              tagColor="text-accent"
            />
            <Card
              number="03"
              title="Site doesn't support it yet"
              description="Your agent opens the signup page and fills in the form with your saved details. You just hit submit."
              tag="Smart concierge"
              tagColor="text-blue-400"
            />
            <Card
              number="04"
              title="Cold start, no support"
              description="Your agent collects your info, saves it, opens the page, and serves your details. Next time is faster."
              tag="First time"
              tagColor="text-muted"
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-lg">
            <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
              Privacy first
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
              Your data stays yours.
            </h2>
            <p className="text-muted leading-relaxed mb-8">
              Everything is encrypted on your device. No servers, no cloud, no accounts.
              Consent is cryptographic &mdash; signed with your personal key, verified by the site.
              Nothing leaves your machine without your explicit approval.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <FeatureItem
              icon={<LockIcon />}
              title="Encrypted locally"
              description="AES-256-GCM encryption. Your details live in a single file on your device."
            />
            <FeatureItem
              icon={<KeyIcon />}
              title="Signed consent"
              description="Ed25519 signatures prove you approved each signup. No one can forge your consent."
            />
            <FeatureItem
              icon={<ShieldIcon />}
              title="Data minimisation"
              description="Sites only get the fields they need. Optional fields are off by default."
            />
          </div>
        </div>
      </section>

      {/* Developer section */}
      <section id="developers" className="py-24 px-6 border-t border-card-border/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-accent text-sm font-medium tracking-wider uppercase mb-4">
            For developers
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Add agent signups in 15 minutes.
          </h2>
          <p className="text-muted leading-relaxed mb-12 max-w-lg">
            One function. Serves the discovery manifest, validates consent tokens,
            handles verification. You just write the signup handler.
          </p>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted font-mono">api/agent-signup/route.ts</span>
            </div>
            <pre className="p-6 overflow-x-auto text-sm leading-relaxed font-mono">
              <code>{codeExample}</code>
            </pre>
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
            Save your details once. Let your agent handle the rest.
          </p>
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
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted">
          <span>
            agent<span className="text-accent">signup</span> protocol v1.0
          </span>
          <span>Open source. No central server. Your data, your device.</span>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Sub-components ---------- */

function Card({
  number,
  title,
  description,
  tag,
  tagColor,
}: {
  number: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
}) {
  return (
    <div className="group bg-card border border-card-border rounded-xl p-6 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-mono text-muted">{number}</span>
        <span className={`text-xs font-medium ${tagColor}`}>{tag}</span>
      </div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="w-10 h-10 rounded-lg bg-accent-soft border border-accent/20 flex items-center justify-center text-accent">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
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

const codeExample = `import { createAgentSignupHandler } from "@agent-signup/site";

const handler = createAgentSignupHandler({
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
      source: "agent-signup",
    });
    return { userId: user.id };
  },
});

export const GET = handler.GET;
export const POST = handler.POST;`;
