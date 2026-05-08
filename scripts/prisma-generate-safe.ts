import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const command = process.platform === "win32" ? "npx prisma generate" : "npx prisma generate";
const result = spawnSync(command, {
  stdio: "pipe",
  encoding: "utf8",
  shell: true,
});

const stderr = result.stderr || "";
const isWindowsEngineRenameEperm =
  stderr.includes("EPERM: operation not permitted, rename") &&
  stderr.includes("query_engine-windows.dll.node.tmp") &&
  stderr.includes("query_engine-windows.dll.node");

if (isWindowsEngineRenameEperm) {
  if (result.stdout) process.stdout.write(result.stdout);

  try {
    const prismaClientDir = path.join(process.cwd(), "node_modules", ".prisma", "client");
    const entries = fs.readdirSync(prismaClientDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith("query_engine-windows.dll.node.tmp")) continue;
      try {
        fs.rmSync(path.join(prismaClientDir, entry.name), { force: true });
      } catch {
      }
    }
  } catch {
  }
  process.exit(0);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status === 0) {
  process.exit(0);
}

process.exit(result.status ?? 1);
