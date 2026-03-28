import { SensitiveString } from "@agent-signup/protocol";

export interface PasswordPolicy {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSymbols?: boolean;
}

const DEFAULT_POLICY: Required<PasswordPolicy> = {
  minLength: 20,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";

/** Generate a cryptographically random password meeting the given policy. */
export function generatePassword(policy?: PasswordPolicy): SensitiveString {
  const p = { ...DEFAULT_POLICY, ...policy };
  const length = Math.max(p.minLength, 12);

  let charset = "";
  const required: string[] = [];

  if (p.requireUppercase) {
    charset += UPPERCASE;
    required.push(randomChar(UPPERCASE));
  }
  if (p.requireLowercase) {
    charset += LOWERCASE;
    required.push(randomChar(LOWERCASE));
  }
  if (p.requireNumbers) {
    charset += NUMBERS;
    required.push(randomChar(NUMBERS));
  }
  if (p.requireSymbols) {
    charset += SYMBOLS;
    required.push(randomChar(SYMBOLS));
  }

  if (charset.length === 0) {
    charset = UPPERCASE + LOWERCASE + NUMBERS;
  }

  // Fill remaining length with random chars from the full charset
  const remaining = length - required.length;
  const chars = [...required];
  for (let i = 0; i < remaining; i++) {
    chars.push(randomChar(charset));
  }

  // Shuffle to avoid predictable positions for required chars
  shuffle(chars);

  return new SensitiveString(chars.join(""));
}

function randomChar(charset: string): string {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return charset[array[0] % charset.length];
}

function shuffle(array: string[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const randomValues = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomValues);
    const j = randomValues[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}
