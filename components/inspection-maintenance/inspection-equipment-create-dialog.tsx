"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Image from "next/image";
import { createInspectionEquipment, createInspectionEquipmentUploadRequest } from "@/app/inspection-maintenance-actions";
import { Plus, X } from "lucide-react";

type PhotoDraft = { file: File; previewUrl: string };

const PERIODICITY_OPTIONS = ["Diaria", "Semanal", "Mensual", "Trimestral", "Semestral", "Anual"] as const;

export function InspectionEquipmentCreateDialog(props: { projectId: string; onCreated: () => Promise<void> | void; disabled?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
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

  const [photos, setPhotos] = useState<PhotoDraft[]>([]);

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
    if (!open) return;
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [open, photos]);

  const reset = () => {
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
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
  };

  const addFiles = (files: File[]) => {
    const next: PhotoDraft[] = [];
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" excede 20MB`);
        continue;
      }
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" no es una imagen`);
        continue;
      }
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (next.length > 0) setPhotos((prev) => [...prev, ...next]);
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
      if (!res.ok) {
        throw new Error(`Error al subir "${file.name}"`);
      }
    }

    return prep.uploads.map((u) => ({
      name: u.name,
      url: u.url,
      key: u.key,
      sizeBytes: u.sizeBytes,
    }));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && saving) return;
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          className="h-11 w-full rounded-2xl bg-[#D4AF37] px-4 text-base text-black hover:bg-[#B59530] sm:h-9 sm:w-auto sm:rounded-full sm:text-sm"
          disabled={!!props.disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Programa de Inspección
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programa de Inspección</DialogTitle>
          <DialogDescription>Registra un nuevo equipo para inspecciones y mantenimiento.</DialogDescription>
        </DialogHeader>

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
            <Input value={teamResponsible} onChange={(e) => setTeamResponsible(e.target.value)} placeholder="Responsable del equipo" />
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
            <Label>Fotos del equipo (máx 20MB c/u)</Label>
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
              {photos.length > 0 ? <span className="text-xs text-slate-500">{photos.length} seleccionadas</span> : null}
            </div>

            {photos.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, idx) => (
                  <div key={`${p.file.name}-${idx}`} className="relative overflow-hidden rounded-xl border bg-white">
                    <Image
                      src={p.previewUrl}
                      alt={p.file.name}
                      width={320}
                      height={224}
                      className="h-28 w-full object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow"
                      onClick={() => {
                        URL.revokeObjectURL(p.previewUrl);
                        setPhotos((prev) => prev.filter((_, i) => i !== idx));
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

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            disabled={!canSubmit || saving}
            onClick={async () => {
              if (!canSubmit) {
                toast.error("Completa los campos obligatorios.");
                return;
              }

              setSaving(true);
              try {
                const uploaded = await uploadPhotos(photos.map((p) => p.file));
                const res = await createInspectionEquipment({
                  projectId: props.projectId,
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
                  photos: uploaded,
                });
                if (!res.success) {
                  toast.error(res.error || "No se pudo guardar.");
                  return;
                }
                toast.success("Equipo creado correctamente.");
                setOpen(false);
                await props.onCreated();
              } catch (e) {
                const message = e instanceof Error ? e.message : "Error al guardar.";
                toast.error(message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
