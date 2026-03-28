# Interaction Design: Making It Human

**Version:** 1.0
**Date:** 2026-03-28

This document defines how Agent Signup feels. Every user-facing word, every screen, every moment of friction. The goal: it should feel like a thoughtful friend is handling your paperwork, not like you're configuring a security system.

---

## Principles

### 1. Use their words, not ours

| We say internally | Users see |
|---|---|
| Vault | "your saved details" or "your info" |
| Passphrase | "password" |
| Consent token | (never mentioned) |
| Ed25519 keypair | (never mentioned) |
| Discovery manifest | (never mentioned) |
| Pre-authorized scope | "auto-approve rule" or "standing permission" |
| Verification pending | "check your email" |
| Nonce | (never mentioned) |
| Encryption | "protected" or "secured" or "locked" |
| PII | "your details" or "your info" |

### 2. Do, then explain

Wrong: "I need to create an encrypted identity vault using AES-256-GCM before I can proceed with the signup."

Right: "Signed up for ACME. I saved your details locally so next time is even faster."

The agent acts first, explains briefly after. Users care about outcomes, not process.

### 3. One thing at a time

Never dump multiple pieces of information. Each message from the agent should have one purpose:
- Ask one question
- Confirm one action
- Share one result

Wrong:
```
"I've created your vault at ~/.agent-signup/vault.json, generated an
Ed25519 keypair, signed a consent token for acme.com, submitted your
registration, and a verification email has been sent to alex@example.com.
Your signup ID is sgn_abc123."
```

Right:
```
"Signed up for ACME. Check your email to finish."
```

### 4. Silence is confidence

When things work, be brief. Long messages signal problems. The happy path should feel fast and quiet:

```
User: "Sign me up for acme.com"
Agent: "Done. Verification email sent to alex@example.com."
```

That's it. No recap. No technical details. Done.

### 5. Failures are next steps, not errors

Wrong: "Error: CHALLENGE_EXPIRED. The consent token has expired. Please re-initiate the signup flow."

Right: "That took a moment. Let me try again."

Wrong: "409 Conflict: DUPLICATE_SIGNUP. An account with this email already exists."

Right: "You already have an account there. Want me to help you log in?"

---

## Every Touchpoint, Redesigned

### First-Time Setup (embedded in first signup)

**Current (too technical):**
```
Agent Signup - Identity Vault Setup

This creates an encrypted vault on your device.
Your data never leaves this machine.

Enter your details:
Name:  ___
Email: ___

Set a vault passphrase: ___
Confirm: ___

Vault created at ~/.agent-signup/vault.json
```

**Better:**
```
User: "Sign me up for acme.com"

Agent: "I can handle that. What name should I use?"
User:  "Alex Johnson"

Agent: "And your email?"
User:  "alex@example.com"

Agent: "Last thing - set a password to keep your details safe.
        This stays on your device, I won't store it anywhere."
User:  ********

Agent: "All set. Signing you up for ACME now...
        Done. Check alex@example.com for their verification email.

        I saved your details for next time - signups like this
        will be instant from now on."
```

Notice:
- No mention of "vault", "encryption", "Ed25519", or file paths
- The password request is framed as protection ("keep your details safe"), not as a technical requirement
- The success message focuses on what happened and what's next
- The vault creation is mentioned as a benefit ("saved for next time"), not as a system event
- File path is NOT shown (they'll find it if they look; most won't)

### Consent Prompt (interactive mode)

**Current (feels like a permissions dialog):**
```
+--------------------------------------------------+
|  Agent Signup Request                             |
|                                                   |
|  [Agent Icon] Your agent wants to sign you up:   |
|                                                   |
|  ACME Corp (https://acme.com)                    |
|  Fields to share:                                 |
|  [x] Full Name    Alex Johnson     (required)    |
|  [x] Email        alex@example.com (required)    |
|  [ ] Phone        +1-555-0123      (optional)    |
|                                                   |
|  Terms of Service: https://acme.com/terms         |
|                                                   |
|  [Deny]                        [Approve Signup]   |
+--------------------------------------------------+
```

**Better:**
```
+--------------------------------------------------+
|                                                   |
|  Sign up for ACME?                                |
|  acme.com                                         |
|                                                   |
|  They'll get:                                     |
|                                                   |
|    Alex Johnson                                   |
|    alex@example.com                               |
|                                                   |
|  Also available:                  [toggle]        |
|    Phone  +1-555-0123                off          |
|                                                   |
|  Terms & Privacy                                  |
|                                                   |
|  [Not now]                    [Sign me up]        |
|                                                   |
+--------------------------------------------------+
```

