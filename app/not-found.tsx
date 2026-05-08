import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Construction } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-blue-100 p-4">
          <Construction className="h-12 w-12 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">En Construcción</h1>
        <p className="max-w-md text-lg text-slate-600">
          Esta página está actualmente en desarrollo. Estamos trabajando para tenerla lista pronto.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link href="/overview">
              Volver al Resumen
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
