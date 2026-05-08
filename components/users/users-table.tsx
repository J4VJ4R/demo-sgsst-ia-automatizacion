 'use client'
 
 import { useState, useMemo } from "react";
import type { User } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserDialog } from "@/components/users/user-dialog";
import { UserActionsCell } from "@/components/users/user-actions-cell";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface UserWithProjects extends User {
  projectsConsulted?: { id: string; name: string }[];
  clientProjects?: {
    id: string;
    name: string;
    consultant?: { id: string; name: string; email: string } | null;
  }[];
}

interface UsersTableProps {
  users: UserWithProjects[];
}

export function UsersTable({ users }: UsersTableProps) {
  const [filter, setFilter] = useState<"ALL" | "CONSULTANT" | "CLIENT_VIEWER">("ALL");
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    let rows = users;
    if (filter !== "ALL") rows = rows.filter((u) => u.role === filter);
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [users, filter, query]);

  const RoleBadge = ({ role }: { role: string }) => (
    <Badge
      variant="outline"
      className={
        role === "ADMIN_PMD"
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : role === "CONSULTANT"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-slate-50 text-slate-700 border-slate-200"
      }
    >
      {role === "ADMIN_PMD" ? "Administrador" : role === "CONSULTANT" ? "Consultor" : "Cliente"}
    </Badge>
  );

  const activeFilterClass =
    "h-10 sm:h-8 rounded-xl sm:rounded-full bg-[#D4AF37] text-black border-[#D4AF37] hover:bg-[#B59530] cursor-pointer";
  const inactiveFilterClass =
    "h-10 sm:h-8 rounded-xl sm:rounded-full bg-white text-slate-800 border-slate-200 hover:bg-zinc-50 cursor-pointer";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm sm:flex sm:w-auto sm:items-center sm:gap-2 sm:rounded-full">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={filter === "ALL" ? activeFilterClass : inactiveFilterClass}
            onClick={() => setFilter("ALL")}
          >
            Todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={filter === "CONSULTANT" ? activeFilterClass : inactiveFilterClass}
            onClick={() => setFilter("CONSULTANT")}
          >
            Consultores
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={filter === "CLIENT_VIEWER" ? activeFilterClass : inactiveFilterClass}
            onClick={() => setFilter("CLIENT_VIEWER")}
          >
            Clientes
          </Button>
        </div>
        <div className="w-full sm:w-auto">
          <UserDialog triggerClassName="w-full h-10 rounded-2xl sm:w-auto sm:h-9 sm:rounded-md" />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-950">{user.name}</div>
                  <div className="truncate text-sm text-slate-600">{user.email}</div>
                  <div className="mt-2">
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <UserActionsCell user={user} />
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredUsers.length === 0 ? (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron usuarios para este filtro.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Opciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <UserActionsCell user={user} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    No se encontraron usuarios para este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
 }
