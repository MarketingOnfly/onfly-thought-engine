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
const DEFAULT_SCOPES = ["openid", "profile", "email"].join(" ");

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
