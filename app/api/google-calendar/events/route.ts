import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptJson } from "../_crypto";

export const runtime = "nodejs";

type Conn = { refreshToken: string; email?: string; createdAt: number; updatedAt: number };

function parseDateOnly(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth no configurado.");

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);
  body.set("grant_type", "refresh_token");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const detail = typeof json?.error_description === "string" ? json.error_description : "No se pudo refrescar el token.";
    throw new Error(detail);
  }
  return typeof json?.access_token === "string" ? json.access_token : "";
}

async function listEvents(args: { accessToken: string; timeMin: string; timeMax: string; timeZone: string }) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", args.timeMin);
  url.searchParams.set("timeMax", args.timeMax);
  url.searchParams.set("timeZone", args.timeZone);
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const errorObj = (json?.error as Record<string, unknown> | undefined) || undefined;
    const message = typeof errorObj?.message === "string" ? errorObj.message : "No se pudo consultar eventos.";
    throw new Error(message);
  }
  const items = Array.isArray(json?.items) ? (json?.items as unknown[]) : [];
  return items;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const startParam = (url.searchParams.get("start") || "").trim();
  const daysParam = (url.searchParams.get("days") || "5").trim();

  const startDate = parseDateOnly(startParam);
  const days = Math.max(1, Math.min(14, parseInt(daysParam, 10) || 5));
  if (!startDate) return NextResponse.json({ connected: false, error: "Fecha inválida." }, { status: 400 });

  const cookieStore = await cookies();
  const token = cookieStore.get("gcal_conn")?.value || "";
  if (!token) return NextResponse.json({ connected: false }, { status: 401 });

  let conn: Conn;
  try {
    conn = decryptJson<Conn>(token);
  } catch {
    return NextResponse.json({ connected: false }, { status: 401 });
  }
  if (!conn.refreshToken) return NextResponse.json({ connected: false }, { status: 401 });

  const timeZone = "America/Bogota";
  const timeMinDate = new Date(startDate);
  timeMinDate.setHours(0, 0, 0, 0);
  const timeMaxDate = addDays(timeMinDate, days);

  try {
    const accessToken = await refreshAccessToken(conn.refreshToken);
    const items = await listEvents({
      accessToken,
      timeMin: timeMinDate.toISOString(),
      timeMax: timeMaxDate.toISOString(),
      timeZone,
    });

    const buckets = new Map<
      string,
      Array<{
        id: string;
        summary: string;
        start: string;
        end: string;
        startIso: string;
        endIso?: string | null;
        htmlLink?: string | null;
      }>
    >();
    for (let i = 0; i < days; i++) {
      buckets.set(fmtDateKey(addDays(timeMinDate, i)), []);
    }

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as Record<string, unknown>;
      const id = typeof it.id === "string" ? it.id : "";
      const summary = typeof it.summary === "string" ? it.summary : "";
      const htmlLink = typeof it.htmlLink === "string" ? it.htmlLink : null;

      const startObj = it.start && typeof it.start === "object" ? (it.start as Record<string, unknown>) : null;
      const endObj = it.end && typeof it.end === "object" ? (it.end as Record<string, unknown>) : null;
      const startIso =
        startObj && typeof startObj.dateTime === "string"
          ? startObj.dateTime
          : startObj && typeof startObj.date === "string"
            ? startObj.date
            : "";
      const endIso =
        endObj && typeof endObj.dateTime === "string"
          ? endObj.dateTime
          : endObj && typeof endObj.date === "string"
            ? endObj.date
            : "";
      if (!id || !startIso) continue;

      const start = new Date(startIso);
      const end = endIso ? new Date(endIso) : null;
      if (Number.isNaN(start.getTime())) continue;

      const dayKey = fmtDateKey(start);
      const list = buckets.get(dayKey);
      if (!list) continue;

      const isAllDay = startIso.length === 10;
      const startLabel = isAllDay ? "Todo el día" : fmtTime(start);
      const endLabel = isAllDay ? "" : end && !Number.isNaN(end.getTime()) ? fmtTime(end) : "";

      list.push({
        id,
        summary,
        start: startLabel,
        end: endLabel,
        startIso,
        endIso: endIso || null,
        htmlLink,
      });
    }

    const daysOut = Array.from(buckets.entries()).map(([date, events]) => ({ date, events }));
    return NextResponse.json({
      connected: true as const,
      email: conn.email || "Cuenta Google",
      timeZone,
      start: startParam,
      end: fmtDateKey(timeMaxDate),
      days: daysOut,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la agenda.";
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}
