import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptJson } from "../_crypto";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo") || "");
  const origin = url.origin;

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "misconfigured", reason: "missing_client_id" }), origin));
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  try {
    cookieStore.set("gcal_oauth_state", encryptJson({ state, returnTo, createdAt: Date.now() }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
  } catch {
    return NextResponse.redirect(new URL(withParams(returnTo, { gcal: "misconfigured", reason: "missing_encryption_key" }), origin));
  }

  const redirectUri = getRedirectUri(req);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email https://www.googleapis.com/auth/calendar.readonly");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
