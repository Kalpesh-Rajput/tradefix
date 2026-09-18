"use client";

import { Suspense } from "react";

import { DayViewPage } from "@/components/dayview/DayViewPage";

export default function DayPage() {
  return (
    <Suspense fallback={null}>
      <DayViewPage />
    </Suspense>
  );
}
