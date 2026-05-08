import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL no está configurada");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const sslMode = url.searchParams.get("sslmode");
  const ssl = url.searchParams.get("ssl");
  if (sslMode || ssl) return raw;

  const host = (url.hostname || "").toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1";

  if (process.env.NODE_ENV === "production" && !isLocal) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const cached = globalForPrisma.prisma;
const prisma =
  cached && (cached as unknown as Record<string, unknown>).minimumIndicator
    ? cached
    : prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
