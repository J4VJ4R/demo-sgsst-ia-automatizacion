import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";

type CachedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
  deletedAt: Date | null;
};

const globalForAuth = globalThis as unknown as {
  authUserCache?: Map<string, { user: CachedUser; cachedAt: number }>;
};

const authUserCache = globalForAuth.authUserCache ?? new Map<string, { user: CachedUser; cachedAt: number }>();
globalForAuth.authUserCache = authUserCache;

export function primeUserCache(user: CachedUser) {
  authUserCache.set(user.id, { user, cachedAt: Date.now() });
}

function getMobileApiSecret() {
  return (
    process.env.MOBILE_API_SECRET?.trim() ||
    process.env.APP_ENCRYPTION_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function signMobileToken(user: { id: string; password?: string | null }, expMs: number) {
  const secret = getMobileApiSecret();
  if (!secret) return "";
  const msg = `${user.id}.${expMs}.${user.password || ""}`;
  return createHmac("sha256", secret).update(msg).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function createMobileApiToken(user: { id: string; password?: string | null }, expiresInSeconds = 60 * 60 * 24 * 7) {
  const expMs = Date.now() + expiresInSeconds * 1000;
  const sig = signMobileToken(user, expMs);
  if (!sig) return "";
  return `${user.id}.${expMs}.${sig}`;
}

export async function getCurrentUserFromMobileToken(request: Request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token) return null;

  const [userId, expRaw, sig] = token.split(".");
  const expMs = Number(expRaw);
  if (!userId || !sig || !Number.isFinite(expMs) || expMs <= Date.now()) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        deletedAt: true,
        password: true,
      },
    });

    if (!user || user.deletedAt) return null;
    const expected = signMobileToken(user, expMs);
    if (!expected || !safeEqual(sig, expected)) return null;

    const cachedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      deletedAt: user.deletedAt,
    };
    primeUserCache(cachedUser);
    return cachedUser;
  } catch (error) {
    console.error("Error fetching mobile auth user:", error);
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_user_id')?.value;

  if (!userId) return null;

  try {
    const cached = authUserCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < 60_000 && !cached.user.deletedAt) {
      return cached.user;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) return null;
    primeUserCache(user);
    return user;
  } catch (error) {
    const cached = authUserCache.get(userId);
    if (cached && !cached.user.deletedAt && Date.now() - cached.cachedAt < 15 * 60_000) {
      return cached.user;
    }
    console.error("Error fetching current user:", error);
    return null;
  }
}
