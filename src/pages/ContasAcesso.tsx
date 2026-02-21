import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, MoreHorizontal, Trash2, Pencil, ShieldCheck, User, Mail, KeyRound, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";

interface Account {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operador" | "viewer";
  status: "ativo" | "inativo";
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-primary/10 text-primary border-primary/20" },
  operador: { label: "Operador", color: "bg-accent/10 text-accent-foreground border-accent/20" },
  viewer: { label: "Visualizador", color: "bg-muted text-muted-foreground border-border" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-800 border-green-200" },
  inativo: { label: "Inativo", color: "bg-red-100 text-red-800 border-red-200" },
};

// Mock data — será substituído por dados reais do backend
const MOCK_ACCOUNTS: Account[] = [
  { id: "1", name: "Carlos Silva", email: "carlos@provedor.com.br", role: "admin", status: "ativo", created_at: "2024-01-15" },
  { id: "2", name: "Ana Souza", email: "ana@provedor.com.br", role: "operador", status: "ativo", created_at: "2024-03-20" },
  { id: "3", name: "Pedro Lima", email: "pedro@provedor.com.br", role: "viewer", status: "inativo", created_at: "2024-06-10" },
];

export default function ContasAcesso() {
  const { ispNome } = useActiveIsp();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "operador" | "viewer">("operador");

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingAccount(null);
    setFormName("");
    setFormEmail("");
    setFormRole("operador");
    setDialogOpen(true);
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormName(account.name);
    setFormEmail(account.email);
    setFormRole(account.role);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    if (editingAccount) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id ? { ...a, name: formName, email: formEmail, role: formRole } : a
        )
      );
      toast({ title: "Conta atualizada", description: `${formName} foi atualizado com sucesso.` });
    } else {
      const newAccount: Account = {
        id: crypto.randomUUID(),
        name: formName,
        email: formEmail,
        role: formRole,
        status: "ativo",
        created_at: new Date().toISOString().split("T")[0],
      };
      setAccounts((prev) => [newAccount, ...prev]);
      toast({ title: "Conta criada", description: `${formName} foi adicionado com sucesso.` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!accountToDelete) return;
    setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));
    toast({ title: "Conta removida", description: `${accountToDelete.name} foi removido.` });
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const toggleStatus = (account: Account) => {
    const newStatus = account.status === "ativo" ? "inativo" : "ativo";
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status: newStatus } : a)));
    toast({
      title: newStatus === "ativo" ? "Conta ativada" : "Conta desativada",
      description: `${account.name} agora está ${newStatus}.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
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
                  Gerencie as contas de acesso dos colaboradores do seu provedor
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {ispNome}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 max-w-4xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total de contas", value: accounts.length, icon: Users },
            { label: "Ativas", value: accounts.filter((a) => a.status === "ativo").length, icon: ShieldCheck },
            { label: "Administradores", value: accounts.filter((a) => a.role === "admin").length, icon: KeyRound },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Colaboradores</CardTitle>
                <CardDescription>Todas as contas vinculadas ao seu provedor.</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nova conta
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhuma conta encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => {
                    const roleInfo = ROLE_LABELS[account.role];
                    const statusInfo = STATUS_LABELS[account.status];
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            {account.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{account.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] border ${roleInfo.color}`}>
                            {roleInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{account.created_at}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(account)}>
                                <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                {account.status === "ativo" ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setAccountToDelete(account);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir
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
          </CardContent>
        </Card>
      </main>

      {/* Dialog Criar / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar conta" : "Nova conta de acesso"}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Atualize os dados desta conta."
                : "Crie uma nova conta para um colaborador do seu provedor."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <User className="h-3.5 w-3.5" />
                Nome completo
              </Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do colaborador" className="h-9" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <Mail className="h-3.5 w-3.5" />
                E-mail
              </Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@provedor.com.br" className="h-9" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Perfil de acesso
              </Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingAccount ? "Salvar alterações" : "Criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmação de exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a conta de <strong>{accountToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
