'use server'

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { getCurrentUser as getCurrentUserLib, primeUserCache } from "@/lib/auth";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";

function normalizeEmail(raw: unknown) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordOk(password: string) {
  const p = (password || "").trim();
  return p.length >= 8;
}

function getResetHmacKey() {
  const raw = (process.env.APP_ENCRYPTION_KEY || "").trim();
  if (!raw) return "";
  return raw;
}

function signResetToken(user: { id: string; password: string }, expMs: number) {
  const key = getResetHmacKey();
  if (!key) return "";
  const msg = `${user.id}.${expMs}.${user.password}`;
  return createHmac("sha256", key).update(msg).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 0) return "invalid";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
}

function normalizeResendErrorMessage(message: string) {
  const norm = (message || "").toLowerCase();
  if (
    norm.includes("invalid api key") ||
    norm.includes("unauthorized") ||
    norm.includes("forbidden") ||
    norm.includes("missing api key")
  ) {
    return "Correo no configurado correctamente (RESEND_API_KEY inválida).";
  }
  if (norm.includes("verify") && norm.includes("domain")) {
    return "Dominio de envío no verificado en Resend. Verifica tu dominio o configura RESEND_FROM con un dominio verificado.";
  }
  if (norm.includes("verified recipients") || norm.includes("only send")) {
    return "Resend está en modo prueba y no permite enviar a ese correo. Verifica dominio o habilita destinatarios permitidos en Resend.";
  }
  return message || "No se pudo enviar el correo.";
}

async function setSession(user: { id: string; email: string; name: string; role: string; image: string | null }) {
  const cookieStore = await cookies();
  cookieStore.set("session_user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  primeUserCache({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
    deletedAt: null,
  });
}

export async function login(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return { success: false, error: "Email y contraseña requeridos" };
  }

  let user: { id: string; email: string; password: string; name: string; role: string; image: string | null; deletedAt: Date | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, password: true, name: true, role: true, image: true, deletedAt: true },
    });
  } catch (error) {
    console.error("Login failed: database unavailable");
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }

  if (!user) {
    console.log(`Login failed: User not found for email '${email}'`);
    return { success: false, error: "Credenciales inválidas" };
  }

  // Secure comparison using bcrypt
  let passwordsMatch = false;
  try {
    passwordsMatch = await compare(password, user.password);
  } catch (error) {
    passwordsMatch = false;
  }

  if (!passwordsMatch) {
    const legacyMatch = user.password === password;
    if (legacyMatch) {
      passwordsMatch = true;
      try {
        const hashed = await hash(password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        });
      } catch {}
    } else {
      console.log(`Login failed: Invalid password for user '${email}'`);
      return { success: false, error: "Credenciales inválidas" };
    }
  }

  await setSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
  });

  return { success: true };
}

export async function registerStudent(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return { success: false, error: "Correo y contraseña requeridos." };
  }
  if (!isValidEmail(email)) return { success: false, error: "Correo inválido." };
  if (!passwordOk(password)) return { success: false, error: "La contraseña debe tener mínimo 8 caracteres." };

  let existing: { id: string; deletedAt: Date | null } | null = null;
  try {
    existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
  } catch {
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }
  if (existing && !existing.deletedAt) {
    return { success: false, error: "Este correo ya está registrado." };
  }

  const displayName = email.split("@")[0]?.trim() || "Estudiante";
  const hashed = await hash(password, 10);
  let user: { id: string; email: string; name: string; role: string; image: string | null } | null = null;
  try {
    user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: displayName,
        role: "STUDENT",
        password: hashed,
      },
      update: {
        deletedAt: null,
        name: displayName,
        role: "STUDENT",
        password: hashed,
      },
      select: { id: true, email: true, name: true, role: true, image: true },
    });
  } catch {
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }

  await setSession(user);
  return { success: true };
}

