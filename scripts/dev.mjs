#!/usr/bin/env node
/**
 * Wrapper around `next dev` that strips EMPTY env vars before booting.
 *
 * Why: Claude Code and some CI shells set sensitive vars (ANTHROPIC_API_KEY, etc.)
 * to "" to scrub credentials from child processes. Next.js' env loader respects
 * already-set process.env values and won't overwrite them with .env.local
 * — so an empty string blocks the real value from ever landing in process.env.
 * We delete empties here so loadEnvConfig sees a clean slate.
 */

import { spawn } from "node:child_process";

const sensitive = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const cleared = [];
for (const key of sensitive) {
  if (process.env[key] === "") {
    delete process.env[key];
    cleared.push(key);
  }
}

if (cleared.length) {
  console.log(`[dev] cleared empty env vars: ${cleared.join(", ")}`);
}

const child = spawn("next", ["dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
