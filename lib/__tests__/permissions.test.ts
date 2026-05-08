
import { canEditDueDate } from "@/lib/permissions";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(e.message);
    process.exit(1);
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
  };
}

console.log("Running Permissions Tests...");

test("should allow editing for ADMIN_PMD", () => {
  expect(canEditDueDate("ADMIN_PMD")).toBe(true);
});

test("should allow editing for undefined role (backward compatibility)", () => {
  expect(canEditDueDate(undefined)).toBe(true);
});

test("should disable editing for CONSULTANT", () => {
  expect(canEditDueDate("CONSULTANT")).toBe(false);
});

test("should disable editing for CLIENT", () => {
  expect(canEditDueDate("CLIENT")).toBe(false);
});

test("should allow editing for other roles", () => {
  expect(canEditDueDate("OTHER_ROLE")).toBe(true);
});

console.log("Tests completed.");
