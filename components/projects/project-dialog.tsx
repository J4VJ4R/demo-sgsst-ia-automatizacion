"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProject,
  updateProject,
  createCompanyLogoUploadRequest,
} from "@/app/actions";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Upload, Image as ImageIcon } from "lucide-react";
import {
  departments,
  fetchMunicipalitiesByDepartment,
} from "@/lib/colombia-data";
import { chapterActivities } from "@/lib/activities-data";

interface ProjectDialogProps {
  consultants: {
    id: string;
    name: string;
  }[];
  project?: {
    id: string;
    name: string;
    clientName: string;
    consultantId: string | null;
    economicActivity?: string | null;
    ciiu?: string | null;
    contractStartDate?: Date | null;
    contractNumber?: number | null;
    riskLevel?: string | null;
    nit?: string | null;
    address?: string | null;
    department?: string | null;
    municipality?: string | null;
    phone?: string | null;
    workerCount?: number | null;
    logoUrl?: string | null;
    chapter?: string | null;
    status?: string;
  } | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProjectDialog({ consultants, project, open: controlledOpen, onOpenChange }: ProjectDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [duplicateEmailOpen, setDuplicateEmailOpen] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);

  // New states
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    project?.department || ""
  );
  const [currentMunicipalities, setCurrentMunicipalities] = useState<string[]>(
    []
  );
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(project?.municipality || "");
  const [selectedChapter, setSelectedChapter] = useState<string>(project?.chapter || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(project?.logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dept = e.target.value;
    setSelectedDepartment(dept);
    setSelectedMunicipality("");
  };

  useEffect(() => {
    let cancelled = false;

    async function loadMunicipalities() {
      if (!selectedDepartment) {
        setCurrentMunicipalities([]);
        return;
      }

      const list = await fetchMunicipalitiesByDepartment(selectedDepartment);
      if (!cancelled) {
        setCurrentMunicipalities(list);
        if (list.length > 0) {
          const initial = project?.municipality || "";
          setSelectedMunicipality(initial && list.includes(initial) ? initial : "");
        } else {
          setSelectedMunicipality("");
        }
      }
    }

    void loadMunicipalities();

    return () => {
      cancelled = true;
    };
  }, [selectedDepartment, project?.municipality]);

  useEffect(() => {
    setSelectedDepartment(project?.department || "");
    setSelectedMunicipality(project?.municipality || "");
  }, [project?.department, project?.municipality]);

  const handleMunicipalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMunicipality(e.target.value);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("El logo no debe superar los 5MB");
        return;
      }
      setLogoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  async function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    // Handle Logo Upload if new file selected
    if (logoFile) {
      try {
        const uploadReqData = new FormData();
        uploadReqData.append("fileName", logoFile.name);
        uploadReqData.append("fileType", logoFile.type);
        uploadReqData.append("fileSize", logoFile.size.toString());

        const uploadReq = await createCompanyLogoUploadRequest(uploadReqData);

        if (!uploadReq.success || !uploadReq.uploadUrl || !uploadReq.publicUrl) {
          throw new Error(uploadReq.error || "Error al preparar carga de logo");
        }

        const encryption = "AES256";
        const uploadRes = await fetch(uploadReq.uploadUrl, {
          method: "PUT",
          body: logoFile,
          headers: {
            "Content-Type": logoFile.type || "application/octet-stream",
            "x-amz-server-side-encryption": encryption,
          },
        });

        if (!uploadRes.ok) {
          const responseText = await uploadRes.text().catch(() => "");
          const normalized = responseText.toLowerCase();
          if (normalized.includes("<code>invalidaccesskeyid</code>") || normalized.includes("invalidaccesskeyid")) {
            throw new Error("Credenciales S3 inválidas en el servidor (InvalidAccessKeyId).");
          }
          if (normalized.includes("<code>signaturedoesnotmatch</code>") || normalized.includes("signaturedoesnotmatch")) {
            throw new Error("Firma inválida al subir a S3 (SignatureDoesNotMatch).");
          }
          if (normalized.includes("<code>accessdenied</code>") || normalized.includes("accessdenied")) {
            throw new Error("Acceso denegado por S3 (AccessDenied).");
          }
          throw new Error(`Error al subir logo a S3 (${uploadRes.status}).`);
        }

        formData.set("logoUrl", uploadReq.publicUrl);
      } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : "Error al subir el logo. Intente de nuevo.";
        toast.error(msg);
        setLoading(false);
        return;
      }
    }

    const result = project ? await updateProject(formData) : await createProject(formData);
    setLoading(false);

    if (result.success) {
      toast.success(project ? "Empresa actualizada exitosamente" : "Empresa creada exitosamente");
      setOpen(false);
      // Reset states
      setLogoFile(null);
      if (!project) setLogoPreview(null);
    } else {
      const message = result.error || (project ? "Error al actualizar la empresa" : "Error al crear la empresa");

      if (!project && message.includes("correo electrónico")) {
        const rawEmail = formData.get("clientEmail") as string | null;
        setDuplicateEmail(rawEmail || null);
        setDuplicateEmailOpen(true);
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="bg-[#D4AF37] text-black hover:bg-[#B59530]">
            <Plus className="mr-2 h-4 w-4" /> Nueva Empresa
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Editar Empresa" : "Crear Nueva Empresa"}</DialogTitle>
          <DialogDescription>
            {project ? "Actualice los datos de la empresa." : "Complete el formulario para registrar un nuevo cliente."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onFormSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {project && (
              <input type="hidden" name="id" value={project.id} />
            )}

            {/* Columna Izquierda: Información Básica */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Información General</h3>
              
              <div className="space-y-1">
                <Label htmlFor="name">Razón Social de la Empresa</Label>
                <Input id="name" name="name" required defaultValue={project?.name} placeholder="Ej. Servobras Ltda." />
              </div>

              <div className="space-y-1">
                <Label htmlFor="nit">NIT (Número de Identificación Tributaria)</Label>
                <Input id="nit" name="nit" required defaultValue={project?.nit || ""} placeholder="Ej. 900123456-1" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="clientName">Nombre del Cliente (Contacto)</Label>
                <Input id="clientName" name="clientName" required defaultValue={project?.clientName} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <Label htmlFor="phone">Teléfono (10 dígitos)</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    required 
                    defaultValue={project?.phone || ""} 
                    pattern="\d{10}"
                    maxLength={10}
                    title="Debe tener 10 dígitos numéricos"
                    placeholder="3001234567"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="workerCount">No. Trabajadores</Label>
                  <Input 
                    id="workerCount" 
                    name="workerCount" 
                    type="number" 
                    required 
                    min="1"
                    defaultValue={project?.workerCount?.toString() || ""} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                 <Label>Logo de la Empresa</Label>
                 <div className="flex items-center gap-4">
                    <div 
                      className="h-20 w-20 rounded-md border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-center p-2">
                           <ImageIcon className="h-6 w-6 mx-auto text-slate-400" />
                           <span className="text-[10px] text-slate-500">Subir Logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                       <input 
                         type="file" 
                         ref={fileInputRef} 
                         onChange={handleLogoChange} 
                         className="hidden" 
                         accept="image/*"
                       />
                       <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                         <Upload className="h-4 w-4 mr-2" /> Seleccionar Imagen
                       </Button>
                       <p className="text-xs text-slate-500 mt-1">Formatos: JPG, PNG. Máx 5MB.</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Columna Derecha: Ubicación y Detalles del Contrato */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Ubicación y Contrato</h3>

              <div className="space-y-1">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" required defaultValue={project?.address || ""} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="department">Departamento</Label>
                  <select
                    id="department"
                    name="department"
                    required
                    value={selectedDepartment}
                    onChange={handleDepartmentChange}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleccione...</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="municipality">Municipio</Label>
                  <select
                    id="municipality"
                    name="municipality"
                    required
                    value={selectedMunicipality}
                    onChange={handleMunicipalityChange}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleccione...</option>
                    {currentMunicipalities.map((mun) => (
                      <option key={mun} value={mun}>{mun}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="economicActivity">Actividad Económica Principal</Label>
                <Textarea 
                  id="economicActivity" 
                  name="economicActivity" 
                  required 
                  defaultValue={project?.economicActivity || ""} 
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ciiu">CIIU (4 dígitos)</Label>
                  <Input id="ciiu" name="ciiu" required pattern="\d{4}" maxLength={4} defaultValue={project?.ciiu || ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="riskLevel">Nivel de Riesgo</Label>
                  <select
                    id="riskLevel"
                    name="riskLevel"
                    required
                    defaultValue={project?.riskLevel || ""}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleccione...</option>
                    <option value="1">Riesgo I (Mínimo)</option>
                    <option value="2">Riesgo II (Bajo)</option>
                    <option value="3">Riesgo III (Medio)</option>
                    <option value="4">Riesgo IV (Alto)</option>
                    <option value="5">Riesgo V (Máximo)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="chapter" className="text-blue-600 font-semibold">Capítulo (Asignación de Actividades)</Label>
                <select
                  id="chapter"
                  name="chapter"
                  required
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Seleccione un Capítulo...</option>
                  <option value="1">Capítulo 1</option>
                  <option value="2">Capítulo 2</option>
                  <option value="3">Capítulo 3</option>
                </select>
                {selectedChapter && (
                  <p className="text-xs text-blue-600 mt-1">
                    Se cargarán automáticamente {chapterActivities[selectedChapter as keyof typeof chapterActivities]?.length} actividades al crear el cliente.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label htmlFor="contractStartDate">Inicio Contrato</Label>
                    <Input 
                      id="contractStartDate" 
                      name="contractStartDate" 
                      type="date" 
                      required 
                      defaultValue={project?.contractStartDate ? new Date(project.contractStartDate).toISOString().split('T')[0] : ""} 
                    />
                 </div>
                 <div className="space-y-1">
                    <Label htmlFor="contractNumber">No. Contrato</Label>
                    <Input 
                      id="contractNumber" 
                      name="contractNumber" 
                      type="number" 
                      required 
                      defaultValue={project?.contractNumber?.toString() || ""} 
                    />
                 </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-t pt-4">
              <div className="space-y-1">
                  <Label htmlFor="consultantId">Consultor Asignado</Label>
                  <select
                    id="consultantId"
                    name="consultantId"
                    required
                    defaultValue={project?.consultantId ?? ""}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleccione...</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="status">Estado</Label>
                  <select
                    id="status"
                    name="status"
                    required
                    defaultValue={project?.status || "ACTIVE"}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="ACTIVE">Activa</option>
                    <option value="INACTIVE">Inactiva</option>
                  </select>
              </div>
          </div>

          {!project && (
             <div className="bg-slate-50 p-4 rounded-md border mb-4">
                <h4 className="font-semibold text-sm mb-3">Credenciales de Acceso (Usuario Cliente)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="clientEmail">Correo Electrónico</Label>
                      <Input id="clientEmail" name="clientEmail" type="email" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="clientPassword">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="clientPassword"
                          name="clientPassword"
                          type={showPassword ? "text" : "password"}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#D4AF37]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Mín. 8 caracteres, mayúscula, número y símbolo.</p>
                    </div>
                </div>
             </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-[#D4AF37] text-black hover:bg-[#B59530] w-full md:w-auto">
              {loading ? "Procesando..." : project ? "Actualizar Empresa" : "Guardar Empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Dialog open={duplicateEmailOpen} onOpenChange={setDuplicateEmailOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Correo ya registrado</DialogTitle>
            <DialogDescription>
              No se puede crear una empresa con un correo de acceso que ya existe.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-700">
            {duplicateEmail && (
              <p className="mb-2">Correo: <span className="font-medium">{duplicateEmail}</span></p>
            )}
            <p>Utilice un correo diferente.</p>
          </div>
          <DialogFooter>
            <Button type="button" className="bg-[#D4AF37] text-black hover:bg-[#B59530]" onClick={() => setDuplicateEmailOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