Changes:
- Headline is a question, not a system label ("Sign up for ACME?" not "Agent Signup Request")
- "They'll get" instead of "Fields to share" -- frames it as a human transaction
- No "(required)" labels -- if it's required, it's just there. Don't make the user think about requirements
- Optional fields are a toggle, not a checkbox. Toggles feel like choices; checkboxes feel like forms
- "Not now" instead of "Deny" -- softer, implies they can come back
- "Sign me up" instead of "Approve Signup" -- it's what the user actually wants to happen
- "Terms & Privacy" is a quiet link, not a loud URL
- No agent icon or system framing -- this is about the USER signing up, not about the agent doing things

### Auto-Approve Rules (pre-authorized scopes)

**Current (too technical):**
```
Pre-Authorization Rules

Rule 1: "Trusted sites"
Domains: acme.com, example.com, trusted.io
Fields: name, email
Expires: 2026-06-28
```

**Better:**
```
Auto-approve settings

When a site I trust asks for my name and email,
just go ahead.

Trusted sites: acme.com, example.com, trusted.io
Expires in 3 months

[Edit]  [Turn off]
```

Changes:
- Written in first person ("When a site I trust...") -- the user is setting their own preferences
- Plain English description of what the rule does
- Relative time ("3 months") not absolute dates
- "Turn off" not "Delete" -- less scary, same result

### Signup History

**Current:**
```
Mar 28  ACME Corp  Fields: name, email  Verified  Auto-approved (Rule 1)
Mar 27  Beta App   Fields: name, email, phone  Verified  Manual approval
```

**Better:**
```
Recent signups

ACME Corp                              2 days ago
  Name, email -- auto-approved                  done

Beta App                               3 days ago
  Name, email, phone                            done

Gamma SaaS                             5 days ago
  Name, email                          waiting for email
```

Changes:
- "Recent signups" not "Signup History" -- casual, not archival
- Relative dates ("2 days ago")
- Status is a word ("done", "waiting for email") not a badge
- "auto-approved" is a quiet note, not a highlighted feature
- No field labels like "Fields:" -- just list them

### Password reveal

When the user needs a password the agent generated:

**Current:**
```
Password for acme.com: ******* (tap to reveal/copy)
```

**Better:**
```
Your ACME password: [show]   [copy]
```

Then when shown:
```
Your ACME password: xK7#mP2nQ9vL4    [hide]   [copied]
```

- "Your ACME password" not "Password for acme.com" -- possessive, personal
- Separate show/copy buttons -- copying without seeing is a valid flow
- Brief flash of "copied" then back to "copy"

### Non-participating sites (Q3 smart concierge)

**Current (agent-journey.md):**
```
Agent: "oldsite.com doesn't support automated signup, but I can
        make it easy. Opening their signup page now...
        Here's your info ready to paste:"
```

**Better:**
```
Agent: "Opening oldsite.com's signup page.

        Your details:
        Alex Johnson
        alex@example.com
        Password: [tap to copy]

        I'll save the password for you."
```

Changes:
- Don't mention "doesn't support automated signup" -- the user doesn't care about the protocol. They care about signing up
- Don't say "but I can make it easy" -- just make it easy, don't announce it
- Lead with the action (opening the page), follow with the data
- "I'll save the password" -- a quiet benefit, not a feature announcement

### Error states

**Site is down:**
```
Agent: "acme.com isn't responding. I'll try again in a minute."
```
Not: "Error: Network timeout. Site unreachable. Retry?"

**Wrong password (vault unlock):**
```
Agent: "That's not right. Try again?"
```
Not: "Error: Decryption failed. Invalid passphrase."

**Verification expired:**
```
Agent: "The verification email for ACME expired.
        Want me to start a new signup?"
```
Not: "Signup status: EXPIRED. Verification window (30m) exceeded."

**Rate limited:**
```
Agent: "ACME is busy. I'll try again shortly."
```
Not: "429 Too Many Requests. Rate limit exceeded. Retry-After: 300."

---

## The Voice

### Who the agent sounds like

A capable friend who handles admin stuff for you. Think: a personal assistant who's good at their job and doesn't need to prove it.

