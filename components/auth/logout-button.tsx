'use client'

import { LogOut } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  collapsed: boolean;
}

export function LogoutButton({ collapsed }: LogoutButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => logout()}
      aria-label="Cerrar sesión"
      className={cn(
        "mt-2 flex w-full max-w-full justify-start gap-2 rounded-full px-3 py-2 text-gray-200 hover:bg-zinc-900 hover:text-[#D4AF37]",
        collapsed && "justify-center gap-0"
      )}
    >
      <LogOut className={collapsed ? "h-6 w-6 md:h-7 md:w-7" : "h-5 w-5"} />
      {!collapsed && (
        <span className="truncate text-sm font-medium">Cerrar sesión</span>
      )}
    </Button>
  );
}
