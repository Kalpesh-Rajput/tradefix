"use client";

import { Suspense } from "react";

import { MyDayWorkspace } from "@/components/my-day/MyDayWorkspace";
import { Skeleton } from "@/components/ui/Skeleton";

export default function MyDayPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40 rounded-lg" />}>
      <MyDayWorkspace />
    </Suspense>
  );
}
