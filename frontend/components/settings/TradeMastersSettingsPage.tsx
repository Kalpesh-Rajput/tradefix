"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  useCreateMaster,
  useCreatePrecheckList,
  useDeleteMaster,
  useDeletePrecheckList,
  useMasters,
  usePrecheckLists,
} from "@/lib/hooks/useMasters";
import type { MasterCategory } from "@/lib/types";

const CATEGORIES: { id: MasterCategory; label: string; hint: string }[] = [
  { id: "symbol", label: "Symbols", hint: "Saved instruments. Custom values appear next time you add a trade." },
  { id: "entry_condition", label: "Entry conditions", hint: "Breakout, FVG, session open, and your own setups." },
  { id: "exit_condition", label: "Exit conditions", hint: "Target, stop, trailing, partial, news." },
  { id: "timeframe", label: "Timeframes", hint: "Used for both analysis and entry timeframe." },
  { id: "session", label: "Sessions", hint: "Asian, London, New York, overlaps." },
  { id: "trade_type", label: "Trade types", hint: "Scalping, intraday, swing, positional." },
  { id: "mood", label: "Mood", hint: "How you felt taking the trade." },
  { id: "strategy", label: "Strategies", hint: "Playbook names assigned to trades." },
];

export function TradeMastersSettingsPage() {
  const toast = useToast();
  const { data: masters = [], isLoading } = useMasters();
  const createMaster = useCreateMaster();
  const deleteMaster = useDeleteMaster();
  const { data: lists = [] } = usePrecheckLists();
  const createList = useCreatePrecheckList();
  const deleteList = useDeletePrecheckList();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [listName, setListName] = useState("");
  const [listItems, setListItems] = useState("");

  async function addValue(category: MasterCategory) {
    const name = (drafts[category] || "").trim();
    if (!name) return;
    try {
      await createMaster.mutateAsync({ category, name });
      setDrafts((d) => ({ ...d, [category]: "" }));
      toast.success("Saved for next time");
    } catch (err) {
      toast.error("Could not add", err instanceof Error ? err.message : undefined);
    }
  }

  async function addChecklist() {
    const name = listName.trim();
    if (!name) return;
    const items = listItems
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label }));
    try {
      await createList.mutateAsync({ name, items });
      setListName("");
      setListItems("");
      toast.success("Checklist saved");
    } catch (err) {
      toast.error("Could not save checklist", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Trade masters"
        subtitle="Lists used on Add Trade. Add a custom value once and it will be suggested next time."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading masters…
        </div>
      ) : (
        <div className="space-y-5">
          {CATEGORIES.map((cat) => {
            const rows = masters.filter((m) => m.category === cat.id);
            return (
              <SettingsCard key={cat.id} title={cat.label} description={cat.hint}>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map((row) => (
                    <span
                      key={row.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1 text-xs text-white"
                    >
                      {row.name}
                      {!row.is_builtin && (
                        <button
                          type="button"
                          aria-label={`Remove ${row.name}`}
                          onClick={() => deleteMaster.mutate(row.id)}
                          className="text-zinc-500 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addValue(cat.id);
                  }}
                >
                  <SettingsInput
                    value={drafts[cat.id] || ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [cat.id]: e.target.value }))}
                    placeholder={`Add ${cat.label.toLowerCase()}…`}
                  />
                  <Button type="submit" size="sm" disabled={createMaster.isPending}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>
              </SettingsCard>
            );
          })}

          <SettingsCard
            title="Pre-checklists"
            description="Assign a checklist to a trade from the Add Trade form."
          >
            <ul className="space-y-2">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-white/10 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">{list.name}</p>
                    <p className="text-[11px] text-muted">{list.items.map((i) => i.label).join(" · ") || "No items"}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${list.name}`}
                    onClick={() => deleteList.mutate(list.id)}
                    className="text-zinc-500 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-3">
              <SettingsField label="Name">
                <SettingsInput value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Before entry" />
              </SettingsField>
              <SettingsField label="Items" hint="One item per line">
                <textarea
                  value={listItems}
                  onChange={(e) => setListItems(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                  placeholder={"Reviewed bias\nStop placed\nRisk sized"}
                />
              </SettingsField>
              <Button type="button" onClick={() => void addChecklist()} disabled={createList.isPending}>
                Save checklist
              </Button>
            </div>
          </SettingsCard>
        </div>
      )}
    </SettingsShell>
  );
}
