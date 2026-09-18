"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TradingPlanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/playbooks");
  }, [router]);
  return null;
}
