"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <h1 className="text-center text-xl font-semibold text-white">Welcome back</h1>
      <p className="mt-1 text-center text-sm text-gray-400">Sign in to your TradeFix account</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-gold hover:text-gold-light">
          Create one
        </Link>
      </p>
    </div>
  );
}
