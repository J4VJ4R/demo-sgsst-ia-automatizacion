export type ActivityWithDocumentsAndDueDate = {
  documents: { id: string }[] | null | undefined;
  dueDate?: Date | string | null;
};

export type CollaboratorDocumentStatus = "CON_PENDIENTES" | "AL_DIA";

export function getCollaboratorDocumentStatus(
  activities: ActivityWithDocumentsAndDueDate[] | null | undefined
): CollaboratorDocumentStatus {
  if (!activities || activities.length === 0) {
    return "CON_PENDIENTES";
  }

  const hasPendingDocs = activities.some(
    (activity) => !activity.documents || activity.documents.length === 0
  );

  if (hasPendingDocs) {
    return "CON_PENDIENTES";
  }

  const now = new Date();

  const hasHighOrMediumPriority = activities.some((activity) => {
    const due = activity.dueDate;
    if (!due) {
      return false;
    }

    const dueDate =
      typeof due === "string"
        ? new Date(due)
        : due;
    const ts = dueDate.getTime();
    if (Number.isNaN(ts)) {
      return false;
    }

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    if (dueDate < startOfToday) {
      return true;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor(
      (dueDate.getTime() - startOfToday.getTime()) / msPerDay
    );

    return diffDays <= 15;
  });

  if (hasHighOrMediumPriority) {
    return "CON_PENDIENTES";
  }

  return "AL_DIA";
}
