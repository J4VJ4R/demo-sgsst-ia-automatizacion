import assert from "node:assert";
import {
  getActivityPriorityInfo,
} from "@/components/activities/activity-list";
import { getPriorityBadgeClass } from "@/lib/utils";

async function run() {
  const vencido = getActivityPriorityInfo("Vencido", "Plan Anual de Trabajo");
  assert.strictEqual(vencido.label, "Vencido");

  const porVencer = getActivityPriorityInfo("Por vencer", "Plan Anual de Trabajo");
  assert.strictEqual(porVencer.label, "Por vencer");

  const cumplido = getActivityPriorityInfo("Cumplido", "Plan Anual de Trabajo");
  assert.strictEqual(cumplido.label, "Cumplido");

  assert.strictEqual(getPriorityBadgeClass("Vencido"), "bg-red-500/90 text-white");
  assert.strictEqual(getPriorityBadgeClass("Por vencer"), "bg-yellow-400/90 text-black");
  assert.strictEqual(getPriorityBadgeClass("Cumplido"), "bg-emerald-400/90 text-black");

  assert.notStrictEqual(getPriorityBadgeClass("Vencido"), getPriorityBadgeClass("Por vencer"));
  assert.notStrictEqual(getPriorityBadgeClass("Vencido"), getPriorityBadgeClass("Cumplido"));

  console.log("activities-priority tests passed");
}

run();
