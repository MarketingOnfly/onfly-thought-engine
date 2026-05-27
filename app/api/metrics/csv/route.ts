import { NextResponse, after, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getServerUser,
} from "@/lib/supabase/server";
import { learnFromFeedback } from "@/lib/anthropic/learn-from-feedback";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Pega posts importados que viraram top performers (>2x a média do líder),
 * compara contra os de baixa performance e atualiza learned_preferences.
 * Idempotente — só roda em métricas com learned_from = false.
 */
async function learnFromHighPerformers(userId: string) {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return; // service_role ausente — skip
  }

  // Métricas do líder ainda não aprendidas, com draft vinculado
  const { data: metrics } = await admin
    .from("post_metrics")
    .select(
      "id, impressions, likes, comments, reposts, content_draft_id, content_draft:content_drafts(topic, draft_markdown)"
    )
    .eq("user_id", userId)
    .eq("learned_from", false)
    .not("content_draft_id", "is", null)
    .order("impressions", { ascending: false })
    .limit(50);
  if (!metrics?.length) return;

  // Calcula média do líder pra identificar outliers
  const allImpressions = metrics.map((m) => m.impressions ?? 0);
  const avg =
    allImpressions.reduce((a, b) => a + b, 0) / Math.max(1, allImpressions.length);
  if (avg === 0) return;

  const highPerformers = metrics.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.impressions > avg * 2 && m.content_draft?.draft_markdown
  );
  if (!highPerformers.length) return;

  // Trata cada high-performer como um "feedback" rating 5
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const samples = (highPerformers as any[]).map((m) => ({
    rating: 5,
    comment: `Esse post bateu ${(m.impressions / avg).toFixed(1)}x a média de impressões (${m.impressions} vs ${Math.round(avg)} médio). Curtidas: ${m.likes}, comentários: ${m.comments}, reposts: ${m.reposts}.`,
    draft_topic: m.content_draft?.topic ?? "",
    draft_text: m.content_draft?.draft_markdown ?? null,
    created_at: new Date().toISOString(),
  }));

  const preferences = await learnFromFeedback(samples);
  if (preferences) {
    // Pega learned_preferences atuais e MERGE (não sobrescreve o feedback manual)
    const { data: profile } = await admin
      .from("leader_profiles")
      .select("learned_preferences")
      .eq("user_id", userId)
      .maybeSingle();

    const existing = profile?.learned_preferences ?? "";
    const next = existing
      ? `${existing}\n\n# Padrões automáticos (alto desempenho):\n${preferences}`.slice(
          0,
          3000
        )
      : `# Padrões automáticos (alto desempenho):\n${preferences}`;

    await admin
      .from("leader_profiles")
      .update({ learned_preferences: next })
      .eq("user_id", userId);
  }

  // Marca como aprendidos pra não reprocessar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = highPerformers.map((m: any) => m.id);
  await admin.from("post_metrics").update({ learned_from: true }).in("id", ids);
}

/**
 * Bulk import de métricas de LinkedIn Analytics.
 *
 * Aceita CSV ou XLSX (o export do LinkedIn vem em .xlsx).
 *
 * Colunas reconhecidas (variações com/sem acento, EN/PT):
 *   Date / Data / Posted on / Created
 *   Update title / Post title / Título
 *   Update URL / Post URL / Link
 *   Impressions / Impressões
 *   Likes / Reactions / Reações / Curtidas
 *   Comments / Comentários
 *   Reposts / Shares / Compartilhamentos
 *   Clicks / Cliques
 *   Engagement rate / Taxa de engajamento
 */

// ------------------------------------------------------------
// PARSERS
// ------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  if (!rows.length) return { headers: [], rows: [] };

  // Acha a linha de header (pode não ser a primeira se o LinkedIn coloca
  // pré-cabeçalho descritivo)
  const headerRowIdx = findHeaderRowIdx(rows);
  const headers = rows[headerRowIdx].map((h) => h.trim().toLowerCase());
  const dataRows = rows
    .slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => c.trim()));
  return { headers, rows: dataRows };
}

