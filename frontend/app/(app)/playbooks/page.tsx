"use client";

import { Suspense } from "react";

import { PlaybooksWorkspace } from "@/components/playbooks/PlaybooksWorkspace";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PlaybooksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-64 rounded-[12px]" />
        </div>
      }
    >
      <PlaybooksWorkspace />
    </Suspense>
  );
}
