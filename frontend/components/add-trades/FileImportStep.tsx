"use client";

import { FileImportPreview } from "@/components/trades/FileImportPreview";

const ACCEPT = ".csv,.xlsx,.xml,.htm,.html";

interface FileImportStepProps {
  accountId: string;
  accountLabel: string;
  isDemo: boolean;
  onImported: () => void;
}

export function FileImportStep({ accountId, accountLabel, isDemo, onImported }: FileImportStepProps) {
  return (
    <FileImportPreview
      layout="step"
      accountId={accountId}
      accountLabel={accountLabel}
      isDemo={isDemo}
      accept={ACCEPT}
      acceptLabel="CSV, XLSX, or XML"
      onImported={onImported}
    />
  );
}
