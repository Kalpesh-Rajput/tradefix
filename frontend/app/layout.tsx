import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import { AppearanceProvider } from "@/components/providers/AppearanceProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";

import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TradeFix — AI Trading Journal",
  description:
    "TradeFix is an AI-powered trading journal that finds your time-of-day biases, streak tilts, and broken rules.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <AppearanceProvider>
                <LocaleProvider>{children}</LocaleProvider>
              </AppearanceProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
