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
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle,
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

const ROLE_META: Record<string, { label: string; description: string; color: string; icon: typeof Shield }> = {
  super_admin:   { label: "Super Admin",    description: "Acesso total a todos os provedores e configurações.", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300", icon: Shield },
  admin:         { label: "Administrador",  description: "Gerencia usuários e configurações do provedor.", color: "bg-primary/10 text-primary border-primary/20", icon: ShieldCheck },
  support_staff: { label: "Suporte",        description: "Acessa dados de clientes e suporte. Sem configurações.", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: User },
  user:          { label: "Usuário",        description: "Acesso básico de leitura ao dashboard.", color: "bg-muted text-muted-foreground border-border", icon: User },
  viewer:        { label: "Visualizador",   description: "Apenas visualização.", color: "bg-muted text-muted-foreground border-border", icon: User },
};

const ASSIGNABLE_ROLES_ADMIN: AppRole[] = ["admin", "support_staff", "user"];
const ASSIGNABLE_ROLES_SUPER: AppRole[] = ["super_admin", "admin", "support_staff", "user"];

const EDGE_FN_URL = `https://ohvddptghpcrenxdpyxm.supabase.co/functions/v1/manage-users`;

// ─────────────────────────────────────────────────────────────
// Helper: call edge function with external auth token
// ─────────────────────────────────────────────────────────────

async function callManageUsers(body: Record<string, unknown>) {
  const { data: { session } } = await externalSupabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Erro na operação.");
  return data;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ContasAcesso() {
  const { ispId, ispNome, instanciaIsp } = useActiveIsp();
  const { profile, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  // Role-based access: only admin+ can manage accounts
  const callerRole = profile?.role as AppRole | undefined;
  const isAdmin = callerRole === "admin" || callerRole === "super_admin" || isSuperAdmin;

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "user" as AppRole,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [formRole, setFormRole] = useState<AppRole>("user");
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  // ── Data loading ─────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    if (!ispId) return;
    setIsLoadingData(true);
    setLoadError(null);

    try {
      // Query profiles and roles separately (no FK relationship between tables)
      const profileQuery = externalSupabase
        .from("profiles")
        .select("id, full_name, email, isp_id, instancia_isp, created_at")
        .order("created_at", { ascending: false });

      if (ispId !== "uniforce") {
        profileQuery.eq("isp_id", ispId);
      }

      const [profilesResult, rolesResult] = await Promise.all([
        profileQuery,
        externalSupabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesResult.error) throw profilesResult.error;

      // Build role lookup map
      const roleMap = new Map<string, string>();
      (rolesResult.data || []).forEach((r: any) => {
        roleMap.set(r.user_id, r.role);
      });

      const mapped: UserAccount[] = (profilesResult.data || []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        isp_id: row.isp_id,
        instancia_isp: row.instancia_isp,
        role: (roleMap.get(row.id) as AppRole) ?? null,
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

  // ── Create user ─────────────────────────────────────────

  const resetCreateForm = () => {
    setCreateForm({ full_name: "", email: "", password: "", role: "user" });
    setShowPassword(false);
    setCreateSuccess(false);
  };

  const handleCreate = async () => {
    const { full_name, email, password, role } = createForm;
    if (!full_name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const result = await callManageUsers({
        action: "create",
        email: email.trim().toLowerCase(),
        password,
        full_name: full_name.trim(),
        isp_id: ispId,
        instancia_isp: instanciaIsp || "",
        role,
      });

      setCreateSuccess(true);
      toast({
        title: "Conta criada com sucesso!",
        description: `${full_name} agora tem acesso como ${ROLE_META[role]?.label}.`,
      });

      // Add to local list
      setAccounts((prev) => [
        {
          id: result.user?.id || crypto.randomUUID(),
          full_name,
          email: email.trim().toLowerCase(),
          isp_id: ispId,
          instancia_isp: instanciaIsp || "",
          role,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      // Close after brief success animation
      setTimeout(() => {
        setCreateDialogOpen(false);
        resetCreateForm();
      }, 1500);
    } catch (err: any) {
      toast({
        title: "Erro ao criar conta",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

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
      const { error } = await externalSupabase.rpc("assign_role", {
        _user_id: editingAccount.id,
        _role: formRole,
      });
      if (error) throw error;

      setAccounts((prev) =>
        prev.map((a) => (a.id === editingAccount.id ? { ...a, role: formRole } : a))
      );
      toast({
        title: "Perfil atualizado",
        description: `${editingAccount.full_name || editingAccount.email} agora é ${ROLE_META[formRole]?.label}.`,
      });
      setEditDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete user ──────────────────────────────────────────

  const openDeleteDialog = (account: UserAccount) => {
    setAccountToDelete(account);
    setDeleteConfirmEmail("");
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      await callManageUsers({
        action: "delete",
        user_id: accountToDelete.id,
      });

      setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));
      toast({
        title: "Conta excluída",
        description: `${accountToDelete.full_name || accountToDelete.email} foi removido permanentemente.`,
      });
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
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

  const assignableRoles = isSuperAdmin ? ASSIGNABLE_ROLES_SUPER : ASSIGNABLE_ROLES_ADMIN;

  // ─────────────────────────────────────────────────────────
  // Access guard (after all hooks)
  // ─────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-3">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">
              Somente administradores podem gerenciar contas de acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                  Gerencie as contas dos colaboradores do provedor
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
              { label: "Total",           value: accounts.length,                                                             icon: Users       },
              { label: "Administradores", value: accounts.filter((a) => a.role === "admin" || a.role === "super_admin").length, icon: ShieldCheck },
              { label: "Suporte",         value: accounts.filter((a) => a.role === "support_staff").length,                    icon: User        },
              { label: "ISP ativo",       value: ispNome,                                                                     icon: Building2   },
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
              <div className="flex items-center gap-2">
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
                <Button
                  size="sm"
                  onClick={() => { resetCreateForm(); setCreateDialogOpen(true); }}
                  className="gap-1.5 bg-gradient-to-r from-[hsl(213,81%,54%)] to-[hsl(126,91%,65%)] hover:opacity-90 text-white font-semibold"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Nova conta
                </Button>
              </div>
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
                        {search ? "Nenhum resultado encontrado." : "Nenhuma conta registrada. Clique em 'Nova conta' para criar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((account) => {
                      const roleMeta = account.role ? ROLE_META[account.role] : ROLE_META.viewer;
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
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">(você)</span>
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
                              <Badge variant="outline" className={`text-[10px] border ${roleMeta.color}`}>
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
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isCurrentUser}>
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
                                  Excluir conta
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

      {/* ── Create User Dialog ────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Criar nova conta
            </DialogTitle>
            <DialogDescription>
              O colaborador receberá acesso imediato ao dashboard com as credenciais definidas abaixo.
            </DialogDescription>
          </DialogHeader>

          {createSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-scale-in">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Conta criada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {createForm.full_name} já pode acessar o dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="create-name" className="text-xs flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Nome completo
                </Label>
                <Input
                  id="create-name"
                  placeholder="Ex: João Silva"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email" className="text-xs flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  E-mail
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="colaborador@provedor.com.br"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password" className="text-xs flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Senha inicial
                </Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className="h-9 pr-10"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">O colaborador poderá alterar a senha após o primeiro login.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Perfil de acesso
                </Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as AppRole }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex flex-col">
                          <span>{ROLE_META[role]?.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {ROLE_META[createForm.role]?.description}
                </p>
              </div>
            </div>
          )}

          {!createSuccess && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar conta"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ────────────────────────────────── */}
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
            <Select value={formRole} onValueChange={(v) => setFormRole(v as AppRole)}>
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
              {ROLE_META[formRole]?.description}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Dialog ─────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir conta permanentemente
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. A conta de{" "}
              <strong>{accountToDelete?.full_name || accountToDelete?.email}</strong>{" "}
              será completamente removida do sistema, incluindo autenticação, perfil e permissões.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para confirmar, digite o e-mail da conta abaixo:
            </p>
            <Input
              placeholder={accountToDelete?.email || ""}
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmEmail !== accountToDelete?.email}
            >
              {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
