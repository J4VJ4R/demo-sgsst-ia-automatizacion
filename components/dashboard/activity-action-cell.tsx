"use client"

import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { approveActivity } from "@/app/actions";
import { useState } from "react";

interface ActivityActionCellProps {
  id: string;
  status: string;
  userRole?: string;
}

export function ActivityActionCell({ id, status, userRole = "CLIENT_VIEWER" }: ActivityActionCellProps) {
  const [loading, setLoading] = useState(false);

  if (status === "APPROVED") {
    return <span className="text-green-400 font-medium">Aprobado</span>;
  }

  const handleApprove = async () => {
    setLoading(true);
    await approveActivity(id);
    setLoading(false);
  };

  if (userRole !== "ADMIN_PMD") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-primary border-primary hover:bg-primary/10"
      onClick={handleApprove}
      disabled={loading}
      aria-label="Aprobar actividad (solo auditor)"
      title="Aprobar actividad (solo auditor)"
    >
      <CheckCircle className="mr-2 h-4 w-4" />
      {loading ? "..." : "Aprobar"}
    </Button>
  );
}
