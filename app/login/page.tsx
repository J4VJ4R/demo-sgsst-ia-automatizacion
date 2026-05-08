'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/auth-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const demoPassword = "demo2026";

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await login(formData);
    
    if (result.success) {
      toast.success("Inicio de sesión exitoso");
      try {
        localStorage.setItem("session_last_activity", Date.now().toString());
      } catch {}
      window.location.assign("/overview");
    } else {
      toast.error(result.error || "Error al iniciar sesión");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side: Branding/Image */}
      <div className="hidden lg:flex flex-col bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 energy-wallpaper opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sidebar/35" />
        
        {/* Content Group */}
        <div className="flex-1 flex flex-col justify-center items-start z-10 space-y-10">
          {/* Logo */}
          <div className="inline-block rounded-2xl bg-white p-[14px] border-[3px] border-accent shadow-[0_0_25px_rgba(29,78,216,0.22)]">
             <div className="relative h-20 w-64">
                <Image src="/img/sg-sst-ia-logo.svg" alt="SG-SST-IA Logo" fill className="object-contain" priority />
             </div>
          </div>
          
          {/* Text */}
          <div className="space-y-6 max-w-xl text-left">
            <h1 className="text-5xl font-bold leading-tight text-white tracking-tight">
              SG-SST-IA <span className="text-accent">(Analítica Predictiva)</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Plataforma para digitalizar inspecciones, formación y plan de trabajo anual con foco en prevención y alertas para el sector energía.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-sm text-gray-500 z-10 mt-auto">
          &copy; 2026 Automatización Avanzada S.A.S. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-md space-y-8">
          <div className="energy-hero-card rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="relative text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Bienvenido a SG-SST-IA (Analítica Predictiva)</h2>
              <p className="mt-2 text-slate-600">Cliente: Automatización Avanzada S.A.S</p>
            </div>
          </div>

          <form action={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="nombre@empresa.com" 
                className="h-11 bg-white text-slate-900"
                required 
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  name="password" 
                  type={showPassword ? "text" : "password"} 
                  className="h-11 pr-10 bg-white text-slate-900"
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button className="w-full h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90" type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>

            <Button
              type="button"
              variant="ghost"
              className={[
                "w-full h-11 text-base",
                "energy-border-button",
                "transition-transform duration-300 ease-out",
                "hover:-translate-y-0.5 active:translate-y-0",
              ].join(" ")}
              onClick={() => router.push("/login/formacion")}
              disabled={loading}
            >
              <span className="relative z-10">Formación empresarial</span>
            </Button>
          </form>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wide">Credenciales Demo (Automatización Avanzada S.A.S):</p>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Coordinador SIG:</span>
                <span className="font-mono bg-slate-100 px-1 rounded">admin@autoavanzada.com / {demoPassword}</span>
              </div>
              <div className="flex justify-between">
                <span>Inspector SST:</span>
                <span className="font-mono bg-slate-100 px-1 rounded">inspector@autoavanzada.com / {demoPassword}</span>
              </div>
              <div className="flex justify-between">
                <span>Colaborador:</span>
                <span className="font-mono bg-slate-100 px-1 rounded">operario@autoavanzada.com / {demoPassword}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
