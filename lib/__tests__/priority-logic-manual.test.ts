import { calculatePriority } from "../priority-logic";

function testCalculatePriority() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const testCases = [
    { days: -1, expected: "Vencido", valid: true },
    { days: 0, expected: "Vencido", valid: true },
    { days: 3, expected: "Por vencer", valid: true },
    { days: 15, expected: "Por vencer", valid: true },
    { days: 16, expected: "Por vencer", valid: true },
    { days: 30, expected: "Por vencer", valid: true },
    { days: 31, expected: "Cumplido", valid: true },
  ];

  console.log("Starting Priority Logic Tests...");
  let passed = 0;
  let failed = 0;

  testCases.forEach((tc) => {
    const d = new Date(today);
    d.setDate(today.getDate() + tc.days);
    
    const result = calculatePriority(d);
    
    const priorityMatch = result.priority === tc.expected;
    const validityMatch = result.isValid === tc.valid;

    if (priorityMatch && validityMatch) {
      console.log(`PASS: Day ${tc.days} -> Priority: ${result.priority}, Valid: ${result.isValid}`);
      passed++;
    } else {
      console.error(`FAIL: Day ${tc.days} -> Expected ${tc.expected}/${tc.valid}, Got ${result.priority}/${result.isValid}`);
      failed++;
    }
  });

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

testCalculatePriority();
