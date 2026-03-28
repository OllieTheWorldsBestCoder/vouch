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
  { from: "agent", text: "Done. Check your email to verify.", delay: 4200 },
];

export function HeroConversation() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    CONVERSATION.forEach((msg, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), msg.delay + 600));
    });

    timers.push(setTimeout(() => setShowCard(true), 5000));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative bg-code-bg rounded-2xl p-8 lg:p-10 overflow-hidden">
      {/* Subtle top gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

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
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                  msg.from === "user"
                    ? "bg-amber-900/40 text-amber-200 border border-amber-800/40 rounded-br-md"
                    : "bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {visibleCount < CONVERSATION.length && visibleCount > 0 && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse-slow" />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse-slow" style={{ animationDelay: "0.3s" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse-slow" style={{ animationDelay: "0.6s" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Consent card */}
        {showCard && (
          <div className="flex-1 w-full max-w-xs animate-slide-up">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 shadow-2xl">
              <p className="text-base font-medium text-zinc-100 mb-0.5">Sign up for ACME?</p>
              <p className="text-zinc-500 text-xs mb-4">acme.com</p>

              <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2.5">
                They&apos;ll get
              </p>
              <div className="space-y-1.5 mb-5">
                <div className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  Alex Johnson
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  alex@example.com
                </div>
              </div>

              <div className="flex gap-2.5">
                <button className="flex-1 px-3 py-2 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-700/50 transition-colors">
                  Not now
                </button>
                <button className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                  Sign me up
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
