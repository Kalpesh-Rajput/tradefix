"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMentorStudents } from "@/lib/hooks/useMentor";

export default function CoachDashboardPage() {
  const { user } = useAuth();
  const isCoach = user?.role === "coach" || (user?.plan || "") === "pro";
  const { data: students = [], isLoading, isError, refetch } = useMentorStudents({
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Coach dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Students who invited you as a mentor. Trade review is read-only for now — open their shared
          trades from comments when available.
        </p>
      </div>

      {!isCoach && students.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-400">
            You don’t have any students yet. When a trader invites your email from{" "}
            <Link href="/settings/coaching" className="text-primary hover:underline">
              Settings → Coaching
            </Link>
            , they will appear here.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Students" subtitle="Accepted mentor relationships" />
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : isError ? (
          <p className="text-sm text-zinc-400">
            Couldn’t load students.{" "}
            <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
              Retry
            </button>
          </p>
        ) : students.length === 0 ? (
          <p className="text-sm text-zinc-500">No students linked yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {s.trader_name || s.trader_email || "Trader"}
                  </p>
                  <p className="text-xs text-zinc-500">{s.trader_email}</p>
                </div>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                  {s.status} · read-only
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
