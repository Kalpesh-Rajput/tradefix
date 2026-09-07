"use client";

import { Suspense } from "react";

import { NotebookPage } from "@/components/notebook/NotebookPage";
import { Skeleton } from "@/components/ui/Skeleton";

export default function NotebookRoute() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40 rounded-lg" />}>
      <NotebookPage />
    </Suspense>
  );
}
