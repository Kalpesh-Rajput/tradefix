"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, clearToken, getToken, setToken } from "@/lib/api";
import { postAuthPath } from "@/lib/onboarding";
import { OnboardingUpdateInput, User, UserUpdateInput } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  updateProfile: (data: UserUpdateInput) => Promise<User>;
  updateOnboarding: (data: OnboardingUpdateInput) => Promise<User>;
  completeOnboarding: () => Promise<User>;
  changePassword: (data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => Promise<void>;
  uploadAvatar: (file: File, onProgress?: (percent: number) => void) => Promise<User>;
  removeAvatar: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
      return me;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function afterAuth() {
    setLoading(true);
    const me = await refreshUser();
    router.push(postAuthPath(me));
  }

  async function login(email: string, password: string) {
    const res = await api.post<{ access_token: string }>("/api/auth/login", { email, password });
    setToken(res.access_token);
    await afterAuth();
  }

  async function signup(email: string, password: string, name: string) {
    const res = await api.post<{ access_token: string }>("/api/auth/signup", { email, password, name });
    setToken(res.access_token);
    await afterAuth();
  }

  async function loginWithGoogle(idToken: string) {
    const res = await api.post<{ access_token: string }>("/api/auth/google", { id_token: idToken });
    setToken(res.access_token);
    await afterAuth();
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push("/login");
  }

  async function updateProfile(data: UserUpdateInput) {
    const updated = await api.patch<User>("/api/auth/me", data);
    setUser(updated);
    return updated;
  }

  async function updateOnboarding(data: OnboardingUpdateInput) {
    const updated = await api.patch<User>("/api/auth/me/onboarding", data);
    setUser(updated);
    return updated;
  }

  async function completeOnboarding() {
    const updated = await api.post<User>("/api/auth/me/onboarding/complete");
    setUser(updated);
    return updated;
  }

  async function changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) {
    await api.post("/api/auth/me/password", data);
  }

  async function uploadAvatar(file: File, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append("file", file);
    const updated = await api.uploadWithProgress<User>("/api/auth/me/avatar", form, onProgress);
    setUser(updated);
    return updated;
  }

  async function removeAvatar() {
    const updated = await api.delete<User>("/api/auth/me/avatar");
    setUser(updated);
    return updated;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        loginWithGoogle,
        logout,
        refreshUser,
        updateProfile,
        updateOnboarding,
        completeOnboarding,
        changePassword,
        uploadAvatar,
        removeAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
