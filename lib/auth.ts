import { cookies } from "next/headers";
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
