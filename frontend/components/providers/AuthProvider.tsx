"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, clearToken, getToken, setToken } from "@/lib/api";
import { User, UserUpdateInput } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UserUpdateInput) => Promise<User>;
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
      return;
    }
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function login(email: string, password: string) {
    const res = await api.post<{ access_token: string }>("/api/auth/login", { email, password });
    setToken(res.access_token);
    setLoading(true);
    await refreshUser();
    router.push("/today");
  }

  async function signup(email: string, password: string, name: string) {
    const res = await api.post<{ access_token: string }>("/api/auth/signup", { email, password, name });
    setToken(res.access_token);
    setLoading(true);
    await refreshUser();
    router.push("/today");
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
        logout,
        refreshUser,
        updateProfile,
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
