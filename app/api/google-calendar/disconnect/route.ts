import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("gcal_conn");
  cookieStore.delete("gcal_oauth_state");
  return NextResponse.json({ success: true });
}