/** Strip acentos e normaliza pra comparação tolerante. */
function stripAccents(s: string): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Pistas que indicam que a linha é cabeçalho de uma tabela de POSTS.
 * Quanto mais pistas, mais provável que seja essa linha.
 */
const POST_HEADER_HINTS = [
  "impression", // impressions / impressões → "impressoes"
  "impressao", // impressão singular
  "impressoes",
  "engagement",
  "engajament",
  "engajement",
  "like",
  "reaco", // reações
  "curtida",
  "comment",
  "comentario",
  "repost",
  "share",
  "compartilhament",
  "republicacao",
  "click",
  "clique",
];

/** Retorna [idx, score] da linha cabeçalho mais provável (ou -1, 0). */
function findHeaderRow(rows: string[][]): { idx: number; score: number } {
  const max = Math.min(rows.length, 30);
  let best = { idx: -1, score: 0 };
  for (let i = 0; i < max; i++) {
    const row = (rows[i] ?? []).map(stripAccents);
    if (row.every((c) => !c)) continue;
    const score = POST_HEADER_HINTS.reduce(
      (acc, hint) => (row.some((c) => c.includes(hint)) ? acc + 1 : acc),
      0
    );
    // exige ao menos 2 pistas pra ser cabeçalho-de-tabela-de-posts
    if (score >= 2 && score > best.score) {
      best = { idx: i, score };
    }
  }
  return best;
}

/** Compat: retorna só o índice ou 0 (pra uso simples). */
function findHeaderRowIdx(rows: string[][]): number {
  const r = findHeaderRow(rows);
  return r.idx >= 0 ? r.idx : 0;
}

async function parseXlsx(
  buf: ArrayBuffer
): Promise<{
  headers: string[];
  rows: string[][];
  sheetNames: string[];
  pickedSheet: string;
  sheetScores: { name: string; score: number }[];
}> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

  // 1. Lê todas as abas como matrizes.
  const sheets: { name: string; rows: string[][] }[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (data.length === 0) continue;
    sheets.push({ name, rows: data.map((r) => (r ?? []).map(String)) });
  }

  // 2. Pontua cada aba pelo número de cabeçalhos de post detectados.
  //    A aba "Publicações mais em alta" / "Top Posts" terá score alto;
  //    "Seguidores" não terá nenhum.
  const scored = sheets.map((s) => {
    const r = findHeaderRow(s.rows);
    return { name: s.name, rows: s.rows, headerIdx: r.idx, score: r.score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked =
    scored[0] && scored[0].score >= 2
      ? scored[0]
      : // fallback: nenhuma aba tem cara de tabela de posts. Pega a com mais
        // linhas pra pelo menos devolver diagnóstico útil.
        sheets.length
        ? {
            ...sheets.reduce((a, b) => (a.rows.length >= b.rows.length ? a : b)),
            headerIdx: 0,
            score: 0,
          }
        : null;

  const sheetScores = scored.map((s) => ({ name: s.name, score: s.score }));

  if (!picked) {
    return {
      headers: [],
      rows: [],
      sheetNames: wb.SheetNames,
      pickedSheet: "",
      sheetScores,
    };
  }

  const headerRowIdx = picked.headerIdx >= 0 ? picked.headerIdx : 0;
  const headers = (picked.rows[headerRowIdx] ?? []).map((h) =>
    h.trim().toLowerCase()
  );
  const rows = picked.rows
    .slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => c.trim()));

  return {
    headers,
    rows,
    sheetNames: wb.SheetNames,
    pickedSheet: picked.name,
    sheetScores,
  };
}

// ------------------------------------------------------------
// HEADER MAPPING + VALUE PARSERS
// ------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

