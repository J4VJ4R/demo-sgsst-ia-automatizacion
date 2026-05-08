import assert from "node:assert";
import { formatBytes } from "@/components/activities/requirement-actions";

async function run() {
  assert.strictEqual(formatBytes(null), "Tamaño desconocido");
  assert.strictEqual(formatBytes(undefined), "Tamaño desconocido");
  assert.strictEqual(formatBytes(0), "Tamaño desconocido");

  const kbLabel = formatBytes(1024);
  assert.ok(kbLabel.endsWith("KB"), "Debe formatear 1KB en KB");

  const mbLabel = formatBytes(5 * 1024 * 1024);
  assert.ok(mbLabel.endsWith("MB"), "Debe formatear 5MB en MB");

  const gbLabel = formatBytes(3 * 1024 * 1024 * 1024);
  assert.ok(gbLabel.endsWith("GB"), "Debe formatear 3GB en GB");

  console.log("document-timeline tests passed");
}

run();
