
import { PrismaClient } from "@prisma/client";

// --- Logic from lib/notification-logic.ts ---
interface NotificationFilters {
  type?: string;
  priority?: string;
  category?: string;
  functionalArea?: string;
}

function buildNotificationQuery(userId: string, userRole: string, filters?: NotificationFilters) {
  const where: any = {
    recipientId: userId,
    isRead: false, // Default to unread for the bell
  };

  // Apply user-provided filters
  if (filters?.type) where.type = filters.type;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.category) where.category = filters.category;
  if (filters?.functionalArea) where.functionalArea = filters.functionalArea;

  // Role-based Enforcements (Business Rules)
  // Even if a notification was sent to the user, we can hide it if it doesn't match their current role context
  
  if (userRole === "CONSULTANT") {
    // Consultants primarily deal with OPERATIONAL and SST
    // They should not see purely ADMINISTRATIVE or BILLING notifications unless explicitly categorized for them
    // For now, we assume if it's sent to them, it's valid, but we could add:
    // where.category = { not: "BILLING" };
  }

  if (userRole === "CLIENT_VIEWER") {
    // Clients might be restricted from internal operational details
    // where.category = { not: "INTERNAL_OPS" };
  }

  return where;
}
// ---------------------------------------------

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting Integration Test for Notification Filtering...");

  // 1. Find or create a user with CONSULTANT role
  let user = await prisma.user.findFirst({
    where: { role: "CONSULTANT" },
  });

  if (!user) {
    console.log("No CONSULTANT user found. Creating one...");
    try {
        user = await prisma.user.create({
            data: {
                name: "Test Consultant",
                email: "test_consultant_" + Date.now() + "@example.com",
                password: "password123", // Dummy hash
                role: "CONSULTANT",
            },
        });
    } catch (e) {
        console.error("Failed to create test user:", e);
        return;
    }
  }
  console.log(`Using User: ${user.name} (${user.id})`);

  // 2. Create a test notification
  const notificationData = {
    recipientId: user.id,
    title: "Integration Test Notification",
    message: "This is a test notification for integration check.",
    type: "SYSTEM_ALERT",
    priority: "HIGH",
    category: "OPERATIONAL",
    functionalArea: "SST",
    isRead: false,
  };

  let notification;
  try {
      notification = await prisma.notification.create({
        data: notificationData,
      });
      console.log(`Created Notification: ${notification.id} (Priority: HIGH, Category: OPERATIONAL)`);
  } catch (e) {
      console.error("Failed to create notification:", e);
      return;
  }

  try {
    // 3. Test Filter 1: Matching Filter (Should find it)
    console.log("\n--- Test 1: Query with matching filter (Priority: HIGH) ---");
    // Simulate what the server action does:
    const query1 = buildNotificationQuery(user.id, "CONSULTANT", { priority: "HIGH" });
    const results1 = await prisma.notification.findMany({ where: query1 });
    const found1 = results1.find((n) => n.id === notification.id);
    
    if (found1) {
      console.log("PASS: Notification found correctly.");
    } else {
      console.error("FAIL: Notification NOT found but should be.");
      console.log("Query used:", JSON.stringify(query1, null, 2));
    }

    // 4. Test Filter 2: Non-matching Filter (Should NOT find it)
    console.log("\n--- Test 2: Query with non-matching filter (Priority: LOW) ---");
    const query2 = buildNotificationQuery(user.id, "CONSULTANT", { priority: "LOW" });
    const results2 = await prisma.notification.findMany({ where: query2 });
    const found2 = results2.find((n) => n.id === notification.id);

    if (!found2) {
      console.log("PASS: Notification correctly filtered out.");
    } else {
      console.error("FAIL: Notification found but should be filtered out.");
    }

    // 5. Test Audit Log creation (simulating 'action')
    console.log("\n--- Test 3: Audit Log Creation ---");
    const audit = await prisma.notificationAudit.create({
      data: {
        notificationId: notification.id,
        userId: user.id,
        action: "SHOWN",
        metadata: JSON.stringify({ context: "test_script", timestamp: new Date().toISOString() }),
      },
    });
    console.log(`PASS: Audit Log created with ID: ${audit.id}`);

  } catch (error) {
    console.error("Error during test:", error);
  } finally {
    // Cleanup
    console.log("\n--- Cleanup ---");
    try {
        if (notification) {
             await prisma.notificationAudit.deleteMany({
                where: { notificationId: notification.id }
            });
            await prisma.notification.delete({ where: { id: notification.id } });
        }
        if (user && user.email.startsWith("test_consultant_")) {
            await prisma.user.delete({ where: { id: user.id } });
        }
    } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

runTest();
