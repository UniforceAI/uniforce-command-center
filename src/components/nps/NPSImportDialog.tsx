import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Download, Upload, CheckCircle, XCircle, FileSpreadsheet,
  ArrowRight, ArrowLeft, AlertTriangle, Loader2,
} from "lucide-react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useToast } from "@/hooks/use-toast";

interface NPSImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

interface ValidationResult {
  valid: number;
  invalid: number;
  errors: string[];
  rows: Record<string, any>[];
}

const REQUIRED_COLUMNS = ["nota", "data_resposta"];
const OPTIONAL_COLUMNS = ["nome", "id_cliente", "nps_type", "celular", "cpf_cnpj", "mensagem_melhoria", "classificacao_nps"];

export function NPSImportDialog({ open, onOpenChange, onSuccess }: NPSImportDialogProps) {
  const { ispId } = useActiveIsp();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; count: number } | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setValidation(null);
    setIsProcessing(false);
    setUploadResult(null);
  }, []);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const header = "nota,data_resposta,nome,id_cliente,nps_type,celular,cpf_cnpj,mensagem_melhoria,classificacao_nps";
    const example = '8,2025-01-15,João Silva,12345,contrato,11999998888,12345678901,"Bom serviço",Promotor';
    const csv = `${header}\n${example}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_nps_import.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    return lines.slice(1).map(line => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += char;
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });
  };

  const validateData = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStep(3);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const errors: string[] = [];
      const validRows: Record<string, any>[] = [];

      if (rows.length === 0) {
        errors.push("Arquivo vazio ou formato inválido.");
        setValidation({ valid: 0, invalid: 0, errors, rows: [] });
        return;
      }

      // Check required columns
      const headers = Object.keys(rows[0]);
      for (const col of REQUIRED_COLUMNS) {
        if (!headers.includes(col)) {
          errors.push(`Coluna obrigatória ausente: "${col}"`);
        }
      }

      if (errors.length > 0) {
        setValidation({ valid: 0, invalid: rows.length, errors, rows: [] });
        return;
      }

      let invalid = 0;
      rows.forEach((row, idx) => {
        const nota = parseFloat(row.nota);
        if (isNaN(nota) || nota < 0 || nota > 10) {
          errors.push(`Linha ${idx + 2}: nota "${row.nota}" inválida (0-10)`);
          invalid++;
          return;
        }
        if (!row.data_resposta || isNaN(new Date(row.data_resposta).getTime())) {
          errors.push(`Linha ${idx + 2}: data_resposta inválida`);
          invalid++;
          return;
        }

        const classif = (() => {
          if (row.classificacao_nps) return row.classificacao_nps;
          if (nota <= 6) return "Detrator";
          if (nota <= 8) return "Neutro";
          return "Promotor";
        })();

        validRows.push({
          isp_id: ispId,
          nota_numerica: nota,
          nota: String(nota),
          data_resposta: row.data_resposta,
          nome: row.nome || null,
          id_cliente: row.id_cliente ? parseInt(row.id_cliente) || null : null,
          nps_type: row.nps_type || "contrato",
          celular: row.celular || null,
          cpf_cnpj: row.cpf_cnpj || null,
          mensagem_melhoria: row.mensagem_melhoria || null,
          classificacao_nps: classif,
        });
      });

      if (errors.length > 5) {
        const remaining = errors.length - 5;
        errors.splice(5, errors.length - 5, `...e mais ${remaining} erros`);
      }

      setValidation({ valid: validRows.length, invalid, errors, rows: validRows });
    } catch (e: any) {
      setValidation({ valid: 0, invalid: 0, errors: [`Erro ao processar: ${e.message}`], rows: [] });
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadData = async () => {
    if (!validation || validation.rows.length === 0) return;
    setIsProcessing(true);
    setStep(4);

    try {
      // Insert in batches of 100
      const batches = [];
      for (let i = 0; i < validation.rows.length; i += 100) {
        batches.push(validation.rows.slice(i, i + 100));
      }

      let totalInserted = 0;
      for (const batch of batches) {
        const { error } = await externalSupabase.from("nps_check").insert(batch);
        if (error) throw error;
        totalInserted += batch.length;
      }

      setUploadResult({ success: true, count: totalInserted });
      toast({ title: "Importação concluída", description: `${totalInserted} registros importados com sucesso.` });
      onSuccess();
    } catch (e: any) {
      setUploadResult({ success: false, count: 0 });
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const stepLabels = ["Instruções", "Upload", "Validação", "Resultado"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Dados NPS
          </DialogTitle>
          <DialogDescription>
            Importe seus dados de pesquisa NPS via arquivo CSV
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i + 1 === step ? "bg-primary text-primary-foreground" :
                i + 1 < step ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1 < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[10px] hidden sm:block ${i + 1 === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < 3 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Instructions */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold">Como importar seus dados</h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Baixe o template CSV abaixo</li>
                <li>Preencha com os dados da sua pesquisa NPS</li>
                <li>Campos obrigatórios: <Badge variant="outline" className="text-[10px] ml-1">nota</Badge> <Badge variant="outline" className="text-[10px] ml-1">data_resposta</Badge></li>
                <li>Faça o upload do arquivo preenchido</li>
              </ol>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Baixar Template CSV
            </Button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              {file ? (
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">Tamanho máximo: 5MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        )}

        {/* Step 3: Validation */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {isProcessing ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Validando dados...</p>
              </div>
            ) : validation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-600">{validation.valid}</p>
                    <p className="text-xs text-muted-foreground">Válidos</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-lg font-bold text-destructive">{validation.invalid}</p>
                    <p className="text-xs text-muted-foreground">Inválidos</p>
                  </div>
                </div>
                {validation.errors.length > 0 && (
                  <div className="bg-destructive/5 rounded-lg p-3 max-h-[120px] overflow-y-auto">
                    {validation.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-destructive py-0.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && (
          <div className="flex flex-col items-center py-8 gap-4">
            {isProcessing ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Importando dados...</p>
                <Progress value={60} className="w-48" />
              </>
            ) : uploadResult ? (
              uploadResult.success ? (
                <>
                  <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Importação Concluída!</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    {uploadResult.count} registros importados com sucesso.
                    <br />Os dados já estão disponíveis no dashboard.
                  </p>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold text-destructive">Erro na Importação</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Houve um erro ao importar os dados. Verifique o arquivo e tente novamente.
                  </p>
                </>
              )
            ) : null}
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <Button onClick={() => setStep(2)}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={validateData} disabled={!file}>
              Validar Dados <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && validation && validation.valid > 0 && !isProcessing && (
            <Button onClick={uploadData}>
              Importar {validation.valid} registros <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 4 && !isProcessing && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
