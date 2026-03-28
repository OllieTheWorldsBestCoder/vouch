/** A wrapper that prevents accidental PII leakage in logs, JSON, and debug output. */
export class SensitiveString {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** Returns the actual value. Intentionally verbose name to prevent casual use. */
  unsafeUnwrap(): string {
    return this.#value;
  }

  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "[REDACTED]";
  }

  get length(): number {
    return this.#value.length;
  }
}
