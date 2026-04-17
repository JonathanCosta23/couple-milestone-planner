import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { parseImportJSON, saveBackup, type ImportPreview } from "@/lib/storage";
import type { PlanData } from "@/lib/types";

interface UseExportImportArgs {
  data: PlanData;
  exportJSON: () => string;
  importJSON: (json: string) => void;
}

/**
 * Encapsula o fluxo de exportação/importação de JSON do plano.
 *
 * Responsabilidades:
 * - Gerar arquivo .json para download (handleExport).
 * - Ler arquivo escolhido pelo usuário, validar via parseImportJSON e abrir
 *   o ImportDialog com preview (handleFileChange).
 * - Confirmar importação criando backup automático antes de sobrescrever
 *   (handleConfirm).
 *
 * Mantém o estado do dialog e do preview encapsulado, expondo apenas o
 * necessário para o JSX consumir.
 */
export function useExportImport({ data, exportJSON, importJSON }: UseExportImportArgs) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleExport = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plano-do-milhao.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso!");
  }, [exportJSON]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const preview = parseImportJSON(result);
      setImportPreview(preview);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleConfirm = useCallback(() => {
    if (importPreview?.valid && importPreview.data) {
      saveBackup(data);
      importJSON(JSON.stringify(importPreview.data));
      toast.success("Dados importados com sucesso!");
    }
    setShowImportDialog(false);
    setImportPreview(null);
  }, [importPreview, data, importJSON]);

  const closeDialog = useCallback((open: boolean) => {
    setShowImportDialog(open);
    if (!open) setImportPreview(null);
  }, []);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    importPreview,
    showImportDialog,
    handleExport,
    handleFileChange,
    handleConfirm,
    closeDialog,
    triggerFilePicker,
  };
}
