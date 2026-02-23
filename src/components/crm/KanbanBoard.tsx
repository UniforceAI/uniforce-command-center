import { useMemo, useState } from "react";
import { ChurnStatus } from "@/hooks/useChurnData";
import { RiskBucket } from "@/hooks/useRiskBucketConfig";
import { WorkflowStatus, CrmWorkflowRecord } from "@/hooks/useCrmWorkflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import {
  AlertTriangle, DollarSign, PlayCircle, CheckCircle2, XCircle,
  Phone, ThumbsDown, ThumbsUp, Minus,
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
  columnId: string;
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

function DroppableColumn({ id, children, title, icon, color, count }: {
  id: string;
  children: React.ReactNode;
  title: string;
  icon: React.ReactNode;
  color: string;
  count: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] min-w-[280px] rounded-lg border border-t-4 ${color} ${isOver ? "bg-primary/5 ring-2 ring-primary/30" : "bg-muted/20"} transition-colors`}
    >
      <div className="p-3 border-b flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold">{title} ({count})</span>
      </div>
      <ScrollArea className="h-[520px]">
        <div className="p-2 space-y-2">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function KanbanCard({ item, onSelect, onStart, onUpdate, isDragging }: {
  item: KanbanItem;
  onSelect: () => void;
  onStart: () => void;
  onUpdate: (status: WorkflowStatus) => void;
  isDragging?: boolean;
}) {
  const { cliente, score, bucket, workflow, driver } = item;
  return (
    <Card
      className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2 ${isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : ""}`}
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
        {cliente.valor_mensalidade != null && cliente.valor_mensalidade > 0 && (
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
        {/* Status chips */}
        {(cliente.status_internet === "CA" || cliente.status_internet === "CM" || cliente.status_internet === "B") && (
          <Badge variant="destructive" className="text-[9px] py-0 px-1">Bloqueado</Badge>
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

const COLUMN_TO_STATUS: Record<string, WorkflowStatus | null> = {
  critico: null,
  alerta: null,
  tratamento: "em_tratamento",
  resolvido: "resolvido",
  perdido: "perdido",
};

export function KanbanBoard({
  clientes, getScore, getBucket, workflowMap,
  onSelectCliente, onStartTreatment, onUpdateStatus,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allItems = useMemo((): KanbanItem[] => {
    return clientes.map(c => {
      const score = getScore(c);
      const bucket = getBucket(score);
      const wf = workflowMap.get(c.cliente_id);
      const driver = getDriver(c);

      let columnId: string;
      if (wf?.status_workflow === "resolvido") columnId = "resolvido";
      else if (wf?.status_workflow === "perdido") columnId = "perdido";
      else if (wf?.status_workflow === "em_tratamento") columnId = "tratamento";
      else if (bucket === "CRÍTICO") columnId = "critico";
      else if (bucket === "ALERTA") columnId = "alerta";
      else return null; // OK bucket not shown

      return { cliente: c, score, bucket, workflow: wf, driver, columnId };
    }).filter(Boolean) as KanbanItem[];
  }, [clientes, getScore, getBucket, workflowMap]);

  const columns = useMemo((): KanbanColumn[] => {
    const groups: Record<string, KanbanItem[]> = {
      critico: [], alerta: [], tratamento: [], resolvido: [], perdido: [],
    };
    allItems.forEach(item => {
      groups[item.columnId]?.push(item);
    });
    // Sort by score desc
    Object.values(groups).forEach(arr => arr.sort((a, b) => b.score - a.score));

    return [
      { id: "critico", title: "Críticos", icon: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />, color: "border-t-destructive", items: groups.critico },
      { id: "alerta", title: "Alerta", icon: <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />, color: "border-t-warning", items: groups.alerta },
      { id: "tratamento", title: "Em Tratamento", icon: <PlayCircle className="h-3.5 w-3.5 text-primary" />, color: "border-t-primary", items: groups.tratamento },
      { id: "resolvido", title: "Resolvidos", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />, color: "border-t-green-500", items: groups.resolvido },
      { id: "perdido", title: "Perdidos", icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />, color: "border-t-muted-foreground", items: groups.perdido },
    ];
  }, [allItems]);

  const activeItem = useMemo(() => {
    if (activeId == null) return null;
    return allItems.find(i => i.cliente.cliente_id === activeId) || null;
  }, [activeId, allItems]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const clienteId = active.id as number;
    const targetColumnId = over.id as string;
    const targetStatus = COLUMN_TO_STATUS[targetColumnId];

    // Find current item
    const item = allItems.find(i => i.cliente.cliente_id === clienteId);
    if (!item || item.columnId === targetColumnId) return;

    // If dropping on critico/alerta (no status), can't move there manually
    if (targetStatus === null) return;

    // If no workflow yet, need to start treatment first for em_tratamento
    if (!item.workflow && targetStatus === "em_tratamento") {
      onStartTreatment(item.cliente);
      return;
    }

    // Update status
    onUpdateStatus(clienteId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(col => (
          <DroppableColumn
            key={col.id}
            id={col.id}
            title={col.title}
            icon={col.icon}
            color={col.color}
            count={col.items.length}
          >
            {col.items.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum cliente</p>
            ) : (
              col.items.slice(0, 50).map(item => (
                <DraggableCard
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
          </DroppableColumn>
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="w-[260px]">
            <KanbanCard
              item={activeItem}
              onSelect={() => {}}
              onStart={() => {}}
              onUpdate={() => {}}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableCard({ item, onSelect, onStart, onUpdate }: {
  item: KanbanItem;
  onSelect: () => void;
  onStart: () => void;
  onUpdate: (status: WorkflowStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable(item.cliente.cliente_id);

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KanbanCard
        item={item}
        onSelect={onSelect}
        onStart={onStart}
        onUpdate={onUpdate}
        isDragging={isDragging}
      />
    </div>
  );
}

function useDraggable(id: number) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggableCore({ id });
  return { attributes, listeners, setNodeRef, isDragging };
}

import { useDraggable as useDraggableCore } from "@dnd-kit/core";
