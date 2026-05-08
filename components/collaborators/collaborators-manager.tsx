"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Search,
  Plus,
  Loader2,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { CollaboratorForm } from "./collaborator-form";
import { getCollaborators, deleteCollaborator, getCollaborator } from "@/app/collaborator-actions";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Collaborator {
  id: string;
  documentNumber: string;
  firstName: string;
  secondName?: string | null;
  firstSurname: string;
  secondSurname?: string | null;
  position: string;
  email: string;
  status: string;
  department?: string;
  retirementDate?: string;
  retirementReason?: string;
   documentStatus?: "CON_PENDIENTES" | "AL_DIA";
}

type CollaboratorFormData = {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  secondName: string | null;
  firstSurname: string;
  secondSurname: string | null;
  startDate: Date;
  contractType: string;
  position: string;
  driverRole?: string | null;
  email: string;
  phone: string;
  address: string;
  rh: string;
  eps: string;
  arl: string;
  afp: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: string;
};

type CollaboratorServerData = {
  id: string;
  projectId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  secondName: string | null;
  firstSurname: string;
  secondSurname: string | null;
  startDate: string;
  contractType: string;
  position: string;
  driverRole?: string | null;
  email: string;
  phone: string;
  address: string;
  rh: string;
  eps: string;
  arl: string;
  afp: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: string;
};

interface CollaboratorsManagerProps {
  projectId: string;
  canManage?: boolean;
  userRole?: string;
}

const PAGE_SIZE = 15;

const FAKE_COLLABORATORS: Collaborator[] = [
  {
    id: "fake-1",
    documentNumber: "100000001",
    firstName: "Ana",
    firstSurname: "Pérez",
    position: "Desarrolladora",
    email: "ana.perez@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-2",
    documentNumber: "100000002",
    firstName: "Carlos",
    firstSurname: "García",
    position: "Analista",
    email: "carlos.garcia@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-3",
    documentNumber: "100000003",
    firstName: "Luisa",
    firstSurname: "Ramírez",
    position: "Diseñadora UX",
    email: "luisa.ramirez@example.com",
    status: "INACTIVE",
  },
  {
    id: "fake-4",
    documentNumber: "100000004",
    firstName: "Javier",
    firstSurname: "Moreno",
    position: "Director SST",
    email: "javier.moreno@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-5",
    documentNumber: "100000005",
    firstName: "Sofía",
    firstSurname: "López",
    position: "Coordinadora HSE",
    email: "sofia.lopez@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-6",
    documentNumber: "100000006",
    firstName: "Andrés",
    firstSurname: "Castaño",
    position: "Ingeniero Industrial",
    email: "andres.castano@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-7",
    documentNumber: "100000007",
    firstName: "María",
    firstSurname: "Gómez",
    position: "Talento Humano",
    email: "maria.gomez@example.com",
    status: "INACTIVE",
  },
  {
    id: "fake-8",
    documentNumber: "100000008",
    firstName: "Felipe",
    firstSurname: "Rojas",
    position: "Operario",
    email: "felipe.rojas@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-9",
    documentNumber: "100000009",
    firstName: "Paula",
    firstSurname: "Martínez",
    position: "Auxiliar SST",
    email: "paula.martinez@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-10",
    documentNumber: "100000010",
    firstName: "Camilo",
    firstSurname: "Ruiz",
    position: "Supervisor",
    email: "camilo.ruiz@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-11",
    documentNumber: "100000011",
    firstName: "Diana",
    firstSurname: "Castro",
    position: "Contadora",
    email: "diana.castro@example.com",
    status: "INACTIVE",
  },
  {
    id: "fake-12",
    documentNumber: "100000012",
    firstName: "Esteban",
    firstSurname: "Vargas",
    position: "Tecnólogo SST",
    email: "esteban.vargas@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-13",
    documentNumber: "100000013",
    firstName: "Laura",
    firstSurname: "Salazar",
    position: "Asistente Administrativa",
    email: "laura.salazar@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-14",
    documentNumber: "100000014",
    firstName: "Miguel",
    firstSurname: "Patiño",
    position: "Docente",
    email: "miguel.patino@example.com",
    status: "ACTIVE",
  },
  {
    id: "fake-15",
    documentNumber: "100000015",
    firstName: "Valentina",
    firstSurname: "Hernández",
    position: "Consultora",
    email: "valentina.hernandez@example.com",
    status: "INACTIVE",
  },
  // Colaboradores retirados de prueba
  {
    id: "fake-ret-1",
    documentNumber: "200000001",
    firstName: "Ricardo",
    firstSurname: "Suárez",
    position: "Operario de Planta",
    email: "ricardo.suarez@example.com",
    status: "RETIRADO",
    department: "Producción",
    retirementDate: "2024-01-15",
    retirementReason: "Terminación de contrato por obra",
  },
  {
    id: "fake-ret-2",
    documentNumber: "200000002",
    firstName: "Mónica",
    firstSurname: "Hernández",
    position: "Analista de SST",
    email: "monica.hernandez@example.com",
    status: "RETIRADO",
    department: "Seguridad y Salud en el Trabajo",
    retirementDate: "2023-11-30",
    retirementReason: "Cambio de empresa",
  },
  {
    id: "fake-ret-3",
    documentNumber: "200000003",
    firstName: "Oscar",
    firstSurname: "Ramírez",
    position: "Conductor",
    email: "oscar.ramirez@example.com",
    status: "RETIRADO",
    department: "Logística",
    retirementDate: "2022-08-10",
    retirementReason: "Jubilación anticipada",
  },
  {
    id: "fake-ret-4",
    documentNumber: "200000004",
    firstName: "Paola",
    firstSurname: "González",
    position: "Coordinadora Administrativa",
    email: "paola.gonzalez@example.com",
    status: "RETIRADO",
    department: "Administración",
    retirementDate: "2024-03-05",
    retirementReason: "Acuerdo mutuo",
  },
  {
    id: "fake-ret-5",
    documentNumber: "200000005",
    firstName: "Jorge",
    firstSurname: "Castillo",
    position: "Ingeniero de Proyectos",
    email: "jorge.castillo@example.com",
    status: "RETIRADO",
    department: "Proyectos",
    retirementDate: "2023-05-22",
    retirementReason: "Reestructuración interna",
  },
];

