'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { updateActivityStatus, returnActivityToConsultant } from "@/app/actions";
import { toast } from "sonner";
import { CheckCircle, Clock, Undo2, Eye } from "lucide-react";
import { RequirementActions } from "@/components/activities/requirement-actions";
import { RejectionReasonDialog } from "@/components/activities/rejection-reason-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

interface ActivityStatusActionsProps {
  id: string;
  status: string;
  userRole: string;
  title?: string;
  projectName?: string;
  dueDate?: Date | string | null;
  documents?: { id: string; name: string; url: string; version?: number | null }[];
  onPreview?: () => void;
  rejectionReason?: string | null;
}

export function ActivityStatusActions({ id, status, userRole, title, projectName, dueDate, documents, onPreview, rejectionReason }: ActivityStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returning, setReturning] = useState(false);
  const devolverActividadClass =
    "h-8 rounded-full border-[#DAA520] bg-white text-[#8B4512] hover:bg-[#DAA520]/10 active:bg-[#DAA520]/20 disabled:opacity-50 disabled:bg-white disabled:text-[#8B4512] disabled:border-[#DAA520]";

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const result = await updateActivityStatus(id, newStatus);
    setLoading(false);
    
    if (result.success) {
      toast.success("Estado actualizado exitosamente");
    } else {
      toast.error("Error al actualizar estado");
    }
  }

  async function handleReturn() {
    const note = returnNote.trim();
    if (!note) {
      toast.error("Ingrese una nota para devolver la actividad.");
      return;
    }

    setReturning(true);
    const result = await returnActivityToConsultant(id, note);
    setReturning(false);

    if (result.success) {
      toast.success("Actividad devuelta al consultor.");
      setReturnDialogOpen(false);
      setReturnNote("");
    } else {
      toast.error(result.error || "Error al devolver la actividad.");
    }
  }

  // Client Viewer: Read only
  if (userRole === 'CLIENT_VIEWER') {
    return null;
  }

  if (status === 'APPROVED') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-green-600 font-medium flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Aprobada</span>
        {onPreview && documents && documents.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            title="Ver documento"
            className="h-8 rounded-full border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-[#D4AF37]"
          >
            <Eye className="mr-1 h-4 w-4" />
            <span className="text-xs font-medium">Ver</span>
          </Button>
        )}
        {userRole === "CONSULTANT" && (
          <RequirementActions
            activityId={id}
            status={status}
            latestDoc={
              documents && documents.length > 0
                ? {
                    id: documents[0].id,
                    name: documents[0].name,
                    url: documents[0].url,
                    activity: { title: title || "", project: { name: projectName || "" } },
                  }
                : null
            }
            activityDueDate={dueDate}
            documents={documents || []}
            canManage={true}
            canDelete={false}
            userRole={userRole}
          />
        )}
        {userRole === "ADMIN" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}`)}>
                <Eye className="mr-2 h-4 w-4" /> Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                // TODO: Implement delete confirmation dialog
                toast.error("Funcionalidad de eliminar pendiente de implementación");
              }} className="text-red-600">
                <Trash className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }


  if (status === 'REJECTED') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-red-600 font-medium flex items-center"><Undo2 className="w-4 h-4 mr-1" /> Rechazada</span>
        {userRole !== "CONSULTANT" && <RejectionReasonDialog reason={rejectionReason} />}
        {onPreview && documents && documents.length > 0 && userRole !== 'CONSULTANT' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            title="Ver documento"
            className="h-8 rounded-full border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-[#D4AF37]"
          >
            <Eye className="mr-1 h-4 w-4" />
            <span className="text-xs font-medium">Ver</span>
          </Button>
        )}
        {userRole === 'CONSULTANT' && (
           <RequirementActions
             activityId={id}
             status={status}
             rejectionReason={rejectionReason}
             latestDoc={documents && documents.length > 0 ? {
                id: documents[0].id,
                name: documents[0].name,
                url: documents[0].url,
                activity: { title: title || "", project: { name: projectName || "" } }
             } : null}
             activityDueDate={dueDate}
             documents={documents || []}
             canManage={true}
             canDelete={false}
             userRole={userRole}
           />
        )}
        {userRole === "ADMIN" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}`)}>
                <Eye className="mr-2 h-4 w-4" /> Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                // TODO: Implement delete confirmation dialog
                toast.error("Funcionalidad de eliminar pendiente de implementación");
              }} className="text-red-600">
                <Trash className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Botón Ver Documento para PENDING o IN_REVIEW */}
        {onPreview && documents && documents.length > 0 && (status === 'IN_REVIEW' || (status === 'PENDING' && userRole !== 'CONSULTANT')) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            title="Ver documento"
            className="h-8 rounded-full border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-[#D4AF37]"
          >
            <Eye className="mr-1 h-4 w-4" />
            <span className="text-xs font-medium">Ver</span>
          </Button>
        )}

        {/* Solo consultor puede marcar como En revisión */}
        {status === 'PENDING' && userRole === 'CONSULTANT' && (
           <RequirementActions
             activityId={id}
             latestDoc={documents && documents.length > 0 ? {
                id: documents[0].id,
                name: documents[0].name,
                url: documents[0].url,
                activity: { title: title || "", project: { name: projectName || "" } }
             } : null}
             activityDueDate={dueDate}
             documents={documents || []}
             canManage={true}
             canDelete={false}
             userRole={userRole}
           />
        )}

        {/* Admin: Aprobar o devolver actividad */}
        {status === 'IN_REVIEW' && userRole === 'ADMIN_PMD' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('APPROVED')}
              disabled={loading}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="mr-1 h-3 w-3" /> Aprobar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReturnDialogOpen(true)}
              disabled={loading}
              className={devolverActividadClass}
            >
              <Undo2 className="mr-1 h-3 w-3" /> Devolver
            </Button>
          </>
        )}

        {/* Si el consultor ve IN_REVIEW, solo muestra estado */}
        {status === 'IN_REVIEW' && userRole === 'CONSULTANT' && (
          <span className="text-blue-600 font-medium flex items-center text-sm">
            <Clock className="w-3 h-3 mr-1" /> En Revisión
          </span>
        )}
        {userRole === "ADMIN" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}`)}>
                <Eye className="mr-2 h-4 w-4" /> Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/activities/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                // TODO: Implement delete confirmation dialog
                toast.error("Funcionalidad de eliminar pendiente de implementación");
              }} className="text-red-600">
                <Trash className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Devolver al consultor
            </DialogTitle>
            <DialogDescription>
              Escriba una nota con la novedad para que el consultor realice los ajustes necesarios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Nota para el consultor
              </span>
              <Textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReturn}
              disabled={returning}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {returning ? "Devolviendo..." : "Devolver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