- **Confident** -- "Done." not "I was able to successfully complete..."
- **Brief** -- One sentence where possible. Two at most.
- **Warm but not performative** -- No "Great news!" or "Awesome!" Just clear, direct, human.
- **Proactive** -- "I saved the password for you" not waiting to be asked.
- **Honest about limits** -- "I can't fill this form automatically, but here's your info ready to go."

### What the agent never says

- "Unfortunately" -- just say what you can do
- "Error" -- describe what happened in human terms
- "Please" before every request -- one "please" per conversation is enough
- Technical terms (vault, token, nonce, endpoint, protocol)
- "I'm sorry" -- unless something actually went wrong that's the agent's fault
- "Successfully" -- if it wasn't successful, you wouldn't be telling them
- Exclamation marks (!) -- calm confidence, not enthusiasm
- "Let me" -- just do it

### Sentence structure

- Short. Direct. Active voice.
- "Signed up for ACME." not "Your signup for ACME Corp has been completed."
- "Check your email." not "A verification email has been sent to your email address."
- "What's your name?" not "Please enter your full name."

---

## Visual Design Principles

These apply to the consent UI component and any web/desktop interfaces.

### 1. Cards, not dialogs

The consent prompt should feel like a card you're reviewing, not a system dialog you're dismissing. No modal overlays. No dark backgrounds. No "are you sure?" energy.

### 2. Your data, front and center

The user's actual information (their name, their email) should be the most prominent thing on screen. Not labels, not site branding, not legal links.

### 3. Quiet chrome

Borders should be subtle. Buttons should be calm. Nothing should shout. The UI should feel like a well-designed form, not a security warning.

### 4. Motion with purpose

- Card appears: gentle slide up (200ms)
- Approval: card slides away, brief checkmark (300ms)
- Denial: card fades (150ms) -- faster, no celebration
- Loading: subtle pulse, never a spinner with text

### 5. Typography

- Site name: medium weight, slightly larger
- User's data: regular weight, default size -- it should look like text they typed, not system output
- Actions ("Sign me up" / "Not now"): the primary action is visually heavier, the secondary is lighter
- Legal links: small, muted, bottom -- present but not competing

### 6. Color

- No red for "deny/not now" -- red triggers anxiety. Use muted gray
- Primary action uses the site's accent color if available (from manifest branding), otherwise a calm blue
- User's data is in the default text color -- no special treatment, it should feel like THEIR text
- Background: white or very light neutral

---

## Interaction Patterns

### Progressive detail

The agent reveals information in layers:

**Layer 1 (default):** "Signed up for ACME. Check your email."
**Layer 2 (if asked):** "I shared your name and email. Verification sent to alex@example.com."
**Layer 3 (if asked):** "Consent token signed at 12:00, signup ID sgn_abc123, status pending."

Most users never go past Layer 1. Power users can ask for more. The agent should never volunteer Layer 3 unprompted.

### Conversational collection

When collecting missing fields, the agent asks like a person:

Wrong:
```
Agent: "The following required fields are missing from your vault:
        - phone (type: phone, required: true)
        Please provide values for each field."
```

Right:
```
Agent: "ACME also needs your phone number. What is it?"
User:  "+15550123"
Agent: "Got it."
```

One field at a time. No forms. No field labels. Just questions and answers.

### Implicit trust building

The agent builds trust by being transparent without being verbose:

- First signup: "I saved your details for next time."
- Second signup: "Using your saved details." (just a note, not a question)
- Third signup: (says nothing, just does it)

By the third time, the user trusts the system and doesn't need reassurance.

### Graceful degradation

When something goes wrong, the agent:
1. States what happened (one sentence)
2. Says what it's doing about it (one sentence)
3. Stops

```
Agent: "ACME's signup is timing out. Trying again."
```

If it fails again:
```
Agent: "Still not working. Here's their signup page if you
        want to try manually: acme.com/register"
```

Always end with an action the user can take. Never end with "something went wrong."

---

## Checklist: Is It Human Enough?

Before shipping any user-facing text, ask:

- [ ] Would you say this to a friend? If not, rewrite it.
- [ ] Can you remove a sentence? If yes, remove it.
- [ ] Are there any technical words? Replace them.
- [ ] Does it start with what matters? (Not with context or caveats.)
- [ ] If it's an error, does it end with a next step?
- [ ] Is there an exclamation mark? Remove it.
- [ ] Would a non-technical person understand every word?
- [ ] Is the agent apologizing? Stop it.
