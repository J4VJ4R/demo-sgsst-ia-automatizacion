import { NextResponse } from "next/server";
import { getCurrentUserFromMobileToken } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUserFromMobileToken(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
    },
  });
}
