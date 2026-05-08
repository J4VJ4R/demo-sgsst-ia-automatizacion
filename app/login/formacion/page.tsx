"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, registerStudent, requestStudentPasswordReset } from "@/app/auth-actions";

type View = "login" | "register" | "forgot";

export default function LearningLoginPage() {
  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [password2, setPassword2] = useState("");
  const demoPassword = "demo2026";

  const title = useMemo(() => {
    if (view === "register") return "Crear cuenta de estudiante";
    if (view === "forgot") return "Recuperar contraseña";
    return "Iniciar sesión (Formación)";
  }, [view]);

  async function onLogin(formData: FormData) {
    setLoading(true);
    const result = await login(formData);
    if (result.success) {
      toast.success("Inicio de sesión exitoso");
      try {
        localStorage.setItem("session_last_activity", Date.now().toString());
      } catch {}
      window.location.assign("/learning");
      return;
    }
    toast.error(result.error || "Error al iniciar sesión");
    setLoading(false);
  }

  async function onRegister(formData: FormData) {
    const password = String(formData.get("password") || "");
    if (password2.trim() && password.trim() !== password2.trim()) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const result = await registerStudent(formData);
    if (result.success) {
      toast.success("Cuenta creada. Bienvenido.");
      try {
        localStorage.setItem("session_last_activity", Date.now().toString());
      } catch {}
      window.location.assign("/learning");
      return;
    }
    toast.error(result.error || "No se pudo crear la cuenta.");
    setLoading(false);
  }

  async function onForgot(formData: FormData) {
    setLoading(true);
    const result = await requestStudentPasswordReset(formData);
    if (result.success) {
      const debugSuffix =
        process.env.NODE_ENV !== "production" && "debugId" in result && result.debugId
          ? ` (debug: ${String(result.debugId)})`
          : "";
      toast.success(`Si el correo existe, enviaremos un enlace de recuperación.${debugSuffix}`);
      setView("login");
      setLoading(false);
      return;
    }
    toast.error(result.error || "No se pudo enviar el correo.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 energy-wallpaper opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sidebar/35" />
        <div className="flex-1 flex flex-col justify-center items-start z-10 space-y-10">
          <div className="inline-block rounded-2xl bg-white p-[14px] border-[3px] border-accent shadow-[0_0_25px_rgba(29,78,216,0.22)]">
            <div className="relative h-20 w-64">
              <Image src="/img/sg-sst-ia-logo.svg" alt="SG-SST-IA Logo" fill className="object-contain" priority />
            </div>
          </div>
          <div className="space-y-4 max-w-xl text-left">
            <h1 className="text-4xl font-bold leading-tight text-white tracking-tight">
              Formación <span className="text-accent">empresarial</span>
            </h1>
            <p className="text-base text-gray-400 leading-relaxed">
              Accede como estudiante para ver cursos, módulos, progreso y certificados.
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500 z-10 mt-auto">&copy; 2026 Automatización Avanzada S.A.S. Todos los derechos reservados.</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">
              {view === "register"
                ? "Regístrate con tu correo y una contraseña."
                : view === "forgot"
                ? "Ingresa tu correo para recibir un enlace."
                : "Ingresa con tu correo y contraseña."}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Demo (Colaborador)</div>
            <div className="mt-1 text-xs text-slate-700">
              <span className="font-mono bg-slate-100 px-1 rounded">operario@autoavanzada.com</span>
              <span className="mx-2 text-slate-400">/</span>
              <span className="font-mono bg-slate-100 px-1 rounded">{demoPassword}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={view === "login" ? "default" : "outline"}
              className={
                view === "login"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-primary text-primary hover:bg-primary/10"
              }
              onClick={() => {
                setView("login");
                setPassword2("");
              }}
              disabled={loading}
            >
              Ingresar
            </Button>
            <Button
              type="button"
              variant={view === "register" ? "default" : "outline"}
              className={
                view === "register"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-primary text-primary hover:bg-primary/10"
              }
              onClick={() => setView("register")}
              disabled={loading}
            >
              Registrarse
            </Button>
            <Button
              type="button"
              variant={view === "forgot" ? "default" : "outline"}
              className={
                view === "forgot"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-primary text-primary hover:bg-primary/10"
              }
              onClick={() => setView("forgot")}
              disabled={loading}
            >
              Recuperar
            </Button>
          </div>

          {view === "login" ? (
            <form action={onLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" name="email" type="email" placeholder="correo@empresa.com" className="h-11 bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
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
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button className="w-full h-11 text-base" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Iniciar sesión
              </Button>
            </form>
          ) : null}

          {view === "register" ? (
            <form action={onRegister} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" name="email" type="email" placeholder="correo@empresa.com" className="h-11 bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
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
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="text-xs text-slate-500">Mínimo 8 caracteres.</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="password2"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    type={showPassword2 ? "text" : "password"}
                    className="h-11 pr-10 bg-white text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    {showPassword2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button className="w-full h-11 text-base" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Crear cuenta
              </Button>
              <div className="text-xs text-slate-600">
                Nota: tu cuenta puede requerir asignación a una empresa para ver cursos. Si no ves empresas, contacta soporte.
              </div>
            </form>
          ) : null}

          {view === "forgot" ? (
            <form action={onForgot} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" name="email" type="email" placeholder="correo@empresa.com" className="h-11 bg-white text-slate-900" required />
              </div>
              <Button className="w-full h-11 text-base" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar enlace
              </Button>
              <div className="text-xs text-slate-600">Si el correo existe, enviaremos un enlace con vigencia de 30 minutos.</div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
