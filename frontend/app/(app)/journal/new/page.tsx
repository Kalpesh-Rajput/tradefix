"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

/** Legacy route — opens the Add Trade modal and returns to the journal. */
export default function NewTradePage() {
  const router = useRouter();
  const { openModal } = useAddTradeModal();

  useEffect(() => {
    openModal("manual");
    router.replace("/journal");
  }, [openModal, router]);

  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted">Opening Add Trade…</div>
  );
}
