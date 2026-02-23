import { useMemo } from "react";
import { ChurnStatus } from "@/hooks/useChurnData";
import { RiskBucket } from "@/hooks/useRiskBucketConfig";
import { WorkflowStatus, CrmWorkflowRecord } from "@/hooks/useCrmWorkflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, DollarSign, PlayCircle, CheckCircle2, XCircle,
  Phone, ThumbsDown, ThumbsUp, Minus, Tag,
} from "lucide-react";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: KanbanItem[];
}

interface KanbanItem {
  cliente: ChurnStatus;
  score: number;
  bucket: RiskBucket;
  workflow?: CrmWorkflowRecord;
  driver?: string;
}

interface KanbanBoardProps {
  clientes: ChurnStatus[];
  getScore: (c: ChurnStatus) => number;
  getBucket: (score: number) => RiskBucket;
  workflowMap: Map<number, CrmWorkflowRecord>;
  onSelectCliente: (c: ChurnStatus) => void;
  onStartTreatment: (c: ChurnStatus) => void;
  onUpdateStatus: (clienteId: number, status: WorkflowStatus) => void;
}

function getDriver(c: ChurnStatus): string {
  const scores = [
    { name: "Financeiro", val: c.score_financeiro ?? 0 },
    { name: "Suporte", val: c.score_suporte ?? 0 },
    { name: "NPS", val: c.score_nps ?? 0 },
    { name: "Qualidade", val: c.score_qualidade ?? 0 },
    { name: "Comportamental", val: c.score_comportamental ?? 0 },
  ];
  return scores.sort((a, b) => b.val - a.val)[0]?.name || "—";
}

function NPSMini({ classificacao }: { classificacao?: string | null }) {
  if (!classificacao) return null;
  const c = classificacao.toUpperCase();
  if (c === "DETRATOR") return <ThumbsDown className="h-3 w-3 text-destructive" />;
  if (c === "NEUTRO") return <Minus className="h-3 w-3 text-yellow-600" />;
  if (c === "PROMOTOR") return <ThumbsUp className="h-3 w-3 text-green-600" />;
  return null;
}

function KanbanCard({ item, onSelect, onStart, onUpdate }: {
  item: KanbanItem;
  onSelect: () => void;
  onStart: () => void;
  onUpdate: (status: WorkflowStatus) => void;
}) {
  const { cliente, score, bucket, workflow, driver } = item;
  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium truncate flex-1">{cliente.cliente_nome || `#${cliente.cliente_id}`}</span>
        <Badge className={`${BUCKET_COLORS[bucket]} border text-[10px] font-mono shrink-0`}>
          {score}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {driver && (
          <Badge variant="outline" className="text-[9px] py-0 px-1.5">{driver}</Badge>
        )}
        {cliente.valor_mensalidade != null && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            R$ {cliente.valor_mensalidade.toFixed(0)}
          </span>
        )}
        {(cliente.dias_atraso ?? 0) > 0 && (
          <span className="text-[10px] text-destructive font-medium">
            {Math.round(cliente.dias_atraso!)}d atraso
          </span>
        )}
        <NPSMini classificacao={cliente.nps_classificacao} />
        {cliente.qtd_chamados_30d > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Phone className="h-2.5 w-2.5" />{cliente.qtd_chamados_30d}
          </span>
        )}
      </div>

      {workflow?.tags && workflow.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {workflow.tags.slice(0, 3).map(t => (
            <Badge key={t} variant="secondary" className="text-[9px] py-0 px-1">{t}</Badge>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
        {!workflow && (
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" onClick={onStart}>
            <PlayCircle className="h-3 w-3" />Tratar
          </Button>
        )}
        {workflow?.status_workflow === "em_tratamento" && (
          <>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" onClick={() => onUpdate("resolvido")}>
              <CheckCircle2 className="h-3 w-3" />Resolvido
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => onUpdate("perdido")}>
              <XCircle className="h-3 w-3" />Perdido
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

export function KanbanBoard({
  clientes, getScore, getBucket, workflowMap,
  onSelectCliente, onStartTreatment, onUpdateStatus,
}: KanbanBoardProps) {
  const columns = useMemo((): KanbanColumn[] => {
    const criticos: KanbanItem[] = [];
    const alertas: KanbanItem[] = [];
    const emTratamento: KanbanItem[] = [];
    const resolvidos: KanbanItem[] = [];
    const perdidos: KanbanItem[] = [];

    clientes.forEach(c => {
      const score = getScore(c);
      const bucket = getBucket(score);
      const wf = workflowMap.get(c.cliente_id);
      const driver = getDriver(c);
      const item: KanbanItem = { cliente: c, score, bucket, workflow: wf, driver };

      // CRM status takes priority for placement
      if (wf?.status_workflow === "resolvido") {
        resolvidos.push(item);
      } else if (wf?.status_workflow === "perdido") {
        perdidos.push(item);
      } else if (wf?.status_workflow === "em_tratamento") {
        emTratamento.push(item);
      } else if (bucket === "CRÍTICO") {
        criticos.push(item);
      } else if (bucket === "ALERTA") {
        alertas.push(item);
      }
      // OK bucket clients not shown in kanban
    });

    // Sort each by score desc
    const sortByScore = (a: KanbanItem, b: KanbanItem) => b.score - a.score;
    criticos.sort(sortByScore);
    alertas.sort(sortByScore);
    emTratamento.sort(sortByScore);
    resolvidos.sort(sortByScore);
    perdidos.sort(sortByScore);

    return [
      { id: "critico", title: `Críticos (${criticos.length})`, icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "border-t-destructive", items: criticos },
      { id: "alerta", title: `Alerta (${alertas.length})`, icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "border-t-warning", items: alertas },
      { id: "tratamento", title: `Em Tratamento (${emTratamento.length})`, icon: <PlayCircle className="h-3.5 w-3.5" />, color: "border-t-primary", items: emTratamento },
      { id: "resolvido", title: `Resolvidos (${resolvidos.length})`, icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "border-t-green-500", items: resolvidos },
      { id: "perdido", title: `Perdidos (${perdidos.length})`, icon: <XCircle className="h-3.5 w-3.5" />, color: "border-t-muted-foreground", items: perdidos },
    ];
  }, [clientes, getScore, getBucket, workflowMap]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(col => (
        <div key={col.id} className={`flex-shrink-0 w-[260px] rounded-lg border border-t-4 ${col.color} bg-muted/20`}>
          <div className="p-3 border-b flex items-center gap-2">
            {col.icon}
            <span className="text-xs font-semibold">{col.title}</span>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-2 space-y-2">
              {col.items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum cliente</p>
              ) : (
                col.items.slice(0, 50).map(item => (
                  <KanbanCard
                    key={item.cliente.cliente_id}
                    item={item}
                    onSelect={() => onSelectCliente(item.cliente)}
                    onStart={() => onStartTreatment(item.cliente)}
                    onUpdate={(status) => onUpdateStatus(item.cliente.cliente_id, status)}
                  />
                ))
              )}
              {col.items.length > 50 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  +{col.items.length - 50} clientes
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
