"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "details" | "password" | "done";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStep("password");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) return;
    setSaving(true);

    // Simulate vault creation (in a real app, this would use @agent-signup/client)
    await new Promise((r) => setTimeout(r, 1200));

    setSaving(false);
    setStep("done");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md">
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

        {step === "details" && (
          <div className="animate-fade-up">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Save your details
            </h1>
            <p className="text-muted text-sm mb-8">
              This stays on your device. Your agent uses it to sign you up for things.
            </p>

            <form onSubmit={handleDetailsSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Johnson"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-card border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-card border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim() || !email.trim()}
                className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Continue
              </button>
            </form>
          </div>
        )}

        {step === "password" && (
          <div className="animate-fade-up">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Protect your details
            </h1>
            <p className="text-muted text-sm mb-8">
              Set a password to encrypt your saved details.
              This never leaves your device.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-card border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors text-sm"
                />
              </div>

              {/* What's being saved */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <p className="text-xs text-muted uppercase tracking-wider mb-3">
                  Saving
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {email}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!password || password.length < 6 || saving}
                className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Encrypting...
                  </span>
                ) : (
                  "Save and encrypt"
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("details")}
                className="w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Go back
              </button>
            </form>
          </div>
        )}

        {step === "done" && (
          <div className="animate-fade-up text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-2">
              You&apos;re all set.
            </h1>
            <p className="text-muted text-sm mb-8 max-w-xs mx-auto">
              Your details are saved and encrypted.
              Next time your agent needs to sign you up, it&apos;ll handle everything.
            </p>

            {/* Summary card */}
            <div className="bg-card border border-card-border rounded-xl p-5 text-left mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted">{email}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Encrypted with AES-256-GCM
                </div>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Stored on this device only
                </div>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  Ed25519 signing key generated
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium border border-card-border text-foreground hover:bg-card transition-colors"
            >
              Back to home
            </Link>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mt-12">
          <span className={`w-2 h-2 rounded-full transition-colors ${step === "details" ? "bg-accent" : "bg-card-border"}`} />
          <span className={`w-2 h-2 rounded-full transition-colors ${step === "password" ? "bg-accent" : "bg-card-border"}`} />
          <span className={`w-2 h-2 rounded-full transition-colors ${step === "done" ? "bg-accent" : "bg-card-border"}`} />
        </div>
      </div>
    </main>
  );
}
