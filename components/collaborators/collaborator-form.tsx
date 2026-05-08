"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createCollaborator, checkCollaboratorDocument, updateCollaborator } from "@/app/collaborator-actions";
import { Loader2 } from "lucide-react";

interface CollaboratorFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
  mode?: "create" | "edit";
  initialData?: {
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
}

export function CollaboratorForm({
  projectId,
  onSuccess,
  onCancel,
  mode = "create",
  initialData,
}: CollaboratorFormProps) {
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState(initialData?.documentType || "");
  const [contractType, setContractType] = useState(initialData?.contractType || "");
  const [status, setStatus] = useState(initialData?.status || "ACTIVE");
  const [driverRole, setDriverRole] = useState(initialData?.driverRole || "");

  async function handleDocumentBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (mode === "edit") return;
    const docNum = e.target.value.trim();
    if (!docNum) return;

    setDocLoading(true);
    const result = await checkCollaboratorDocument(projectId, docNum);
    setDocLoading(false);

    if (result.exists) {
      setDocumentError("Este número de documento ya está registrado en la empresa.");
    } else {
      setDocumentError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (documentError) {
      toast.error("Corrija los errores antes de guardar.");
      return;
    }

    if (!documentType || !contractType || !status) {
      toast.error("Completa los campos de Tipo de documento, Tipo de contrato y Estado.");
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("documentType", documentType);
    formData.set("contractType", contractType);
    formData.set("status", status);
    formData.set("driverRole", driverRole);
    formData.append("projectId", projectId);

    if (mode === "edit" && initialData?.id) {
      formData.append("id", initialData.id);
    }

    const result =
      mode === "edit" ? await updateCollaborator(formData) : await createCollaborator(formData);
    setLoading(false);

    if (result.success) {
      toast.success(
        mode === "edit"
          ? "Colaborador actualizado exitosamente."
          : "Colaborador agregado exitosamente."
      );
      onSuccess();
    } else {
      toast.error(result.error || "Error al agregar colaborador.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Documento */}
        <div className="space-y-2">
          <Label htmlFor="documentType">Tipo de Documento *</Label>
          <Select
            value={documentType}
            onValueChange={setDocumentType}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
              <SelectItem value="CE">Cédula de Extranjería</SelectItem>
              <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
              <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
              <SelectItem value="PEP">PEP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentNumber">Número de Documento *</Label>
          <div className="relative">
            <Input
              id="documentNumber"
              name="documentNumber"
              type="text"
              pattern="\d+"
              title="Solo números"
              required
              onBlur={handleDocumentBlur}
              defaultValue={initialData?.documentNumber}
              className={documentError ? "border-red-500 pr-8" : "pr-8"}
            />
            {docLoading && (
              <div className="absolute right-2 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {documentError && <p className="text-xs text-red-500 mt-1">{documentError}</p>}
        </div>

        {/* Nombres */}
        <div className="space-y-2">
          <Label htmlFor="firstName">Primer Nombre *</Label>
          <Input
            id="firstName"
            name="firstName"
            required
            defaultValue={initialData?.firstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secondName">Segundo Nombre</Label>
          <Input
            id="secondName"
            name="secondName"
            defaultValue={initialData?.secondName || undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="firstSurname">Primer Apellido *</Label>
          <Input
            id="firstSurname"
            name="firstSurname"
            required
            defaultValue={initialData?.firstSurname}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secondSurname">Segundo Apellido</Label>
          <Input
            id="secondSurname"
            name="secondSurname"
            defaultValue={initialData?.secondSurname || undefined}
          />
        </div>

        {/* Contrato */}
        <div className="space-y-2">
          <Label htmlFor="startDate">Fecha de Ingreso *</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={
              initialData?.startDate
                ? new Date(initialData.startDate).toISOString().slice(0, 10)
                : undefined
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractType">Tipo de Contrato *</Label>
          <Select
            value={contractType}
            onValueChange={setContractType}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Indefinido">Término Indefinido</SelectItem>
              <SelectItem value="Fijo">Término Fijo</SelectItem>
              <SelectItem value="ObraLabor">Obra o Labor</SelectItem>
              <SelectItem value="PrestacionServicios">Prestación de Servicios</SelectItem>
              <SelectItem value="Aprendizaje">Aprendizaje</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Cargo *</Label>
          <Input
            id="position"
            name="position"
            required
            defaultValue={initialData?.position}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverRole">Rol de conductor</Label>
          <Select value={driverRole || "none"} onValueChange={(v) => setDriverRole(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sin rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin rol</SelectItem>
              <SelectItem value="CONDUCTOR">Conductor</SelectItem>
            </SelectContent>
          </Select>
          <input id="driverRole" name="driverRole" type="hidden" value={driverRole} />
        </div>
        
        {/* Contacto */}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={initialData?.email}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            pattern="\d+"
            title="Solo números"
            required
            defaultValue={initialData?.phone}
          />
        </div>

        {/* Seguridad Social */}
        <div className="space-y-2">
          <Label htmlFor="rh">RH *</Label>
          <Select
            name="rh"
            defaultValue={initialData?.rh}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="eps">EPS *</Label>
          <Input
            id="eps"
            name="eps"
            required
            defaultValue={initialData?.eps}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="arl">ARL *</Label>
          <Input
            id="arl"
            name="arl"
            required
            defaultValue={initialData?.arl}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="afp">AFP *</Label>
          <Input
            id="afp"
            name="afp"
            required
            defaultValue={initialData?.afp}
          />
        </div>

        {/* Emergencia */}
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Contacto Emergencia (Nombre) *</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            required
            defaultValue={initialData?.emergencyContactName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Contacto Emergencia (Teléfono) *</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            pattern="\d+"
            title="Solo números"
            required
            defaultValue={initialData?.emergencyContactPhone}
          />
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <Label htmlFor="status">Estado *</Label>
          <Select
            value={status}
            onValueChange={setStatus}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="INACTIVE">Inactivo</SelectItem>
              <SelectItem value="RETIRADO">Retirado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección Completa *</Label>
        <Textarea
          id="address"
          name="address"
          required
          defaultValue={initialData?.address}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !!documentError} className="bg-[#D4AF37] text-black hover:bg-[#B59530]">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
            </>
          ) : (
            "Guardar Colaborador"
          )}
        </Button>
      </div>
    </form>
  );
}
