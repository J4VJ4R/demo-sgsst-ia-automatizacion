
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildNotificationQuery, validateNotificationCreation } from "../notification-logic";

describe("Notification Filtering Logic", () => {
  describe("buildNotificationQuery", () => {
    const userId = "user-123";
    const consultantRole = "CONSULTANT";
    const clientRole = "CLIENT_VIEWER";

    it("should build a basic query for a user", () => {
      const result = buildNotificationQuery(userId, consultantRole);
      
      assert.strictEqual(result.recipientId, userId);
      assert.strictEqual(result.isRead, false);
      // Ensure no unexpected filters are added by default
      assert.strictEqual(Object.keys(result).length, 2);
    });

    it("should apply filters correctly", () => {
      const filters = {
        type: "ACTIVITY_STATUS",
        priority: "HIGH",
        category: "OPERATIONAL",
        functionalArea: "SST"
      };
      
      const result = buildNotificationQuery(userId, consultantRole, filters);
      
      assert.strictEqual(result.type, "ACTIVITY_STATUS");
      assert.strictEqual(result.priority, "HIGH");
      assert.strictEqual(result.category, "OPERATIONAL");
      assert.strictEqual(result.functionalArea, "SST");
    });

    it("should allow partial filters", () => {
      const filters = {
        priority: "MEDIUM"
      };
      
      const result = buildNotificationQuery(userId, consultantRole, filters);
      
      assert.strictEqual(result.priority, "MEDIUM");
      assert.strictEqual(result.type, undefined);
    });
  });

  describe("validateNotificationCreation", () => {
    it("should allow sending SYSTEM_INTERNAL to consultants (for now)", () => {
      // Assuming consultants are trusted
      const result = validateNotificationCreation("CONSULTANT", "SYSTEM", "SYSTEM_INTERNAL");
      assert.strictEqual(result, true);
    });

    it("should NOT allow sending SYSTEM_INTERNAL to clients", () => {
      const result = validateNotificationCreation("CLIENT_VIEWER", "SYSTEM", "SYSTEM_INTERNAL");
      assert.strictEqual(result, false);
    });

    it("should allow sending ACTIVITY_STATUS to clients", () => {
      const result = validateNotificationCreation("CLIENT_VIEWER", "OPERATIONAL", "ACTIVITY_STATUS");
      assert.strictEqual(result, true);
    });
  });
});
