const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", ".env.local");
const raw = fs.readFileSync(file, "utf8");

// 1) Show exact bytes of line 4 (the ANTHROPIC line)
const lines = raw.split(/\r?\n/);
const line = lines.find((l) => l.startsWith("ANTHROPIC"));
console.log("Line as string:", JSON.stringify(line));
console.log("Length:", line.length);
console.log("Bytes:", Array.from(line).map((c) => c.charCodeAt(0)).join(","));

// 2) Try dotenv directly (the one bundled with @next/env)
let dotenv;
try {
  dotenv = require("@next/env/dist/index.js");
  console.log("\n@next/env exports:", Object.keys(dotenv));
} catch (e) {
  console.log("Could not load @next/env:", e.message);
}

// 3) Run @next/env's loader on this directory
const { loadEnvConfig } = require("@next/env");
const result = loadEnvConfig(path.dirname(file), true);
console.log("\nLoaded files:", result.loadedEnvFiles.map((f) => f.path));
console.log("ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ?? "UNDEFINED");
