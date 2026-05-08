import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const expected = process.env.DB_HEALTH_TOKEN || "";

  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
  }

  try {
    const result = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    const now = result?.[0]?.now ? new Date(result[0].now).toISOString() : null;
    return new Response(JSON.stringify({ ok: true, now }), { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: "DB_UNAVAILABLE", message }), { status: 500 });
  }
}

