/**
 * LinkedIn OAuth + API client.
 *
 * Default scopes ("openid profile email") give name + photo + email + LinkedIn ID
 * sem precisar de aprovação especial.
 *
 * Para impressões/reações por post o app precisa ser aprovado em
 * "Marketing Developer Platform" no LinkedIn Developer Console. Marcamos
 * marketing_api_status = pending/approved/denied conforme o status real.
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// Scopes default disponíveis pra todo mundo:
// - openid/profile/email: vem com "Sign In with LinkedIn using OpenID Connect"
// - w_member_social: vem com o product "Share on LinkedIn" (aprovação instantânea)
//   Permite publicar posts em nome do usuário autorizado.
const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
].join(" ");

interface OAuthCreds {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function creds(): OAuthCreds {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "LinkedIn não está configurado. Adicione LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET e LINKEDIN_REDIRECT_URI no .env.local."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Server-side: retorna se LinkedIn OAuth está configurado e quais vars
 * faltam. Não throwa — usado pra renderizar a UI defensivamente, sem
 * deixar o líder clicar num botão que vai falhar.
 */
export function getLinkedInConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.LINKEDIN_CLIENT_ID) missing.push("LINKEDIN_CLIENT_ID");
  if (!process.env.LINKEDIN_CLIENT_SECRET) missing.push("LINKEDIN_CLIENT_SECRET");
  if (!process.env.LINKEDIN_REDIRECT_URI) missing.push("LINKEDIN_REDIRECT_URI");
  return { configured: missing.length === 0, missing };
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = creds();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: DEFAULT_SCOPES,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = creds();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  locale?: { country: string; language: string } | string;
}

export async function fetchProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn userinfo failed: ${res.status} ${text}`);
  }
  return (await res.json()) as LinkedInProfile;
}

/**
 * Publica um post de texto no perfil pessoal do usuário (UGC API).
 *
 * Requer scope `w_member_social` no token (product "Share on LinkedIn").
 *
 * Devolve { urn, url }. URL é construída a partir do URN (LinkedIn não
 * retorna explicitamente, mas é determinística).
 */
export async function publishPost(opts: {
  accessToken: string;
  linkedinUserId: string; // sub do userinfo, ex: "abc123"
  text: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
}): Promise<{ urn: string | null; url: string | null }> {
  const visibility = opts.visibility ?? "PUBLIC";
  const authorUrn = `urn:li:person:${opts.linkedinUserId}`;

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: opts.text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${opts.accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let message = `LinkedIn API ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      message = parsed.message ?? parsed.error ?? errText.slice(0, 200);
    } catch {
      if (errText) message = errText.slice(0, 200);
    }
    // Códigos comuns:
    if (res.status === 401) {
      throw new Error(
        "Token do LinkedIn expirou ou foi revogado. Reconecta sua conta na aba Analytics."
      );
    }
    if (res.status === 403) {
      throw new Error(
        "Sem permissão pra publicar. O product 'Share on LinkedIn' precisa estar ativo no app + o usuário precisa reautorizar (escopos novos)."
      );
    }
    if (res.status === 422) {
      throw new Error(`LinkedIn rejeitou o conteúdo: ${message}`);
    }
    throw new Error(message);
  }

  // O URN do post vai no header `x-restli-id` OU no body.id
  const urn =
    res.headers.get("x-restli-id") ??
    (await res
      .clone()
      .json()
      .then((j: { id?: string }) => j.id ?? null)
      .catch(() => null));

  // IMPORTANTE: o status 200 do LinkedIn significa que o post FOI
  // publicado. Mesmo sem URN, não podemos throw aqui — se a gente
  // throw, o cliente vai assumir que falhou e pode tentar republicar,
  // gerando POST DUPLICADO no feed do líder. Devolvemos urn=null +
  // url=null e o caller marca como "publicado sem rastreio".
  if (!urn) {
    return { urn: null, url: null };
  }

  // URL pública do post (formato determinístico do LinkedIn)
  // urn:li:share:1234567 → https://www.linkedin.com/feed/update/urn:li:share:1234567
  const url = `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;

  return { urn, url };
}

/**
 * Attempt to fetch follower count.
 *
 * /v2/networkSizes is restricted; depends on r_1st_connections_size scope.
 * If not granted, returns null silently.
 */
export async function fetchFollowerCount(
  accessToken: string,
  linkedinUserId: string
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/networkSizes/urn:li:person:${linkedinUserId}?edgeType=CompanyFollowedByMember`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
          "Linkedin-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { firstDegreeSize?: number };
    return typeof data.firstDegreeSize === "number" ? data.firstDegreeSize : null;
  } catch {
    return null;
  }
}
