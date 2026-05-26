/**
 * Lê .env.local e propaga as variáveis pra Vercel (production environment).
 * Pra evitar prompt interativo, usa `vercel env add` com stdin.
 */
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const env = {};
const lines = fs.readFileSync(path.resolve(".env.local"), "utf-8").split("\n");
for (const line of lines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const TARGET_ENVS = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAILS",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
];

// Não envia SUPABASE_SERVICE_ROLE_KEY (placeholder no .env.local) nem
// NEXT_PUBLIC_APP_URL / LINKEDIN_REDIRECT_URI — vou setar esses depois com
// a URL real do Vercel.

function addEnv(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "vercel",
      ["env", "add", name, "production", "--force"],
      { stdio: ["pipe", "pipe", "pipe"], shell: true }
    );
    let out = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (out += b.toString()));
    child.stdin.write(value + "\n");
    child.stdin.end();
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true, name });
      else resolve({ ok: false, name, code, out: out.slice(-300) });
    });
    child.on("error", reject);
  });
}

console.log(`Enviando ${TARGET_ENVS.length} variáveis pra Vercel production…\n`);
for (const key of TARGET_ENVS) {
  if (!env[key]) {
    console.log(`[SKIP] ${key} (não está no .env.local)`);
    continue;
  }
  const r = await addEnv(key, env[key]);
  console.log(`${r.ok ? "[OK]" : "[FAIL]"} ${key}${r.ok ? "" : "  --  " + r.out}`);
}
console.log("\nFeito.");
