"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/AuthProvider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.onboarding_completed_at) {
      router.replace("/today");
    }
  }, [loading, user, router]);

  if (loading || !user || user.onboarding_completed_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
