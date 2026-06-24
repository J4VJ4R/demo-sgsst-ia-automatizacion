import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "Logout demo exitoso. El cliente móvil debe descartar el token localmente.",
  });
}
