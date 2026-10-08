"use client";

import { FileImportPreview } from "@/components/trades/FileImportPreview";
import { acceptsFile, type BrokerProvider } from "@/lib/brokers/provider";

export function BrokerFileImportPanel({
  provider,
  accountId,
}: {
  provider: BrokerProvider;
  accountId?: string | null;
}) {
  const accept = acceptsFile(provider);
  return (
    <FileImportPreview
      layout="panel"
      accountId={accountId}
      accept={accept}
      acceptLabel={accept}
      hint={`Upload a ${provider.display_name} export. Rows stay in preview until you confirm the import.`}
    />
  );
}
