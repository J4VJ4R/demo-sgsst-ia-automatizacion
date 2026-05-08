"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={props.className}
    >
      <path d="M19.11 17.02c-.26-.13-1.55-.76-1.79-.85-.24-.09-.42-.13-.6.13-.18.26-.69.85-.85 1.03-.16.18-.31.2-.57.07-.26-.13-1.11-.41-2.12-1.3-.78-.69-1.3-1.54-1.46-1.8-.15-.26-.02-.4.12-.53.12-.12.26-.31.39-.46.13-.15.18-.26.26-.44.09-.18.04-.33-.02-.46-.07-.13-.6-1.44-.82-1.97-.22-.53-.44-.46-.6-.47h-.51c-.18 0-.46.07-.7.33-.24.26-.92.9-.92 2.2s.95 2.56 1.08 2.74c.13.18 1.88 2.87 4.56 4.03.64.28 1.14.45 1.53.57.64.2 1.22.17 1.68.1.51-.08 1.55-.63 1.77-1.23.22-.6.22-1.12.15-1.23-.06-.11-.24-.18-.5-.31ZM16.02 4C9.39 4 4 9.39 4 16.02c0 2.11.55 4.18 1.6 6.01L4 28l6.13-1.58c1.76.96 3.74 1.46 5.88 1.46 6.63 0 12.02-5.39 12.02-12.02C28.04 9.39 22.65 4 16.02 4Zm0 21.9c-1.96 0-3.88-.52-5.56-1.5l-.4-.23-3.63.94.97-3.54-.26-.41a9.86 9.86 0 0 1-1.53-5.14c0-5.49 4.47-9.96 9.96-9.96 5.49 0 9.96 4.47 9.96 9.96 0 5.49-4.47 9.88-9.51 9.88Z" />
    </svg>
  );
}

export function InactiveCompanyDialog(props: { phone: string; open?: boolean }) {
  const open = props.open ?? true;
  const whatsappHref = useMemo(() => {
    const digits = String(props.phone || "").replace(/\D/g, "");
    const withCountry = digits.startsWith("57") ? digits : `57${digits}`;
    return `https://wa.me/${withCountry}`;
  }, [props.phone]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[560px] overflow-hidden p-0"
      >
        <div className="bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Advertencia
                </div>
              </div>
            </div>
          </div>

          <DialogHeader className="mt-4">
            <DialogTitle className="text-xl">Tu empresa se encuentra inactiva</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Esto puede deberse a que tu contrato está inactivo o tienes cartera vencida. Por favor comunícate con soporte para reactivar el servicio.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 rounded-2xl border border-emerald-100 bg-white/70 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <WhatsAppIcon className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Soporte por WhatsApp</div>
                <div className="text-xs text-slate-600">Respuesta rápida</div>
              </div>
            </div>

            <div className="mt-4">
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="block w-full">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <WhatsAppIcon className="mr-2 h-4 w-4 text-white" />
                  WhatsApp soporte
                </Button>
              </a>
              <div className="mt-2 text-center text-[11px] text-slate-500">311 868 2950</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
