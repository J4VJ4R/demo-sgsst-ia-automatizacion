import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";
import { AiTrainingSettings } from "@/components/settings/ai-training-settings";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <div className="text-2xl font-semibold text-slate-900">Configuración</div>
        <div className="text-sm text-slate-600">
          Ajustes generales y funciones demo de analítica predictiva.
        </div>
      </div>

      <AiTrainingSettings />
    </div>
  );
}
