import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stderr, // prompts to stderr so stdout stays clean
});

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);

    let input = "";
    const onData = (chunk: Buffer) => {
      const char = chunk.toString();
      if (char === "\n" || char === "\r") {
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener("data", onData);
        process.stderr.write("\n");
        resolve(input);
      } else if (char === "\u007f" || char === "\b") {
        // backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stderr.write("\b \b");
        }
      } else if (char === "\u0003") {
        // ctrl+c
        process.exit(1);
      } else {
        input += char;
        process.stderr.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

export function close() {
  rl.close();
}
