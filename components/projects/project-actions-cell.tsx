 'use client'
 
import { useRef, useState } from "react";
 import { Button } from "@/components/ui/button";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Pencil, Trash, Download } from "lucide-react";
 import { toast } from "sonner";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { ProjectDialog } from "@/components/projects/project-dialog";
 import { deleteProject } from "@/app/actions";
 
interface ProjectActionsCellProps {
  project: {
    id: string;
    name: string;
    clientName: string;
    startDate: Date | string;
    status: string;
    nit?: string | null;
    address?: string | null;
    department?: string | null;
    municipality?: string | null;
    economicActivity?: string | null;
    ciiu?: string | null;
    phone?: string | null;
    workerCount?: number | null;
    logoUrl?: string | null;
    contractStartDate?: Date | null;
    contractNumber?: number | null;
    riskLevel?: string | null;
    chapter?: string | null;
    consultantName: string | null;
    consultantId?: string | null;
  };
  consultants: {
    id: string;
    name: string;
  }[];
  canEdit?: boolean;
  canDelete?: boolean;
  canExportData?: boolean;
}

export function ProjectActionsCell({
  project,
  consultants,
  canEdit = true,
  canDelete = true,
  canExportData = false,
}: ProjectActionsCellProps) {
   const [openEdit, setOpenEdit] = useState(false);
   const [openView, setOpenView] = useState(false);
   const [confirmOpen, setConfirmOpen] = useState(false);
   const [deleting, setDeleting] = useState(false);
   const [exporting, setExporting] = useState(false);
   const exportGuardRef = useRef(0);
 
   const handleDelete = async () => {
     setDeleting(true);
     const res = await deleteProject(project.id);
     setDeleting(false);
     if (res?.success) {
       toast.success("Empresa eliminada");
       setConfirmOpen(false);
     } else {
       toast.error(res?.error || "No se pudo eliminar la empresa. Verifique que no tenga actividades asociadas.");
     }
   };
 
  const handleExport = () => {
    const now = Date.now();
    if (now - exportGuardRef.current < 1500) return;
    exportGuardRef.current = now;

    setExporting(true);
    window.setTimeout(() => setExporting(false), 10_000);

    toast.message("Preparando descarga...");
    const url = `/api/projects/${project.id}/export`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

   return (
     <>
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <Button
             variant="ghost"
             size="icon"
             aria-label="Opciones de empresa"
             className="text-slate-600 hover:text-[#D4AF37]"
           >
             <MoreVertical className="h-4 w-4" />
           </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
           <DropdownMenuItem onSelect={() => setOpenView(true)}>
             <Eye className="h-4 w-4" />
             Ver
           </DropdownMenuItem>
           {canExportData && (
             <DropdownMenuItem
               disabled={exporting}
               onSelect={(e) => {
                 e.preventDefault();
                 handleExport();
               }}
             >
               <Download className="h-4 w-4" />
               Descargar datos
             </DropdownMenuItem>
           )}
           {canEdit && (
             <DropdownMenuItem onSelect={() => setOpenEdit(true)}>
               <Pencil className="h-4 w-4" />
               Editar
             </DropdownMenuItem>
           )}
           {canDelete && (
             <DropdownMenuItem
               variant="destructive"
               onSelect={() => setConfirmOpen(true)}
             >
               <Trash className="h-4 w-4" />
               Eliminar
             </DropdownMenuItem>
           )}
         </DropdownMenuContent>
       </DropdownMenu>
 
      {canEdit && (
        <ProjectDialog
          consultants={consultants}
          project={{
            id: project.id,
            name: project.name,
            clientName: project.clientName,
            consultantId: project.consultantId ?? null,
            nit: project.nit ?? null,
            address: project.address ?? null,
            department: project.department ?? null,
            municipality: project.municipality ?? null,
            economicActivity: project.economicActivity ?? null,
            ciiu: project.ciiu ?? null,
            phone: project.phone ?? null,
            workerCount: project.workerCount ?? null,
            logoUrl: project.logoUrl ?? null,
            contractStartDate: project.contractStartDate ?? null,
            contractNumber: project.contractNumber ?? null,
            riskLevel: project.riskLevel ?? null,
            chapter: project.chapter ?? null,
            status: project.status,
          }}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      )}
 
       <Dialog open={openView} onOpenChange={setOpenView}>
          <DialogContent className="sm:max-w-[720px] border-[#D4AF37]/30">
           <DialogHeader>
             <DialogTitle className="text-[#D4AF37]">Detalle de Empresa</DialogTitle>
             <DialogDescription>Información actual de la empresa.</DialogDescription>
           </DialogHeader>
          <div className="grid gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                {project.logoUrl ? (
                  <img src={project.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">Sin logo</div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold text-slate-900">{project.name}</div>
                <div className="text-sm text-muted-foreground">Cliente: <span className="font-medium">{project.clientName}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">Información General</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">NIT</span><span className="font-medium break-words">{project.nit || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Teléfono</span><span className="font-medium break-words">{project.phone || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">No. Trabajadores</span><span className="font-medium break-words">{project.workerCount ?? "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">CIIU</span><span className="font-medium break-words">{project.ciiu || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground leading-tight w-24">
                      <span className="block">Actividad</span>
                      <span className="block">Económica</span>
                    </span>
                    <span className="font-medium break-words flex-1">{project.economicActivity || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">Ubicación y Estado</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Dirección</span><span className="font-medium break-words">{project.address || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Departamento</span><span className="font-medium break-words">{project.department || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Municipio</span><span className="font-medium break-words">{project.municipality || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Nivel de Riesgo</span><span className="font-medium break-words">{project.riskLevel || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Estado</span><span className="font-medium break-words">{project.status}</span></div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">Contrato y Asignación</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Inicio Contrato</span><span className="font-medium break-words">{project.contractStartDate ? new Date(project.contractStartDate).toLocaleDateString("es-ES") : "—"}</span></div>
                <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">No. Contrato</span><span className="font-medium break-words">{project.contractNumber ?? "—"}</span></div>
                <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Capítulo</span><span className="font-medium break-words">{project.chapter || "—"}</span></div>
                <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground whitespace-nowrap">Consultor asignado</span><span className="font-medium break-words">{project.consultantName || "Sin asignar"}</span></div>
              </div>
            </div>
          </div>
           <DialogFooter>
             <Button
               variant="outline"
               onClick={() => setOpenView(false)}
               className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
             >
               Cerrar
             </Button>
            {canEdit && (
              <Button
                onClick={() => {
                  setOpenView(false);
                  setOpenEdit(true);
                }}
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              >
                Editar
              </Button>
            )}
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
      {canDelete && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
            <DialogHeader>
              <DialogTitle>Eliminar Empresa</DialogTitle>
              <DialogDescription>
                Esta acción eliminará permanentemente la empresa “{project.name}” y todos sus datos asociados, incluyendo actividades, documentos, historial, colaboradores y configuraciones.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              Advertencia: Esta acción es irreversible y no se puede deshacer.
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              >
                {deleting ? "Eliminando..." : "Estoy de acuerdo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
     </>
   );
 }
