import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createMobileApiToken, primeUserCache } from "@/lib/auth";

function normalizeEmail(raw: unknown) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function exposeUser(user: { id: string; email: string; name: string; role: string; image: string | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || "").trim();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email y contraseña requeridos." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, password: true, name: true, role: true, image: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ success: false, error: "Credenciales inválidas." }, { status: 401 });
    }

    let passwordsMatch = false;
    try {
      passwordsMatch = await compare(password, user.password);
    } catch {
      passwordsMatch = false;
    }

    if (!passwordsMatch) {
      const legacyMatch = user.password === password;
      if (!legacyMatch) {
        return NextResponse.json({ success: false, error: "Credenciales inválidas." }, { status: 401 });
      }

      passwordsMatch = true;
      try {
        const hashed = await hash(password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        });
        user.password = hashed;
      } catch {
      }
    }

    const token = createMobileApiToken({ id: user.id, password: user.password });
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Auth móvil no configurada. Define MOBILE_API_SECRET o APP_ENCRYPTION_KEY." },
        { status: 500 }
      );
    }

    primeUserCache({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      deletedAt: null,
    });

    return NextResponse.json({
      success: true,
      token,
      tokenType: "Bearer",
      expiresIn: 60 * 60 * 24 * 7,
      user: exposeUser(user),
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json({ success: false, error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
