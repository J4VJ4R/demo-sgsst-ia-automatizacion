"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Wrench, Eye, ArrowRight, Pencil } from "lucide-react";
import { getInspectionEquipmentDetail, getInspectionEquipments } from "@/app/inspection-maintenance-actions";
import { toast } from "sonner";
import { InspectionEquipmentCreateDialog } from "@/components/inspection-maintenance/inspection-equipment-create-dialog";
import { InspectionEquipmentEditDialog } from "@/components/inspection-maintenance/inspection-equipment-edit-dialog";

type EquipmentRow = {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  teamResponsible: string;
  photoUrl: string | null;
  photosCount: number;
};

type EquipmentDetail = Awaited<ReturnType<typeof getInspectionEquipmentDetail>>;

export function InspectionMaintenanceManager(props: { projectId: string; canManage?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewData, setViewData] = useState<EquipmentDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInspectionEquipments(props.projectId);
    if (!res.success) {
      toast.error(res.error || "No se pudo cargar la información.");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(
      res.equipments.map((e) => ({
        id: e.id,
        name: e.name,
        code: e.code ?? null,
        location: e.location ?? null,
        teamResponsible: e.teamResponsible,
        photoUrl: e.photos?.[0]?.url ?? null,
        photosCount: e.photos?.length ?? 0,
      }))
    );
    setLoading(false);
  }, [props.projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const code = (r.code || "").toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [query, rows]);

  const openEquipmentView = async (equipmentId: string) => {
    setViewOpen(true);
    setViewLoading(true);
    try {
      const res = await getInspectionEquipmentDetail({ projectId: props.projectId, equipmentId });
      setViewData(res);
      if (!res.success) {
        toast.error(res.error || "No se pudo cargar el equipo.");
      }
    } catch {
      setViewData(null);
      toast.error("No se pudo cargar el equipo.");
    } finally {
      setViewLoading(false);
    }
  };

  const openEquipmentEdit = (equipmentId: string) => {
    setEditId(equipmentId);
    setEditOpen(true);
  };

  return (
    <Card className="min-w-0 overflow-x-hidden gap-2 py-3">
      <CardHeader className="px-3 gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wrench className="h-5 w-5 text-[#D4AF37]" />
              <span className="min-w-0 truncate">Programa de inspecciones y mantenimiento</span>
            </CardTitle>
            <p className="text-sm leading-[1.5] text-slate-600">
              Registra equipos, fotos y controla las actividades de inspección y mantenimiento.
            </p>
          </div>
          {props.canManage ? (
            <div className="w-full sm:w-auto">
              <InspectionEquipmentCreateDialog projectId={props.projectId} onCreated={load} />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-hidden px-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o código..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9 sm:h-9"
            />
          </div>
          {loading ? <span className="text-sm text-muted-foreground">Cargando...</span> : null}
        </div>

        <div className="mt-4 space-y-3 lg:hidden">
          {filtered.map((r) => (
            <Card key={r.id} className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {r.photoUrl ? (
                      <Image
                        src={r.photoUrl}
                        alt="Foto del equipo"
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      className="block break-words text-base font-semibold text-slate-950 hover:text-[#D4AF37]"
                      href={`/projects/${props.projectId}/inspection-maintenance/${r.id}/activities`}
                    >
                      {r.name}
                    </Link>
                    {r.location ? (
                      <div className="mt-1 break-words text-sm text-slate-600">{r.location}</div>
                    ) : null}
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => openEquipmentView(r.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver equipo
                      </Button>
                      {props.canManage ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl"
                          onClick={() => openEquipmentEdit(r.id)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      ) : null}
                      <Button asChild className="h-11 rounded-xl bg-[#D4AF37] text-black hover:bg-[#B59530]">
                        <Link href={`/projects/${props.projectId}/inspection-maintenance/${r.id}/activities`}>
                          Ver actividades
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Código
                    </div>
                    <div className="break-words text-sm text-slate-900">{r.code || "—"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Responsable
                    </div>
                    <div className="break-words text-sm text-slate-900">{r.teamResponsible}</div>
                  </div>
                </div>
                {r.photosCount > 0 ? (
                  <div className="mt-3 text-xs text-slate-500">{r.photosCount} foto(s)</div>
                ) : null}
              </CardContent>
            </Card>
          ))}

          {!loading && filtered.length === 0 ? (
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No hay equipos registrados.
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-lg border lg:block">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <div className="col-span-5">Equipo</div>
            <div className="col-span-2">Código</div>
            <div className="col-span-3">Responsable</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>
          <div className="divide-y">
            {filtered.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-slate-50/60">
                <div className="col-span-5 min-w-0">
                  <Link
                    className="block truncate font-medium text-slate-900 hover:text-[#D4AF37]"
                    href={`/projects/${props.projectId}/inspection-maintenance/${r.id}/activities`}
                  >
                    {r.name}
                  </Link>
                  {r.location ? <div className="truncate text-xs text-slate-500">{r.location}</div> : null}
                </div>
                <div className="col-span-2 truncate text-slate-700">{r.code || "-"}</div>
                <div className="col-span-3 truncate text-slate-700">{r.teamResponsible}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEquipmentView(r.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Button>
                  {props.canManage ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => openEquipmentEdit(r.id)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                    asChild
                  >
                    <Link href={`/projects/${props.projectId}/inspection-maintenance/${r.id}/activities`}>
                      Actividades
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No hay equipos registrados.
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>

      <Dialog
        open={viewOpen}
        onOpenChange={(next) => {
          setViewOpen(next);
          if (!next) {
            setViewData(null);
            setViewLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del equipo</DialogTitle>
            <DialogDescription>Ficha técnica y datos registrados del equipo.</DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : viewData?.success && viewData.equipment ? (
            <div className="grid gap-5">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {viewData.equipment.photos?.[0]?.url ? (
                    <Image
                      src={viewData.equipment.photos[0].url}
                      alt="Foto del equipo"
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                      Sin foto
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-lg font-semibold text-slate-950">{viewData.equipment.name}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Código: <span className="font-medium text-slate-900">{viewData.equipment.code || "—"}</span>
                  </div>
                  {viewData.equipment.location ? (
                    <div className="text-sm text-slate-600">
                      Ubicación: <span className="font-medium text-slate-900">{viewData.equipment.location}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {viewData.equipment.photos?.length ? (
                <div className="grid gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fotos</div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {viewData.equipment.photos.slice(0, 12).map((p) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                        title={p.name}
                      >
                        <Image
                          src={p.url}
                          alt={p.name}
                          width={160}
                          height={160}
                          className="h-16 w-full object-cover"
                          unoptimized
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsables</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Responsable</span>
                      <span className="font-medium text-slate-900">{viewData.equipment.teamResponsible}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Usuario</span>
                      <span className="font-medium text-slate-900">{viewData.equipment.teamUser}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodicidad</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Verificación</span>
                      <span className="font-medium text-slate-900">{viewData.equipment.verificationPeriodicity}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Mantenimiento</span>
                      <span className="font-medium text-slate-900">{viewData.equipment.maintenancePeriodicity}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha técnica</div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Marca</span>
                    <span className="font-medium text-slate-900">{viewData.equipment.brand || "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Modelo</span>
                    <span className="font-medium text-slate-900">{viewData.equipment.model || "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Serial</span>
                    <span className="font-medium text-slate-900">{viewData.equipment.serial || "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Creado</span>
                    <span className="font-medium text-slate-900">
                      {new Date(viewData.equipment.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                </div>
                {viewData.equipment.observations ? (
                  <div className="mt-3 break-words text-sm text-slate-700">{viewData.equipment.observations}</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No se pudo cargar el equipo.
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
            {props.canManage && viewData?.success && viewData.equipment ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setViewOpen(false);
                  openEquipmentEdit(viewData.equipment.id);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            ) : null}
            {viewData?.success && viewData.equipment ? (
              <Button
                type="button"
                className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] sm:w-auto"
                asChild
              >
                <Link href={`/projects/${props.projectId}/inspection-maintenance/${viewData.equipment.id}/activities`}>
                  Ver actividades
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editId ? (
        <InspectionEquipmentEditDialog
          projectId={props.projectId}
          equipmentId={editId}
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (!next) setEditId(null);
          }}
          onUpdated={load}
        />
      ) : null}
    </Card>
  );
}
