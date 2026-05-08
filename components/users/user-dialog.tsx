'use client'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, EyeOff, Upload, X, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/app/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserDialogProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    image?: string | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
}

export function UserDialog({ user, open: controlledOpen, onOpenChange, triggerClassName }: UserDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.image || null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPreviewUrl(user?.image || null);
      setRemoveImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Solo se permiten imágenes JPG, PNG o WEBP");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La imagen no debe superar los 5MB");
        return;
      }
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setRemoveImage(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    
    if (removeImage) {
      formData.set("removeImage", "true");
    }

    try {
      let result;
      if (user) {
        result = await updateUser(formData);
      } else {
        result = await createUser(formData);
      }

      if (result.success) {
        toast.success(user ? "Usuario actualizado exitosamente" : "Usuario creado exitosamente");
        setOpen(false);
      } else {
        toast.error(result.error || (user ? "Error al actualizar usuario" : "Error al crear usuario"));
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Error al conectar con el servidor. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button className={`bg-[#D4AF37] text-black hover:bg-[#B59530] ${triggerClassName || ""}`}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuario" : "Crear Nuevo Usuario"}</DialogTitle>
          <DialogDescription>
            {user ? "Actualice la información del usuario." : "Complete los datos para registrar un nuevo usuario en el sistema."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <div className="grid gap-4 py-4">
            {user && (
              <input type="hidden" name="id" value={user.id} />
            )}
            
            {/* Profile Image Section */}
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-[#D4AF37]">
                  <AvatarImage src={previewUrl || ""} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 text-slate-400">
                    <UserIcon className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  name="image"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={triggerFileInput}
                  className="text-xs"
                >
                  <Upload className="mr-2 h-3 w-3" />
                  {previewUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                {previewUrl && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRemoveImage}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                JPG, PNG o WEBP. Máximo 5MB.
              </p>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input id="name" name="name" className="col-span-3" required defaultValue={user?.name} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" name="email" type="email" className="col-span-3" required defaultValue={user?.email} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                {user ? "Nueva Contraseña (opcional)" : "Password"}
              </Label>
              <div className="col-span-3 relative flex items-center">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  {...(user ? {} : { required: true })}
                  placeholder={user ? "Dejar en blanco para mantener" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-[#D4AF37] focus-visible:outline-none"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Rol
              </Label>
              <div className="col-span-3">
                {user?.role === 'ADMIN_PMD' ? (
                  <>
                    <input type="hidden" name="role" value={user.role} />
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      Administrador
                    </Badge>
                  </>
                ) : (
                  <Select name="role" required defaultValue={user ? user.role : "CONSULTANT"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN_PMD">Administrador</SelectItem>
                      <SelectItem value="CONSULTANT">Consultor</SelectItem>
                      <SelectItem value="CLIENT_VIEWER">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-[#D4AF37] text-black hover:bg-[#B59530]">
              {loading ? "Guardando..." : user ? "Actualizar Usuario" : "Guardar Usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
