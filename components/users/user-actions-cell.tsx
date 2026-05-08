 'use client'

 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import { MoreVertical, Eye, Pencil, Trash } from "lucide-react";
 import { deleteUser } from "@/app/actions";
 import { toast } from "sonner";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { UserDialog } from "./user-dialog";

 interface UserActionsCellProps {
   user: {
     id: string;
     name: string;
     email: string;
     role: string;
     projectsConsulted?: { id: string; name: string }[];
     clientProjects?: {
       id: string;
       name: string;
       consultant?: { id: string; name: string; email: string } | null;
     }[];
   };
 }

 export function UserActionsCell({ user }: UserActionsCellProps) {
   const [openEdit, setOpenEdit] = useState(false);
   const [openView, setOpenView] = useState(false);
   const [confirmOpen, setConfirmOpen] = useState(false);

   const handleView = () => {
    setOpenView(true);
   };
 
   const handleEdit = () => {
    setOpenEdit(true);
   };
 
   const handleDelete = async () => {
    const res = await deleteUser(user.id);
     if (res?.success) {
       toast.success("Usuario eliminado");
     } else {
       toast.error(res?.error || "Error al eliminar");
     }
    setConfirmOpen(false);
   };
 
   return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Opciones" className="text-slate-600 hover:text-[#D4AF37]">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleView}>
            <Eye className="h-4 w-4" />
            Ver
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleEdit}>
            <Pencil className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
          {user.role !== 'ADMIN_PMD' && (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash className="h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDialog user={user} open={openEdit} onOpenChange={setOpenEdit} />

      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">Detalle de Usuario</DialogTitle>
            <DialogDescription>Información actual del usuario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rol</span>
              <span className="font-medium">
                {user.role === 'ADMIN_PMD' ? 'Administrador' : user.role === 'CONSULTANT' ? 'Consultor' : 'Cliente'}
              </span>
            </div>
            
            {/* Section for displaying associated companies */}
            {(user.role === 'CONSULTANT' || user.role === 'CLIENT_VIEWER') && (
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-zinc-100">
                <span className="text-sm text-muted-foreground">
                  {user.role === 'CONSULTANT' ? 'Empresas Asignadas' : 'Empresa Asociada'}
                </span>
                <div className="mt-1 max-h-40 overflow-y-auto pr-1">
                  {user.role === 'CONSULTANT' ? (
                    user.projectsConsulted && user.projectsConsulted.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {user.projectsConsulted.map((project) => (
                          <div key={project.id} className="text-sm bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700">
                            {project.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400 italic">No tiene empresas asignadas</span>
                    )
                  ) : (
                    user.clientProjects && user.clientProjects.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {user.clientProjects.map((project) => (
                          <div key={project.id} className="text-sm font-medium text-zinc-800">
                            {project.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400 italic">No tiene empresa asignada</span>
                    )
                  )}
                </div>
              </div>
            )}

            {user.role === 'CLIENT_VIEWER' && (
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-zinc-100">
                <span className="text-sm text-muted-foreground">Consultor asignado</span>
                <div className="mt-1 flex flex-col gap-2">
                  {user.clientProjects && user.clientProjects.length > 0 ? (
                    user.clientProjects.some((p) => p.consultant) ? (
                      user.clientProjects.map((project) => (
                        <div
                          key={project.id}
                          className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                        >
                          <div className="text-xs text-muted-foreground">
                            {project.name}
                          </div>
                          {project.consultant ? (
                            <div className="mt-1 grid gap-1">
                              <div className="flex justify-between gap-3">
                                <span className="text-sm text-muted-foreground">
                                  Nombre
                                </span>
                                <span className="text-sm font-medium text-zinc-900">
                                  {project.consultant.name}
                                </span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-sm text-muted-foreground">
                                  Email
                                </span>
                                <span className="text-sm font-medium text-zinc-900">
                                  {project.consultant.email}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-sm text-zinc-400 italic">
                              Sin consultor asignado
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-400 italic">
                        Sin consultor asignado
                      </span>
                    )
                  ) : (
                    <span className="text-sm text-zinc-400 italic">
                      No tiene empresa asignada
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenView(false)} className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100">
              Cerrar
            </Button>
            <Button onClick={() => { setOpenView(false); setOpenEdit(true); }} className="bg-[#D4AF37] text-black hover:bg-[#B59530]">
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">Confirmar eliminación</DialogTitle>
            <DialogDescription>
              Esta acción eliminará al usuario y su acceso a la plataforma. Los registros vinculados pueden perder trazabilidad.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
            Proceda solo si está seguro. Esta acción no se puede deshacer.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100">
              Cancelar
            </Button>
            <Button onClick={handleDelete} className="bg-[#D4AF37] text-black hover:bg-[#B59530]">
              Estoy de acuerdo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
   );
 }