export async function requestStudentPasswordReset(formData: FormData) {
  const debugId = randomUUID();
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { success: true, debugId };
  if (!isValidEmail(email)) return { success: true, debugId };

  if (!getResetHmacKey()) {
    return { success: false, error: "Recuperación no configurada (falta APP_ENCRYPTION_KEY).", debugId };
  }

  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendKey || resendKey === "re_123456789") {
    return { success: false, error: "Correo no configurado (falta RESEND_API_KEY en el servidor).", debugId };
  }

  let user: { id: string; email: string; password: string; role: string } | null = null;
  try {
    user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, password: true, role: true },
    });
  } catch {
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }

  if (!user || user.role !== "STUDENT") {
    console.info("student_password_reset: user not found or not student", {
      debugId,
      email: maskEmail(email),
    });
    return { success: true, debugId };
  }

  const expMs = Date.now() + 1000 * 60 * 30;
  const sig = signResetToken({ id: user.id, password: user.password }, expMs);
  if (!sig) {
    return { success: false, error: "Recuperación no configurada (falta APP_ENCRYPTION_KEY)." };
  }

  const token = `${user.id}.${expMs}.${sig}`;

  const from = (process.env.RESEND_FROM || "SG-SST-IA <onboarding@resend.dev>").trim();
  const baseUrl =
    (process.env.APP_BASE_URL || "").trim() ||
    (process.env.NODE_ENV === "production" ? "https://app.pmdservicios.com" : "http://localhost:3000");
  const resetUrl = `${baseUrl}/login/formacion/reset?token=${encodeURIComponent(token)}`;

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: "Recuperación de contraseña - Formación empresarial",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a;">
        <h2 style="margin:0 0 12px 0;">Recuperación de contraseña</h2>
        <p style="margin:0 0 12px 0;">Recibimos una solicitud para restablecer tu contraseña de Formación empresarial.</p>
        <p style="margin:0 0 18px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;">
            Restablecer contraseña
          </a>
        </p>
        <p style="margin:0;color:#475569;font-size:12px;">Este enlace expira en 30 minutos.</p>
      </div>
    `,
  });

  if (error) {
    const message = typeof (error as unknown as { message?: unknown })?.message === "string" ? (error as { message: string }).message : "";
    console.error("student_password_reset: resend error", {
      debugId,
      email: maskEmail(email),
      message,
    });
    return { success: false, error: normalizeResendErrorMessage(message) };
  }

  console.info("student_password_reset: email sent", {
    debugId,
    email: maskEmail(email),
    resendId: (data as unknown as { id?: unknown } | null)?.id || null,
  });

  return { success: true, debugId };
}

export async function resetStudentPassword(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "").trim();
  if (!token || !password) return { success: false, error: "Token y contraseña requeridos." };
  if (!passwordOk(password)) return { success: false, error: "La contraseña debe tener mínimo 8 caracteres." };

  const parts = token.split(".");
  if (parts.length !== 3) return { success: false, error: "Token inválido." };
  const [userId, expRaw, sig] = parts;
  const expMs = Number(expRaw);
  if (!userId || !Number.isFinite(expMs)) return { success: false, error: "Token inválido." };
  if (Date.now() > expMs) return { success: false, error: "El enlace expiró. Solicita otro." };

  let user: { id: string; password: string; role: string } | null = null;
  try {
    user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, password: true, role: true },
    });
  } catch {
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }
  if (!user || user.role !== "STUDENT") return { success: false, error: "Token inválido." };

  const expected = signResetToken({ id: user.id, password: user.password }, expMs);
  if (!expected || !safeEqual(expected, sig)) return { success: false, error: "Token inválido." };

  const hashed = await hash(password, 10);
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
  } catch {
    return { success: false, error: "No se pudo conectar a la base de datos. Intenta nuevamente." };
  }

  return { success: true };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('session_user_id');
  redirect('/login');
}

export async function getCurrentUser() {
  return getCurrentUserLib();
}
