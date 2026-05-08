import { translatePriority } from "../utils";

function testTranslatePriority() {
  const cases = [
    { input: "HIGH", expected: "Vencido" },
    { input: "High", expected: "Vencido" },
    { input: "high", expected: "Vencido" },
    { input: "Alta", expected: "Vencido" },
    { input: "alta", expected: "Vencido" },
    { input: "CRITICAL", expected: "Vencido" },
    { input: "Vencido", expected: "Vencido" },

    { input: "MEDIUM", expected: "Por vencer" },
    { input: "Medium", expected: "Por vencer" },
    { input: "media", expected: "Por vencer" },
    { input: "Por vencer", expected: "Por vencer" },

    { input: "LOW", expected: "Cumplido" },
    { input: "Low", expected: "Cumplido" },
    { input: "baja", expected: "Cumplido" },
    { input: "Cumplido", expected: "Cumplido" },
    
    { input: null, expected: "Cumplido" },
    { input: undefined, expected: "Cumplido" },
    { input: "Unknown", expected: "Cumplido" },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(({ input, expected }) => {
    const result = translatePriority(input);
    if (result === expected) {
      // console.log(`PASS: ${input} -> ${result}`);
      passed++;
    } else {
      console.error(`FAIL: ${input} -> Expected ${expected}, Got ${result}`);
      failed++;
    }
  });

  console.log(`Translate Priority Tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

testTranslatePriority();