const HEADER_MAP: Record<string, string> = {
  // título
  update_title: "title",
  post_title: "title",
  title: "title",
  titulo: "title",
  conteudo: "title",
  conteudo_da_publicacao: "title",
  conteudo_do_post: "title",
  texto_do_post: "title",
  texto_da_publicacao: "title",
  publicacao: "title",
  post: "title",
  post_content: "title",

  // data
  date: "date",
  data: "date",
  publication_date: "date",
  posted_on: "date",
  posted_date: "date",
  created_on: "date",
  data_de_postagem: "date",
  data_de_publicacao: "date",
  data_da_publicacao: "date",
  data_do_post: "date",

  // url
  update_url: "url",
  post_url: "url",
  url: "url",
  link: "url",
  post_link: "url",
  update_link: "url",
  url_do_post: "url",
  url_da_publicacao: "url",
  link_do_post: "url",
  link_da_publicacao: "url",
  hyperlink: "url",

  // impressions
  impressions: "impressions",
  impressoes: "impressions",
  total_de_impressoes: "impressions",
  unique_impressions: "unique_impressions",
  impressoes_unicas: "unique_impressions",

  // likes
  likes: "likes",
  reactions: "likes",
  reacoes: "likes",
  curtidas: "likes",
  total_reactions: "likes",
  total_de_reacoes: "likes",
  total_de_curtidas: "likes",

  // comments
  comments: "comments",
  comentarios: "comments",
  total_de_comentarios: "comments",

  // reposts
  reposts: "reposts",
  shares: "reposts",
  compartilhamentos: "reposts",
  republicacoes: "reposts",
  total_de_compartilhamentos: "reposts",
  republicacoes_e_compartilhamentos: "reposts",

  // clicks
  clicks: "clicks",
  cliques: "clicks",
  total_de_cliques: "clicks",

  // engagement
  engagement_rate: "engagement_rate",
  taxa_de_engajamento: "engagement_rate",
  taxa_engajamento: "engagement_rate",
  engagements: "engagements", // contagem raw, se LinkedIn vier com soma
  engajamentos: "engagements",
  total_de_engajamentos: "engagements",
};

function parseNumber(v: string): number {
  if (!v) return 0;
  // Remove %, separadores de milhar (PT-BR usa . como milhar, , como decimal)
  const cleaned = v.replace(/[%]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  // ISO
  const d1 = new Date(v);
  if (!isNaN(d1.getTime())) return d1.toISOString();
  // DD/MM/YYYY
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return dt.toISOString();
  }
  return null;
}

