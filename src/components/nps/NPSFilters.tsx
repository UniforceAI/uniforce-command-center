import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NPSFiltersProps {
  periodo: string;
  tipoNPS: string;
  classificacao: string;
  onPeriodoChange: (value: string) => void;
  onTipoNPSChange: (value: string) => void;
  onClassificacaoChange: (value: string) => void;
}

export function NPSFilters({
  periodo,
  tipoNPS,
  classificacao,
  onPeriodoChange,
  onTipoNPSChange,
  onClassificacaoChange,
}: NPSFiltersProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Período
          </label>
          <Select value={periodo} onValueChange={onPeriodoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Tipo de NPS
          </label>
          <Select value={tipoNPS} onValueChange={onTipoNPSChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pos_instalacao">Pós-Instalação</SelectItem>
              <SelectItem value="pos_os">Pós-O.S</SelectItem>
              <SelectItem value="pos_atendimento">Pós-Atendimento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Classificação
          </label>
          <Select value={classificacao} onValueChange={onClassificacaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Promotor">Promotor</SelectItem>
              <SelectItem value="Neutro">Neutro</SelectItem>
              <SelectItem value="Detrator">Detrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
