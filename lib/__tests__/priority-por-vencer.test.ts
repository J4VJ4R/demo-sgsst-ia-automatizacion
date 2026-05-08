import assert from "node:assert/strict";
import { calculatePriority } from "../priority-logic";

function run() {
  const now = new Date("2026-03-10T12:00:00Z");
  const dueSoon = new Date("2026-03-12T08:00:00Z");
  const overdue = new Date("2026-03-09T23:00:00Z");
  const inTwentyDays = new Date("2026-03-30T08:00:00Z");
  const inFortyDays = new Date("2026-04-19T08:00:00Z");

  assert.equal(calculatePriority(overdue, now).priority, "Vencido");
  assert.equal(calculatePriority(dueSoon, now).priority, "Por vencer");
  assert.equal(calculatePriority(inTwentyDays, now).priority, "Cumplido");
  assert.equal(calculatePriority(inFortyDays, now).priority, "Cumplido");

  console.log("priority-por-vencer tests passed");
}

run();
