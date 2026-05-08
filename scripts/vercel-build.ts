import { spawn } from "child_process";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function runWithRetry(command: string, args: string[], opts: { retries: number; backoffMs: number[] }) {
  let attempt = 0;
  while (true) {
    try {
      await run(command, args);
      return;
    } catch (err) {
      attempt += 1;
      if (attempt > opts.retries) throw err;
      const delay = opts.backoffMs[Math.min(attempt - 1, opts.backoffMs.length - 1)] ?? 10_000;
      await sleep(delay);
    }
  }
}

async function main() {
  const schema = "prisma/schema.prod.prisma";
  const shouldRunMigrations = (process.env.RUN_MIGRATIONS || "").toLowerCase() === "true";

  if (shouldRunMigrations) {
    await runWithRetry("npx", ["prisma", "migrate", "deploy", "--schema", schema], {
      retries: 6,
      backoffMs: [5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000],
    });
  }

  await run("npx", ["prisma", "generate", "--schema", schema]);
  await run("npx", ["next", "build"]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
