"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInspectionEquipmentUploadRequest, getInspectionEquipmentDetail, updateInspectionEquipment } from "@/app/inspection-maintenance-actions";
import { X } from "lucide-react";

type PhotoDraft = { file: File; previewUrl: string };

const PERIODICITY_OPTIONS = ["Diaria", "Semanal", "Mensual", "Trimestral", "Semestral", "Anual"] as const;

export function InspectionEquipmentEditDialog(props: {
  projectId: string;
  equipmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newPhotosRef = useRef<PhotoDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [teamResponsible, setTeamResponsible] = useState("");
  const [teamUser, setTeamUser] = useState("");
  const [verificationPeriodicity, setVerificationPeriodicity] = useState<string>("");
  const [maintenancePeriodicity, setMaintenancePeriodicity] = useState<string>("");
  const [observations, setObservations] = useState("");

  const [existingPhotos, setExistingPhotos] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoDraft[]>([]);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      teamResponsible.trim().length > 0 &&
      teamUser.trim().length > 0 &&
      verificationPeriodicity.trim().length > 0 &&
      maintenancePeriodicity.trim().length > 0
    );
  }, [maintenancePeriodicity, name, teamResponsible, teamUser, verificationPeriodicity]);

  useEffect(() => {
    if (!props.open) return;
    setLoading(true);
    void (async () => {
      try {
        const res = await getInspectionEquipmentDetail({ projectId: props.projectId, equipmentId: props.equipmentId });
        if (!res.success || !res.equipment) {
          toast.error(res.error || "No se pudo cargar el equipo.");
          return;
        }
        setName(res.equipment.name || "");
        setCode(res.equipment.code || "");
        setLocation(res.equipment.location || "");
        setBrand(res.equipment.brand || "");
        setModel(res.equipment.model || "");
        setSerial(res.equipment.serial || "");
        setTeamResponsible(res.equipment.teamResponsible || "");
        setTeamUser(res.equipment.teamUser || "");
        setVerificationPeriodicity(res.equipment.verificationPeriodicity || "");
        setMaintenancePeriodicity(res.equipment.maintenancePeriodicity || "");
        setObservations(res.equipment.observations || "");
        setExistingPhotos((res.equipment.photos || []).map((p) => ({ id: p.id, name: p.name, url: p.url })));
      } finally {
        setLoading(false);
      }
    })();
  }, [props.equipmentId, props.open, props.projectId]);

  useEffect(() => {
    newPhotosRef.current = newPhotos;
  }, [newPhotos]);

  useEffect(() => {
    if (!props.open) return;
    return () => {
      newPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [props.open]);

  const addFiles = (files: File[]) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const next = files
      .filter((f) => allowed.includes(f.type))
      .filter((f) => f.size <= 20 * 1024 * 1024)
      .slice(0, Math.max(0, 10 - newPhotos.length))
      .map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }));

    const rejected = files.length - next.length;
    if (rejected > 0) {
      toast.info("Algunas fotos no se agregaron.", {
        description: "Verifique el tipo de imagen y tamaño (máx 20MB).",
      });
    }

    setNewPhotos((prev) => [...prev, ...next]);
  };

  const uploadPhotos = async (files: File[]) => {
    if (files.length === 0) return [];
    const prep = await createInspectionEquipmentUploadRequest({
      projectId: props.projectId,
      files: files.map((f) => ({ name: f.name, type: f.type, sizeBytes: f.size })),
    });

    if (!prep.success) throw new Error(prep.error || "No se pudo preparar la carga de fotos.");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const up = prep.uploads[i];
      const res = await fetch(up.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-amz-server-side-encryption": "AES256" },
        body: file,
      });
      if (!res.ok) throw new Error(`Error al subir "${file.name}"`);
    }

    return prep.uploads.map((u) => ({
      name: u.name,
      url: u.url,
      key: u.key,
      sizeBytes: u.sizeBytes,
    }));
  };

  const resetLocal = () => {
    setExistingPhotos([]);
    newPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNewPhotos([]);
    setName("");
    setCode("");
    setLocation("");
    setBrand("");
    setModel("");
    setSerial("");
    setTeamResponsible("");
    setTeamUser("");
    setVerificationPeriodicity("");
    setMaintenancePeriodicity("");
    setObservations("");
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next && saving) return;
        props.onOpenChange(next);
        if (!next) resetLocal();
      }}
    >
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar equipo</DialogTitle>
          <DialogDescription>Actualice los datos del equipo y agregue nuevas fotos.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre del equipo *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo" />
            </div>

            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código" />
            </div>

            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ubicación" />
            </div>

            <div className="space-y-2">
              <Label>Marca</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" />
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo" />
            </div>

            <div className="space-y-2">
              <Label>Serial</Label>
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" />
            </div>

            <div className="space-y-2">
              <Label>Responsable del equipo *</Label>
              <Input
                value={teamResponsible}
                onChange={(e) => setTeamResponsible(e.target.value)}
                placeholder="Responsable del equipo"
              />
            </div>

            <div className="space-y-2">
              <Label>Usuario del equipo *</Label>
              <Input value={teamUser} onChange={(e) => setTeamUser(e.target.value)} placeholder="Usuario del equipo" />
            </div>

            <div className="space-y-2">
              <Label>Periodicidad de verificación *</Label>
              <Select value={verificationPeriodicity} onValueChange={setVerificationPeriodicity}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione periodicidad" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Periodicidad de mantenimiento *</Label>
              <Select value={maintenancePeriodicity} onValueChange={setMaintenancePeriodicity}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione periodicidad" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observaciones" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Fotos actuales</Label>
              {existingPhotos.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin fotos cargadas</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {existingPhotos.slice(0, 12).map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      title={p.name}
                    >
                      <Image src={p.url} alt={p.name} width={160} height={160} className="h-16 w-full object-cover" unoptimized />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Agregar nuevas fotos (máx 20MB c/u)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    e.currentTarget.value = "";
                    addFiles(files);
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Seleccionar fotos
                </Button>
                {newPhotos.length > 0 ? <span className="text-xs text-slate-500">{newPhotos.length} nuevas</span> : null}
              </div>

              {newPhotos.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {newPhotos.map((p, idx) => (
                    <div key={`${p.file.name}-${idx}`} className="relative overflow-hidden rounded-xl border bg-white">
                      <Image src={p.previewUrl} alt={p.file.name} width={320} height={224} className="h-28 w-full object-cover" unoptimized />
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow"
                        onClick={() => {
                          URL.revokeObjectURL(p.previewUrl);
                          setNewPhotos((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <X className="h-4 w-4 text-slate-700" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] sm:w-auto"
            disabled={!canSubmit || saving || loading}
            onClick={async () => {
              if (!canSubmit) {
                toast.error("Completa los campos obligatorios.");
                return;
              }
              setSaving(true);
              try {
                const uploaded = await uploadPhotos(newPhotos.map((p) => p.file));
                const res = await updateInspectionEquipment({
                  projectId: props.projectId,
                  equipmentId: props.equipmentId,
                  name,
                  code,
                  location,
                  brand,
                  model,
                  serial,
                  teamResponsible,
                  teamUser,
                  verificationPeriodicity,
                  maintenancePeriodicity,
                  observations,
                  newPhotos: uploaded,
                });
                if (!res.success) {
                  toast.error(res.error || "No se pudo actualizar el equipo.");
                  return;
                }
                toast.success("Equipo actualizado");
                props.onOpenChange(false);
                resetLocal();
                if (props.onUpdated) await props.onUpdated();
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Error al actualizar";
                toast.error(msg);
              } finally {
                setSaving(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
