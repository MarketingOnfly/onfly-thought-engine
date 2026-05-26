/**
 * Verifica se as migrations 006-009 foram aplicadas.
 * Usa SUPABASE_SERVICE_ROLE_KEY pra ler information_schema.
 */
import fs from "node:fs";
import path from "node:path";

const env = {};
const envFile = fs.readFileSync(path.resolve(".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
// Tenta service role; se for placeholder, cai pra anon (que funciona pra
// detectar se coluna existe — PostgREST devolve mensagem específica).
const key =
  env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 50
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Faltam credenciais.");
  process.exit(1);
}
console.log(`Usando ${key === env.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon"} key.\n`);

async function rpc(sql) {
  // Tenta via PostgREST RPC. Se 'exec_sql' não existir no Supabase, vamos
  // cair pra consulta de tabela individual usando o REST.
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  return res;
}

const EXPECTED = {
  reference_profiles: [
    "tone_signals",
    "positioning",
    "topics_recurring",
    "vocab_notes",
    "analysis_error",
  ],
  campaigns: ["audience_filter"],
  campaign_attachments: ["mime_type", "size_bytes"],
  post_metrics: ["title"],
  org_documents: [], // checamos nomes específicos abaixo
};

// Como provavelmente exec_sql não existe, vamos usar a abordagem "fingerprint":
// tentar selecionar cada coluna nova com limit 0 — se vier erro contendo o nome
// da coluna, ela não existe; se vier 200, existe.
async function columnExists(table, column) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=0`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
  if (res.ok) return { exists: true };
  const body = await res.text();
  // PostgREST devolve PGRST204 / "could not find" quando a coluna não existe.
  // Outras falhas (401, RLS) significam que a coluna existe mas RLS bloqueou.
  const looksLikeMissing =
    body.includes("PGRST204") ||
    body.toLowerCase().includes("could not find") ||
    body.toLowerCase().includes(`column "${column}"`);
  return {
    exists: !looksLikeMissing,
    error: body.slice(0, 200),
    rlsBlocked: !looksLikeMissing,
  };
}

async function frameworkSeedExists() {
  const names = [
    "Cialdini — 7 princípios de influência",
    "Made to Stick — SUCCESs framework",
    "StoryBrand BrandScript — 7 partes",
  ];
  const found = [];
  for (const name of names) {
    const res = await fetch(
      `${url}/rest/v1/org_documents?name=eq.${encodeURIComponent(
        name
      )}&select=name&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) found.push(name);
    }
  }
  return found;
}

console.log("Verificando migrations 006-009 no Supabase…\n");

let allOk = true;
for (const [table, cols] of Object.entries(EXPECTED)) {
  if (!cols.length) continue;
  console.log(`Tabela: ${table}`);
  for (const col of cols) {
    const r = await columnExists(table, col);
    const ok = r.exists;
    if (!ok) allOk = false;
    const tag = ok
      ? r.rlsBlocked
        ? "[OK rls]"
        : "[OK]"
      : "[MISSING]";
    console.log(`  ${tag} ${col}${ok ? "" : "  --  " + r.error}`);
  }
}

console.log("\nSeed de frameworks (migration 007):");
const seeds = await frameworkSeedExists();
const expectedSeeds = 3;
if (seeds.length === expectedSeeds) {
  console.log(`  [OK] ${seeds.length}/${expectedSeeds} frameworks-chave encontrados`);
} else {
  allOk = false;
  console.log(
    `  [MISSING] ${seeds.length}/${expectedSeeds} frameworks. Faltando: ${[
      "Cialdini — 7 princípios de influência",
      "Made to Stick — SUCCESs framework",
      "StoryBrand BrandScript — 7 partes",
    ]
      .filter((n) => !seeds.includes(n))
      .join(", ")}`
  );
}

console.log(
  "\n" + (allOk ? "Tudo aplicado." : "Tem migration pendente — ver MISSING acima.")
);
