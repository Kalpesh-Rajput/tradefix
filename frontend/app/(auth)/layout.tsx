"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { postAuthPath } from "@/lib/onboarding";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    router.replace(postAuthPath(user));
  }, [loading, user, router]);

  if (!loading && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.14),_transparent_55%)]" />
        <motion.div
          className="absolute -left-16 top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
          animate={{ x: [0, 18, 0], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-10 bottom-16 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
          animate={{ x: [0, -14, 0], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
