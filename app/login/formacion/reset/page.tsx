import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetStudentPassword } from "@/app/auth-actions";

export default async function LearningResetPasswordPage(props: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token = "", error = "" } = await props.searchParams;

  async function submit(formData: FormData) {
    "use server";
    const res = await resetStudentPassword(formData);
    if (res.success) {
      redirect("/login/formacion");
    }
    redirect(`/login/formacion/reset?token=${encodeURIComponent(token)}&error=1`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Restablecer contraseña</h1>
          <p className="text-sm text-slate-600">Ingresa una nueva contraseña para tu cuenta de estudiante.</p>
        </div>

        {!token ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Enlace inválido. Solicita la recuperación nuevamente desde el login.
          </div>
        ) : (
          <form action={submit} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                No se pudo restablecer la contraseña. Verifica el enlace o solicita uno nuevo.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" name="password" type="password" className="h-11 bg-white text-slate-900" required />
              <div className="text-xs text-slate-500">Mínimo 8 caracteres.</div>
            </div>

            <Button className="w-full h-11 text-base" type="submit">
              Guardar contraseña
            </Button>
          </form>
        )}

        <Button asChild type="button" variant="outline" className="w-full">
          <Link href="/login/formacion">Volver al login</Link>
        </Button>
      </div>
    </div>
  );
}
