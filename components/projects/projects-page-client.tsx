"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectActionsCell } from "@/components/projects/project-actions-cell";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomLoader } from "@/components/ui/custom-loader";
import { useRouter } from "next/navigation";

interface ProjectItem {
  id: string;
  name: string;
  clientName: string;
  startDate: string;
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
  contractStartDate?: string | null;
  contractNumber?: number | null;
  riskLevel?: string | null;
  chapter?: string | null;
  consultantName: string | null;
  consultantId: string | null;
}

interface ProjectsPageClientProps {
  projects: ProjectItem[];
  consultants: { id: string; name: string }[];
  canEdit?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  canExportData?: boolean;
}

const ITEMS_PER_PAGE = 15;

export function ProjectsPageClient({
  projects,
  consultants,
  canEdit = true,
  canCreate = true,
  canDelete = true,
  canExportData = false,
}: ProjectsPageClientProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const nit = (project.nit || "").toLowerCase();
      return name.includes(term) || nit.includes(term);
    });
  }, [projects, query]);

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  return (
    <div className="space-y-6">
      <CustomLoader isLoading={isNavigating} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Empresas
        </h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre de empresa o NIT..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          {canCreate && <ProjectDialog consultants={consultants} />}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {paginatedProjects.map((project) => (
          <Card
            key={project.id}
            className="cursor-pointer rounded-2xl border-slate-200 shadow-sm"
            onClick={() => {
              startTransition(() => {
                router.push(`/projects/${project.id}`);
              });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {project.logoUrl ? (
                    <Image
                      src={project.logoUrl}
                      alt="Logo"
                      width={48}
                      height={48}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                      Sin logo
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-950">
                        {project.name}
                      </div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        NIT: {project.nit || "—"}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-2">
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                      >
                        {project.status}
                      </Badge>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <ProjectActionsCell
                          project={{
                            id: project.id,
                            name: project.name,
                            clientName: project.clientName,
                            startDate: new Date(project.startDate),
                            status: project.status,
                            nit: project.nit ?? null,
                            address: project.address ?? null,
                            department: project.department ?? null,
                            municipality: project.municipality ?? null,
                            economicActivity: project.economicActivity ?? null,
                            ciiu: project.ciiu ?? null,
                            phone: project.phone ?? null,
                            workerCount: project.workerCount ?? null,
                            logoUrl: project.logoUrl ?? null,
                            contractStartDate: project.contractStartDate
                              ? new Date(project.contractStartDate)
                              : null,
                            contractNumber: project.contractNumber ?? null,
                            riskLevel: project.riskLevel ?? null,
                            chapter: project.chapter ?? null,
                            consultantName: project.consultantName,
                            consultantId: project.consultantId,
                          }}
                          consultants={consultants}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canExportData={canExportData}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Cliente
                      </div>
                      <div className="truncate text-sm text-slate-900">
                        {project.clientName}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Consultor
                      </div>
                      <div className="truncate text-sm text-slate-900">
                        {project.consultantName || "Sin asignar"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Inicio:{" "}
                    {new Date(project.startDate).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredProjects.length === 0 && (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No hay empresas registradas.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="hidden lg:block">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre de la empresa</TableHead>
                <TableHead>Nombre del cliente</TableHead>
                <TableHead>Fecha de Inicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Consultor asignado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => {
                    startTransition(() => {
                      router.push(`/projects/${project.id}`);
                    });
                  }}
                >
                  <TableCell className="font-medium hover:text-[#D4AF37]">
                    {project.name}
                  </TableCell>
                  <TableCell>{project.clientName}</TableCell>
                  <TableCell>
                    {new Date(project.startDate).toLocaleDateString("es-ES")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.consultantName || "Sin asignar"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ProjectActionsCell
                      project={{
                        id: project.id,
                        name: project.name,
                        clientName: project.clientName,
                        startDate: new Date(project.startDate),
                        status: project.status,
                        nit: project.nit ?? null,
                        address: project.address ?? null,
                        department: project.department ?? null,
                        municipality: project.municipality ?? null,
                        economicActivity: project.economicActivity ?? null,
                        ciiu: project.ciiu ?? null,
                        phone: project.phone ?? null,
                        workerCount: project.workerCount ?? null,
                        logoUrl: project.logoUrl ?? null,
                        contractStartDate: project.contractStartDate
                          ? new Date(project.contractStartDate)
                          : null,
                        contractNumber: project.contractNumber ?? null,
                        riskLevel: project.riskLevel ?? null,
                        chapter: project.chapter ?? null,
                        consultantName: project.consultantName,
                        consultantId: project.consultantId,
                      }}
                      consultants={consultants}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canExportData={canExportData}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filteredProjects.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-4 text-muted-foreground"
                  >
                    No hay empresas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Card className="rounded-2xl border-slate-200">
          <CardFooter className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} de{" "}
              {filteredProjects.length} empresas
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-slate-700">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
