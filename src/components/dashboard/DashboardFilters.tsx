import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DashboardFiltersProps {
  periodo: string;
  status: string;
  urgencia: string;
  setor: string;
  onPeriodoChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onUrgenciaChange: (value: string) => void;
  onSetorChange: (value: string) => void;
}

export function DashboardFilters({
  periodo,
  status,
  urgencia,
  setor,
  onPeriodoChange,
  onStatusChange,
  onUrgenciaChange,
  onSetorChange,
}: DashboardFiltersProps) {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="periodo">Período</Label>
          <Select value={periodo} onValueChange={onPeriodoChange}>
            <SelectTrigger id="periodo">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="0">Hoje</SelectItem>
              <SelectItem value="1">Ontem</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger id="status">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Novo">Novo</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Resolvido">Resolvido</SelectItem>
              <SelectItem value="Fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="urgencia">Urgência</Label>
          <Select value={urgencia} onValueChange={onUrgenciaChange}>
            <SelectTrigger id="urgencia">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor">Setor</Label>
          <Select value={setor} onValueChange={onSetorChange}>
            <SelectTrigger id="setor">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Cobrança">Cobrança</SelectItem>
              <SelectItem value="Agendamento / Operacional">Agendamento / Operacional</SelectItem>
              <SelectItem value="Administração">Administração</SelectItem>
              <SelectItem value="Suporte Interno">Suporte Interno</SelectItem>
              <SelectItem value="N2 Suporte Interno">N2 Suporte Interno</SelectItem>
              <SelectItem value="Comercial">Comercial</SelectItem>
              <SelectItem value="N1 Atendimento">N1 Atendimento</SelectItem>
              <SelectItem value="Atendimento Escritorio">Atendimento Escritorio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
