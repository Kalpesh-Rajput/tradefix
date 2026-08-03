"use client";

import { useParams, useRouter } from "next/navigation";

import { TradeForm } from "@/components/trades/TradeForm";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useDeleteTrade, useTrade, useUpdateTrade } from "@/lib/hooks/useTrades";
import { TradeInput } from "@/lib/types";

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: trade, isLoading } = useTrade(params.id);
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();

  async function handleSubmit(data: TradeInput) {
    if (!trade) return;
    await updateTrade.mutateAsync({ id: trade.id, data });
    router.push("/journal");
  }

  async function handleDelete() {
    if (!trade) return;
    if (!confirm("Delete this trade?")) return;
    await deleteTrade.mutateAsync(trade.id);
    router.push("/journal");
  }

  if (isLoading || !trade) {
    return <p className="text-sm text-gray-500">Loading trade…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader
          title={`Edit ${trade.symbol}`}
          action={
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          }
        />
        <TradeForm initial={trade} onSubmit={handleSubmit} submitting={updateTrade.isPending} />
      </Card>
    </div>
  );
}
