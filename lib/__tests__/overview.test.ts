import { describe, it } from "node:test";
import assert from "node:assert";
import { calculatePercentage } from "../utils";

describe("Overview Dashboard Logic", () => {
  describe("calculatePercentage", () => {
    it("should calculate percentage correctly for standard values", () => {
      assert.strictEqual(calculatePercentage(25, 100), "25.0");
      assert.strictEqual(calculatePercentage(50, 200), "25.0");
      assert.strictEqual(calculatePercentage(1, 3), "33.3");
    });

    it("should handle zero value correctly", () => {
      assert.strictEqual(calculatePercentage(0, 100), "0.0");
    });

    it("should handle zero total gracefully (avoid division by zero)", () => {
      assert.strictEqual(calculatePercentage(10, 0), "0");
      assert.strictEqual(calculatePercentage(0, 0), "0");
    });

    it("should handle rounding correctly", () => {
      // 2/3 = 0.6666... -> 66.7
      assert.strictEqual(calculatePercentage(2, 3), "66.7");
    });
  });
});
