import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKeyBytes() {
  const raw = (process.env.APP_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("APP_ENCRYPTION_KEY no está configurada.");

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  throw new Error("APP_ENCRYPTION_KEY debe ser base64 (32 bytes) o hex (64 chars).");
}

export function encryptJson(payload: unknown) {
  const key = getKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptJson<T>(token: string): T {
  const key = getKeyBytes();
  const buf = Buffer.from(token, "base64url");
  if (buf.length < 12 + 16 + 1) throw new Error("Token inválido.");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

