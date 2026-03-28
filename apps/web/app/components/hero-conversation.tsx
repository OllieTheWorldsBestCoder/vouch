"use client";

import { useState, useEffect } from "react";

interface Message {
  from: "user" | "agent";
  text: string;
  delay: number;
}

const CONVERSATION: Message[] = [
  { from: "user", text: "Sign me up for acme.com", delay: 0 },
  { from: "agent", text: "I can handle that. What name should I use?", delay: 800 },
  { from: "user", text: "Alex Johnson", delay: 1800 },
  { from: "agent", text: "And your email?", delay: 2400 },
  { from: "user", text: "alex@example.com", delay: 3400 },
  { from: "agent", text: "Done. Check your email to verify.\nI saved your details for next time.", delay: 4200 },
];

export function HeroConversation() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    CONVERSATION.forEach((msg, i) => {
      timers.push(
        setTimeout(() => setVisibleCount(i + 1), msg.delay + 600),
      );
    });

    // Show the consent card after "What name should I use?"
    timers.push(setTimeout(() => setShowCard(true), 5200));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* Conversation */}
      <div className="flex-1 w-full max-w-md space-y-3">
        {CONVERSATION.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            className={`chat-message flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-line ${
                msg.from === "user"
                  ? "bg-accent/15 text-accent border border-accent/20 rounded-br-md"
                  : "bg-card border border-card-border text-foreground rounded-bl-md"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {visibleCount < CONVERSATION.length && visibleCount > 0 && (
          <div className="flex justify-start">
            <div className="bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse-slow" />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse-slow" style={{ animationDelay: "0.3s" }} />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse-slow" style={{ animationDelay: "0.6s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Consent card that appears */}
      {showCard && (
        <div className="flex-1 w-full max-w-sm animate-slide-up">
          <div className="bg-card border border-card-border rounded-xl p-6 glow-accent">
            <p className="text-lg font-medium mb-1">Sign up for ACME?</p>
            <p className="text-muted text-sm mb-5">acme.com</p>

            <p className="text-muted text-xs uppercase tracking-wider mb-3">
              They&apos;ll get
            </p>
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Alex Johnson
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                alex@example.com
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted border border-card-border hover:bg-card-border/30 transition-colors">
                Not now
              </button>
              <button className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-background hover:bg-accent/90 transition-colors">
                Sign me up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
