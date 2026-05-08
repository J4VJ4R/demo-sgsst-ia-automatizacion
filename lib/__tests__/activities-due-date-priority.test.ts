import assert from "node:assert";
import {
  calculatePriority,
} from "@/lib/priority-logic";

async function run() {
  const today = new Date(2026, 1, 23); // 23 Feb 2026

  const past = new Date(2026, 0, 10);
  const pastResult = calculatePriority(past, today);
  assert.strictEqual(pastResult.priority, "Vencido");

  const todayDate = new Date(2026, 1, 23);
  const todayResult = calculatePriority(todayDate, today);
  assert.strictEqual(todayResult.priority, "Vencido");

  const inThreeDays = new Date(2026, 1, 26);
  const threeDaysResult = calculatePriority(inThreeDays, today);
  assert.strictEqual(threeDaysResult.priority, "Por vencer");

  const inSixDays = new Date(2026, 2, 1); // Feb 23 + 6 days = Mar 1 (2026 is not leap)
  const sixDaysResult = calculatePriority(inSixDays, today);
  assert.strictEqual(sixDaysResult.priority, "Por vencer");

  const inTenDays = new Date(2026, 2, 5); // Feb 23 + 10 days = Mar 5
  const tenDaysResult = calculatePriority(inTenDays, today);
  assert.strictEqual(tenDaysResult.priority, "Por vencer");

  const inElevenDays = new Date(2026, 2, 6); // Feb 23 + 11 days = Mar 6
  const elevenDaysResult = calculatePriority(inElevenDays, today);
  assert.strictEqual(elevenDaysResult.priority, "Por vencer");

  const inFifteenDays = new Date(2026, 2, 10);
  const fifteenDaysResult = calculatePriority(inFifteenDays, today);
  assert.strictEqual(fifteenDaysResult.priority, "Por vencer");

  const inSixteenDays = new Date(2026, 2, 11);
  const sixteenDaysResult = calculatePriority(inSixteenDays, today);
  assert.strictEqual(sixteenDaysResult.priority, "Por vencer");
  assert.strictEqual(sixteenDaysResult.isValid, true);

  const inThirtyOneDays = new Date(2026, 2, 26);
  const thirtyOneDaysResult = calculatePriority(inThirtyOneDays, today);
  assert.strictEqual(thirtyOneDaysResult.priority, "Cumplido");

  console.log("activities-due-date-priority tests passed");
}

run();
