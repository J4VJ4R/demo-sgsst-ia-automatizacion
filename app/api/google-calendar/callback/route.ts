import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptJson, encryptJson } from "../_crypto";

export const runtime = "nodejs";

type OAuthState = { state: string; returnTo: string; createdAt: number };

function safeReturnTo(raw: string) {
  const v = (raw || "").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/overview";
  return v;
}

function withParams(path: string, params: Record<string, string>) {
  const u = new URL(path, "http://local");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return `${u.pathname}${u.search}${u.hash}`;
}

function getRedirectUri(req: Request) {
  const env = (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  if (env) return env;

  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}/api/google-calendar/callback`;
}

async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
}) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados.");

  const body = new URLSearchParams();
  body.set("code", args.code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", args.redirectUri);
  body.set("grant_type", "authorization_code");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const detail =
      (typeof json?.error_description === "string" && json.error_description) ||
      (typeof json?.error === "string" && json.error) ||
      "No se pudo autenticar con Google.";
    throw new Error(detail);
  }

  return {
    accessToken: typeof json?.access_token === "string" ? json.access_token : "",
    refreshToken: typeof json?.refresh_token === "string" ? json.refresh_token : "",
    expiresIn: typeof json?.expires_in === "number" ? json.expires_in : null,
  };
}

async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new Error("No se pudo leer el correo de Google.");
  const email = typeof json?.email === "string" ? json.email : "";
  return email;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const error = (url.searchParams.get("error") || "").trim();

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("gcal_oauth_state")?.value || "";
  try {
    cookieStore.delete("gcal_oauth_state");
  } catch {
  }

  let returnTo = "/overview";
  try {
    if (stateCookie) {
      const decoded = decryptJson<OAuthState>(stateCookie);
      returnTo = safeReturnTo(decoded.returnTo || "/overview");
      if (!state || state !== decoded.state) {
        return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "error_state" }), origin));
      }
    }
  } catch {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "error_state" }), origin));
  }

  if (error) {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "cancelled" }), origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "missing_code" }), origin));
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokens = await exchangeCodeForTokens({ code, redirectUri });
    if (!tokens.refreshToken) {
      return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "missing_refresh" }), origin));
    }
    const email = await fetchGoogleEmail(tokens.accessToken).catch(() => "");

    cookieStore.set(
      "gcal_conn",
      encryptJson({
        refreshToken: tokens.refreshToken,
        email,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      }
    );

    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "connected" }), origin));
  } catch {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "error" }), origin));
  }
}
