'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquareX, AlertCircle } from "lucide-react";

interface RejectionReasonDialogProps {
  reason: string | null | undefined;
}

export function RejectionReasonDialog({ reason }: RejectionReasonDialogProps) {
  const [open, setOpen] = useState(false);

  if (!reason) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
          title="Ver mensaje de rechazo"
        >
          <MessageSquareX className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Motivo</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px] border-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Motivo de rechazo
          </DialogTitle>
          <DialogDescription>
            Detalles proporcionados por el administrador sobre el rechazo de esta actividad.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-100 text-sm text-red-800 whitespace-pre-wrap">
          {reason}
        </div>
      </DialogContent>
    </Dialog>
  );
}
