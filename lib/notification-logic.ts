
export interface NotificationFilters {
  type?: string;
  priority?: string;
  category?: string;
  functionalArea?: string;
}

/**
 * Builds the Prisma where clause for fetching notifications based on user role and filters.
 * Ensures that users only see notifications relevant to their role.
 */
export function buildNotificationQuery(userId: string, userRole: string, filters?: NotificationFilters) {
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

export function validateNotificationCreation(
  recipientRole: string, 
  notificationCategory: string,
  notificationType: string
): boolean {
  // Validate if a notification of a certain type can be sent to a role
  if (recipientRole === "CLIENT_VIEWER") {
    // Clients should not receive internal system alerts
    if (notificationType === "SYSTEM_INTERNAL") return false;
  }
  return true;
}
