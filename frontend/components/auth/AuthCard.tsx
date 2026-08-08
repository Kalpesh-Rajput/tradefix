"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";

import { useAuth } from "@/components/providers/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { isGoogleConfigured, requestGoogleIdToken } from "@/lib/google";

type AuthMode = "login" | "signup";

interface AuthCardProps {
  mode: AuthMode;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function AuthCard({ mode }: AuthCardProps) {
  const { login, signup, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignup = mode === "signup";
  const googleReady = isGoogleConfigured();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    if (!googleReady) {
      setError("Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your env.");
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      const idToken = await requestGoogleIdToken();
      await loginWithGoogle(idToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border bg-surface/95 p-8 shadow-[0_24px_80px_-32px_hsl(var(--primary)/0.45)] backdrop-blur-sm"
    >
      <motion.div
        className="mb-6 flex justify-center"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 220, damping: 18 }}
      >
        <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
          <Logo size={72} />
        </motion.div>
      </motion.div>

      <motion.h1
        className="text-center text-2xl font-semibold tracking-tight text-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
      >
        {isSignup ? "Create account" : "Sign in"}
      </motion.h1>
      <motion.p
        className="mt-1.5 text-center text-sm text-zinc-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {isSignup ? "Start your trading journal free." : "Journal smarter. Trade better."}
      </motion.p>

      <motion.button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading || submitting}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          "mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors",
          "hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <GoogleIcon />
        {googleLoading ? "Connecting..." : isSignup ? "Sign up with Google" : "Sign in with Google"}
      </motion.button>

      {!googleReady && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Set <span className="font-mono text-zinc-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> to enable Google.
        </p>
      )}

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {isSignup && (
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoComplete="name"
            disabled={submitting || googleLoading}
          />
        )}
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          disabled={submitting || googleLoading}
        />
        <Input
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          disabled={submitting || googleLoading}
        />

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={submitting || googleLoading}>
          {submitting
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:opacity-90">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:opacity-90">
              Sign up
            </Link>
          </>
        )}
      </p>
    </motion.div>
  );
}
