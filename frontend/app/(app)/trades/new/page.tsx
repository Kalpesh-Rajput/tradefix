"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

/** Legacy route — opens the Add Trade flow and returns to Trades. */
export default function NewTradePage() {
  const router = useRouter();
  const { openFlow } = useAddTradeModal();

  useEffect(() => {
    openFlow();
    router.replace("/trades");
  }, [openFlow, router]);

  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted">Opening Add Trade…</div>
  );
}
