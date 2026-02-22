import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  ShieldCheck,
  User,
  Mail,
  KeyRound,
  Search,
  RefreshCw,
  AlertCircle,
  Shield,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/integrations/supabase/external-client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AppRole = "super_admin" | "admin" | "support_staff" | "user" | "viewer";

interface UserAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  isp_id: string | null;
  instancia_isp: string | null;
  role: AppRole | null;
  created_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  super_admin:   { label: "Super Admin",    color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300", icon: Shield },
  admin:         { label: "Administrador",  color: "bg-primary/10 text-primary border-primary/20",                                               icon: ShieldCheck },
  support_staff: { label: "Suporte",        color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",           icon: User },
  user:          { label: "Usuário",        color: "bg-muted text-muted-foreground border-border",                                                icon: User },
  viewer:        { label: "Visualizador",   color: "bg-muted text-muted-foreground border-border",                                                icon: User },
};

/** Roles that can be assigned by an ISP admin */
const ASSIGNABLE_ROLES_ADMIN: AppRole[] = ["admin", "support_staff", "user"];
/** Roles that can be assigned by a super_admin */
const ASSIGNABLE_ROLES_SUPER: AppRole[] = ["super_admin", "admin", "support_staff", "user"];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ContasAcesso() {
  const { ispId, ispNome } = useActiveIsp();
  const { profile, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [formRole, setFormRole] = useState<AppRole>("user");
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Data loading ─────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    if (!ispId) return;
    setIsLoadingData(true);
    setLoadError(null);

    try {
      // Super admins viewing the 'uniforce' ISP don't need ISP filtering
      const query = externalSupabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          isp_id,
          instancia_isp,
          created_at,
          user_roles ( role )
        `)
        .order("created_at", { ascending: false });

      // Filter: super admins see users of the currently selected ISP
      // (or all ISPs if needed — here we respect selectedIsp scope)
      if (ispId !== "uniforce") {
        query.eq("isp_id", ispId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: UserAccount[] = (data || []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        isp_id: row.isp_id,
        instancia_isp: row.instancia_isp,
        // Take the most privileged role from the array
        role: (row.user_roles?.[0]?.role as AppRole) ?? null,
        created_at: row.created_at,
      }));

      setAccounts(mapped);
    } catch (err: any) {
      console.error("Error loading accounts:", err);
      setLoadError("Erro ao carregar contas. Tente novamente.");
    } finally {
      setIsLoadingData(false);
    }
  }, [ispId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ── Edit role ────────────────────────────────────────────

  const openEditDialog = (account: UserAccount) => {
    setEditingAccount(account);
    setFormRole((account.role as AppRole) || "user");
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingAccount) return;
    setIsSaving(true);
    try {
      // Use the RPC function which enforces permission rules server-side
      const { error } = await externalSupabase.rpc("assign_role", {
        _user_id: editingAccount.id,
        _role: formRole,
      });

      if (error) throw error;

      setAccounts((prev) =>
        prev.map((a) => (a.id === editingAccount.id ? { ...a, role: formRole } : a))
      );
      toast({
        title: "Role atualizado",
        description: `${editingAccount.full_name || editingAccount.email} agora tem o perfil "${ROLE_META[formRole]?.label}".`,
      });
      setEditDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar role",
        description: err.message || "Operação não permitida.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Remove user ──────────────────────────────────────────

  const openDeleteDialog = (account: UserAccount) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      // Remove role assignment (profile remains, access revoked)
      if (accountToDelete.role) {
        const { error } = await externalSupabase.rpc("revoke_role", {
          _user_id: accountToDelete.id,
          _role: accountToDelete.role,
        });
        if (error) throw error;
      }

      setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));
      toast({
        title: "Acesso revogado",
        description: `${accountToDelete.full_name || accountToDelete.email} foi removido.`,
      });
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (err: any) {
      toast({
        title: "Erro ao remover",
        description: err.message || "Operação não permitida.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Filtered list ─────────────────────────────────────────

  const filteredAccounts = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.full_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.isp_id?.toLowerCase().includes(q)
    );
  });

  const assignableRoles = isSuperAdmin
    ? ASSIGNABLE_ROLES_SUPER
    : ASSIGNABLE_ROLES_ADMIN;

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Contas de Acesso
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Gerencie as contas de acesso dos colaboradores do provedor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Shield className="h-3 w-3" />
                  Super Admin
                </Badge>
              )}
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                {ispNome}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 max-w-5xl space-y-6">
        {/* Stats */}
        {!isLoadingData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total",          value: accounts.length,                                           icon: Users       },
              { label: "Administradores", value: accounts.filter((a) => a.role === "admin" || a.role === "super_admin").length, icon: ShieldCheck },
              { label: "Suporte",        value: accounts.filter((a) => a.role === "support_staff").length, icon: User        },
              { label: "ISP ativo",      value: ispNome,                                                   icon: Building2   },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Notice: user creation via dashboard */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Para <strong>criar novos usuários</strong>, acesse{" "}
            <strong>Supabase Dashboard → Authentication → Users → Add User</strong>.
            Após criação, o perfil e role são atribuídos automaticamente pelo trigger do banco.
          </p>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Colaboradores</CardTitle>
                <CardDescription>
                  Contas com acesso ao dashboard em{" "}
                  <span className="font-medium text-foreground">{ispNome}</span>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAccounts}
                disabled={isLoadingData}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou ISP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadError ? (
              <div className="flex items-center gap-2 p-6 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{loadError}</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    {isSuperAdmin && <TableHead>ISP</TableHead>}
                    <TableHead>Perfil</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingData ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={isSuperAdmin ? 6 : 5}>
                          <div className="h-4 bg-muted animate-pulse rounded w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isSuperAdmin ? 6 : 5}
                        className="text-center py-12 text-muted-foreground"
                      >
                        {search ? "Nenhum resultado encontrado." : "Nenhuma conta registrada."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((account) => {
                      const roleMeta = account.role
                        ? ROLE_META[account.role]
                        : ROLE_META.viewer;
                      const RoleIcon = roleMeta.icon;
                      const isCurrentUser = account.id === profile?.user_id;

                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <RoleIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span>
                                {account.full_name || "—"}
                                {isCurrentUser && (
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                                    (você)
                                  </span>
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {account.email || "—"}
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {account.isp_id || "—"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            {account.role ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] border ${roleMeta.color}`}
                              >
                                {roleMeta.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {account.created_at
                              ? new Date(account.created_at).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={isCurrentUser}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Alterar perfil
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(account)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Revogar acesso
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar perfil de acesso</DialogTitle>
            <DialogDescription>
              Defina o nível de acesso de{" "}
              <strong>{editingAccount?.full_name || editingAccount?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs flex items-center gap-1.5 mb-2">
              <KeyRound className="h-3.5 w-3.5" />
              Perfil de acesso
            </Label>
            <Select
              value={formRole}
              onValueChange={(v) => setFormRole(v as AppRole)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_META[role]?.label || role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {formRole === "super_admin" && "Acesso total a todos os provedores e configurações."}
              {formRole === "admin" && "Gerencia usuários e configurações do seu provedor."}
              {formRole === "support_staff" && "Acessa dados de clientes e suporte. Sem configurações."}
              {formRole === "user" && "Acesso básico de leitura ao dashboard."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Revoke Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
            <DialogDescription>
              O acesso de <strong>{accountToDelete?.full_name || accountToDelete?.email}</strong> ao
              dashboard será removido. O usuário permanece no sistema de autenticação mas perde
              todos os privilégios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Removendo..." : "Revogar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