// ------------------------------------------------------------
// HANDLER
// ------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie um arquivo CSV ou XLSX no campo 'file'." },
      { status: 400 }
    );
  }

  const lower = file.name.toLowerCase();
  const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");

  let headers: string[];
  let rows: string[][];
  const debug: {
    sheetNames?: string[];
    pickedSheet?: string;
    sheetScores?: { name: string; score: number }[];
    fileKind: string;
  } = {
    fileKind: isXlsx ? "xlsx" : "csv",
  };

  try {
    if (isXlsx) {
      const buf = await file.arrayBuffer();
      const parsed = await parseXlsx(buf);
      headers = parsed.headers;
      rows = parsed.rows;
      debug.sheetNames = parsed.sheetNames;
      debug.pickedSheet = parsed.pickedSheet;
      debug.sheetScores = parsed.sheetScores;
    } else {
      const text = await file.text();
      const parsed = parseCsv(text);
      headers = parsed.headers;
      rows = parsed.rows;
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: `Falha ao ler o arquivo: ${
          err instanceof Error ? err.message : "formato inválido"
        }`,
      },
      { status: 400 }
    );
  }

  if (!headers.length) {
    return NextResponse.json(
      {
        error:
          "Não consegui identificar nenhum cabeçalho. " +
          (debug.sheetNames?.length
            ? `Abas encontradas: ${debug.sheetNames.join(", ")}.`
            : "") +
          " Confira se o arquivo é o export de Posts do LinkedIn Creator Analytics.",
        debug,
      },
      { status: 400 }
    );
  }

  if (!rows.length) {
    return NextResponse.json(
      {
        error:
          "O cabeçalho foi lido mas não achei linhas com dados. " +
          `Aba lida: ${debug.pickedSheet ?? "(CSV)"} — colunas: ${headers.join(", ")}.`,
        debug,
      },
      { status: 400 }
    );
  }

  // Mapeia colunas
  const colIndex = new Map<string, number>();
  const detected: string[] = [];
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const mapped = HEADER_MAP[norm];
    if (mapped && !colIndex.has(mapped)) {
      colIndex.set(mapped, i);
      detected.push(`${h} → ${mapped}`);
    }
  });

  if (!colIndex.has("impressions")) {
    // Diagnóstico explícito: lista TODAS as colunas que a gente leu
    return NextResponse.json(
      {
        error:
          "Não achei a coluna de Impressions / Impressões. " +
          `Aba lida: ${debug.pickedSheet ?? "(CSV)"}. ` +
          `Colunas detectadas no arquivo: ${headers
            .map((h) => `"${h}"`)
            .join(", ")}. ` +
          (debug.sheetNames && debug.sheetNames.length > 1
            ? `Outras abas no arquivo: ${debug.sheetNames
                .filter((n) => n !== debug.pickedSheet)
                .join(", ")}. ` +
              "Se o relatório certo está em outra aba, exporte só essa aba como xlsx separado."
            : "Confira se o export é o de 'Posts' / 'Top Posts'."),
        headers,
        debug,
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const inserts: Array<Record<string, unknown>> = [];

  function pick(name: string, row: string[]): string {
    const i = colIndex.get(name);
    if (i === undefined) return "";
    return (row[i] ?? "").toString().trim();
  }

  for (const row of rows) {
    const impressions = parseNumber(pick("impressions", row));
    const likes = parseNumber(pick("likes", row));
    const comments = parseNumber(pick("comments", row));
    const reposts = parseNumber(pick("reposts", row));
    const clicks = parseNumber(pick("clicks", row));
    const url = pick("url", row) || null;
    const titleRaw = pick("title", row);
    // Limita a 240 chars pra não estourar UI — o título completo costuma
    // ser o post inteiro no export do LinkedIn.
    const title = titleRaw ? titleRaw.replace(/\s+/g, " ").slice(0, 240) : null;
    const postedAt = parseDate(pick("date", row));
    const engagement_rate =
      impressions > 0
        ? Number(((likes + comments + reposts + clicks) / impressions).toFixed(4))
        : null;

    inserts.push({
      user_id: user.id,
      linkedin_post_url: url,
      title,
      posted_at: postedAt,
      impressions: Math.round(impressions),
      likes: Math.round(likes),
      comments: Math.round(comments),
      reposts: Math.round(reposts),
      clicks: Math.round(clicks),
      engagement_rate,
      source: "csv",
      fetched_at: new Date().toISOString(),
    });
  }

  if (!inserts.length) {
    return NextResponse.json({ error: "Nenhuma linha válida." }, { status: 400 });
  }

  const { data, error } = await supabase.from("post_metrics").insert(inserts).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aprendizado automático em background — pega posts de alto desempenho
  // (impressões > 2x a média do líder) e extrai padrões pra learned_preferences.
  // Usa after() pra garantir execução pós-resposta em serverless (sem isso
  // o trabalho era abortado e o aprendizado nunca rodava em prod).
  after(async () => {
    try {
      await learnFromHighPerformers(user.id);
    } catch (err) {
      console.error("[metrics] auto-learn failed", err);
    }
  });

  return NextResponse.json({
    inserted: data?.length ?? 0,
    detected_columns: detected,
    sheet: debug.pickedSheet ?? null,
  });
}
