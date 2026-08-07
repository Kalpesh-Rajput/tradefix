"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy /journal/[id] → /trades/[id] */
export default function JournalTradeRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.id) router.replace(`/trades/${params.id}`);
  }, [params.id, router]);

  return <p className="text-sm text-zinc-500">Redirecting…</p>;
}