export function CollaboratorsManager({ projectId, canManage = true, userRole }: CollaboratorsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [useFake, setUseFake] = useState(false);
  const [selected, setSelected] = useState<Collaborator | null>(null);
  const [openView, setOpenView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingData, setEditingData] = useState<CollaboratorFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "retired">("all");
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "pending" | "upToDate">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const router = useRouter();

  const storageKey = `collaborators_filter_${projectId}`;

  function mapFilterToStatus(filter: "all" | "active" | "retired") {
    if (filter === "active") return "ACTIVE";
    if (filter === "retired") return "RETIRADO";
    return "ALL";
  }

  const fetchCollaborators = useCallback(
    async (
      currentFilter: "all" | "active" | "retired" = viewFilter,
      currentPage: number = page,
      currentSearch: string = search
    ) => {
      setLoading(true);
      const status = mapFilterToStatus(currentFilter);

      const result = await getCollaborators(projectId, {
        status,
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: currentSearch.trim() || undefined,
      });

      if (result.success) {
        setUseFake(false);
        const safeData = Array.isArray(result.data)
          ? (result.data as Collaborator[])
          : [];
        setCollaborators(safeData);
        setTotal(
          typeof result.total === "number"
            ? result.total
            : safeData.length
        );
      } else {
        setUseFake(true);
        const term = currentSearch.toLowerCase().trim();
        const filtered = FAKE_COLLABORATORS.filter((c) => {
          if (currentFilter === "active" && c.status !== "ACTIVE") return false;
          if (currentFilter === "retired" && c.status !== "RETIRADO") return false;
          if (!term) return true;
          const name = `${c.firstName} ${c.secondName || ""} ${c.firstSurname} ${
            c.secondSurname || ""
          }`.toLowerCase();
          return c.documentNumber.includes(term) || name.includes(term);
        });
        const totalFake = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalFake / PAGE_SIZE));
        const safePage = Math.min(currentPage, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        setCollaborators(filtered.slice(start, end));
        setTotal(totalFake);
      }
      setLoading(false);
    },
    [projectId, viewFilter, page, search]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setInitialized(true);
      return;
    }

    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          viewFilter?: "all" | "active" | "retired";
          docStatusFilter?: "all" | "pending" | "upToDate";
          page?: number;
        };
        if (
          parsed.viewFilter === "all" ||
          parsed.viewFilter === "active" ||
          parsed.viewFilter === "retired"
        ) {
          setViewFilter(parsed.viewFilter);
        }
        if (
          parsed.docStatusFilter === "all" ||
          parsed.docStatusFilter === "pending" ||
          parsed.docStatusFilter === "upToDate"
        ) {
          setDocStatusFilter(parsed.docStatusFilter);
        }
        if (typeof parsed.page === "number" && parsed.page > 0) {
          setPage(parsed.page);
        }
      } catch {
      }
    }
    setInitialized(true);
  }, [storageKey]);

  useEffect(() => {
    if (!initialized) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ viewFilter, docStatusFilter, page })
      );
    }
    fetchCollaborators(viewFilter, page, search);
  }, [viewFilter, page, search, storageKey, initialized, fetchCollaborators, docStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredCollaborators = useMemo(() => {
    if (docStatusFilter === "all") {
      return collaborators;
    }
    if (docStatusFilter === "pending") {
      return collaborators.filter(
        (c) => c.documentStatus === "CON_PENDIENTES"
      );
    }
    if (docStatusFilter === "upToDate") {
      return collaborators.filter((c) => c.documentStatus === "AL_DIA");
    }
    return collaborators;
  }, [collaborators, docStatusFilter]);

  const handleView = (collaborator: Collaborator) => {
    setSelected(collaborator);
    setOpenView(true);
  };

  const handleEdit = async (collaborator: Collaborator) => {
    if (useFake) {
      toast.info("La edición solo está disponible para colaboradores reales de la empresa.");
      return;
    }

    try {
      setLoading(true);
      const result = await getCollaborator(collaborator.id);
      if (result.success && result.data) {
        const raw = result.data as CollaboratorServerData;
        const mapped: CollaboratorFormData = {
          ...raw,
          startDate: raw.startDate ? new Date(raw.startDate) : new Date(),
        };
        setEditingData(mapped);
        setIsEditing(true);
        setShowForm(true);
      } else {
        toast.error(result.error || "No se pudo cargar el colaborador.");
      }
    } catch {
      toast.error("Error inesperado al cargar el colaborador.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    if (useFake) {
      setCollaborators((prev) => prev.filter((c) => c.id !== selected.id));
      setConfirmDelete(false);
      toast.success("Colaborador eliminado de la lista de prueba.");
      return;
    }

    try {
      setDeleting(true);
      const result = await deleteCollaborator(selected.id);
      if (result?.success) {
        toast.success("Colaborador eliminado correctamente.");
        setConfirmDelete(false);
        fetchCollaborators();
      } else {
        toast.error(result?.error || "No se pudo eliminar el colaborador.");
      }
    } catch {
      toast.error("Error inesperado al eliminar el colaborador.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0 pb-6 border-b mb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Gestión de Colaboradores</CardTitle>
          {canManage && !showForm && (
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530] gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar Colaborador
            </Button>
          )}
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto">
        {showForm ? (
          <CollaboratorForm 
            projectId={projectId}
            mode={isEditing ? "edit" : "create"}
            initialData={editingData || undefined}
            onSuccess={() => {
              setShowForm(false);
              setIsEditing(false);
              setEditingData(null);
              fetchCollaborators();
            }}
            onCancel={() => {
              setShowForm(false);
              setIsEditing(false);
              setEditingData(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de documento o nombre..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Submenú de filtro por estado */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Mostrar:</span>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewFilter === "all" ? "default" : "ghost"}
                  onClick={() => {
                    setViewFilter("all");
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium ${
                    viewFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  aria-pressed={viewFilter === "all"}
                  aria-label="Mostrar todos los colaboradores"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewFilter === "active" ? "default" : "ghost"}
                  onClick={() => {
                    setViewFilter("active");
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium ${
                    viewFilter === "active"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  aria-pressed={viewFilter === "active"}
                  aria-label="Mostrar solo activos"
                >
                  Solo activos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewFilter === "retired" ? "default" : "ghost"}
                  onClick={() => {
                    setViewFilter("retired");
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium ${
                    viewFilter === "retired"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  aria-pressed={viewFilter === "retired"}
                  aria-label="Mostrar solo colaboradores retirados"
                >
                  Retirados
                </Button>
                <div className="ml-4 flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={docStatusFilter === "pending" ? "default" : "ghost"}
                    onClick={() => {
                      setDocStatusFilter("pending");
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      docStatusFilter === "pending"
                        ? "bg-yellow-100 text-yellow-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    aria-pressed={docStatusFilter === "pending"}
                    aria-label="Mostrar colaboradores con pendientes"
                  >
                    Con pendientes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={docStatusFilter === "upToDate" ? "default" : "ghost"}
                    onClick={() => {
                      setDocStatusFilter("upToDate");
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      docStatusFilter === "upToDate"
                        ? "bg-emerald-100 text-emerald-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    aria-pressed={docStatusFilter === "upToDate"}
                    aria-label="Mostrar colaboradores cumpliendo"
                  >
                    Cumpliendo
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : collaborators.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>
                  {viewFilter === "retired"
                    ? "No hay colaboradores retirados."
                    : viewFilter === "active"
                    ? "No hay colaboradores activos."
                    : "No se encontraron colaboradores registrados."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                      <tr>
                        <th className="p-3">Documento</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Cargo</th>
                        <th className="p-3">Email</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredCollaborators.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-medium">{c.documentNumber}</td>
                          <td className="p-3">
                            <Link
                              href={`/projects/${projectId}/collaborators/${c.id}/activities`}
                              onClick={() =>
                                console.log(
                                  "[CollaboratorsManager] Click on collaborator name to view activities",
                                  {
                                    projectId,
                                    collaboratorId: c.id,
                                    documentNumber: c.documentNumber,
                                  }
                                )
                              }
                              className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-[#D4AF37] hover:underline"
                            >
                              <span>
                                {c.firstName}{" "}
                                {c.secondName ? `${c.secondName} ` : ""}
                                {c.firstSurname}{" "}
                                {c.secondSurname ? c.secondSurname : ""}
                              </span>
                              <FileText className="h-3 w-3 text-slate-400" />
                            </Link>
                          </td>
                          <td className="p-3 text-muted-foreground">{c.position}</td>
                          <td className="p-3 text-muted-foreground">{c.email}</td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={
                                c.documentStatus === "AL_DIA" ? "default" : "outline"
                              }
                              className={
                                c.documentStatus === "AL_DIA"
                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                  : "text-yellow-700 border-yellow-200 bg-yellow-50/40"
                              }
                            >
                              {c.documentStatus === "AL_DIA" ? "Cumpliendo" : "Con pendientes"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Opciones de colaborador"
                                  className="text-slate-600 hover:text-[#D4AF37]"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    (() => {
                                      console.log(
                                        "[CollaboratorsManager] Menu 'Actividades' selected",
                                        {
                                          projectId,
                                          collaboratorId: c.id,
                                          documentNumber: c.documentNumber,
                                        }
                                      );
                                      router.push(
                                        `/projects/${projectId}/collaborators/${c.id}/activities`
                                      );
                                    })()
                                  }
                                  aria-label="Ver actividades del colaborador"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Actividades
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => handleView(c)}
                                  aria-label="Ver colaborador"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                {canManage && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() => handleEdit(c)}
                                      aria-label="Editar colaborador"
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    {userRole !== "CONSULTANT" && (
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          setSelected(c);
                                          setConfirmDelete(true);
                                        }}
                                        aria-label="Eliminar colaborador"
                                        className="text-red-600 focus:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  <div
                    className="flex items-center justify-between border-t border-slate-200 px-2 py-4"
                    aria-live="polite"
                  >
                    <div className="text-xs text-muted-foreground">
                      {`Mostrando ${(page - 1) * PAGE_SIZE + 1} a ${Math.min(
                        page * PAGE_SIZE,
                        total
                      )} de ${total} colaboradores${
                        docStatusFilter !== "all"
                          ? ` (${filteredCollaborators.length} visibles con filtro)`
                          : ""
                      }`}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPage(1)}
                          disabled={page === 1}
                          aria-label="Ir a la primera página"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={page === 1}
                          aria-label="Ir a la página anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-xs font-medium">
                          Página {page} de {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={page === totalPages}
                          aria-label="Ir a la página siguiente"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPage(totalPages)}
                          disabled={page === totalPages}
                          aria-label="Ir a la última página"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Detalle de Colaborador
            </DialogTitle>
            <DialogDescription>
              Información básica del colaborador seleccionado.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Documento
                </span>
                <span className="font-medium">
                  {selected.documentNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nombre</span>
                <span className="font-medium">
                  {selected.firstName}{" "}
                  {selected.secondName ? `${selected.secondName} ` : ""}
                  {selected.firstSurname}{" "}
                  {selected.secondSurname ? selected.secondSurname : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cargo</span>
                <span className="font-medium">{selected.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{selected.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                <span className="font-medium">
                  {selected.status === "ACTIVE"
                    ? "Activo"
                    : selected.status === "RETIRADO"
                    ? "Retirado"
                    : "Inactivo"}
                </span>
              </div>
              {selected.status === "RETIRADO" && (
                <>
                  {selected.department && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Departamento
                      </span>
                      <span className="font-medium">
                        {selected.department}
                      </span>
                    </div>
                  )}
                  {selected.retirementDate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Fecha de retiro
                      </span>
                      <span className="font-medium">
                        {new Date(selected.retirementDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {selected.retirementReason && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Motivo de retiro
                      </span>
                      <span className="font-medium text-right">
                        {selected.retirementReason}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenView(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará al colaborador de la empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
            Proceda solo si está seguro. Esta acción no se puede deshacer.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {deleting ? "Eliminando..." : "Estoy de acuerdo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
