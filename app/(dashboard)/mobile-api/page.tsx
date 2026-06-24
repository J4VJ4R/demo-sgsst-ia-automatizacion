import { getCurrentUser } from "@/app/auth-actions";
import { MobileApiDocs } from "@/components/mobile-api/mobile-api-docs";
import { redirect } from "next/navigation";

export default async function MobileApiPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <div className="text-2xl font-semibold text-slate-900">API movil</div>
        <div className="text-sm text-slate-600">
          Referencia online para integrar la app Flutter con la capa demo de autenticacion y datos JSON.
        </div>
      </div>

      <MobileApiDocs />
    </div>
  );
}
