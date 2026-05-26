const fs = require("fs");
const path = require("path");

const file = fs.readFileSync(path.resolve(__dirname, "..", ".env.local"), "utf8");
const lines = file.split(/\r?\n/);
const out = {};
for (const raw of lines) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq < 0) continue;
  const k = line.slice(0, eq).trim();
  let v = line.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  out[k] = v;
}
console.log("Keys found:", Object.keys(out));
for (const [k, v] of Object.entries(out)) {
  console.log(`${k} len=${v.length} first=${v.slice(0, 16)}`);
}
