import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradeFix — AI Trading Journal",
  description:
    "TradeFix is an AI-powered trading journal that finds your time-of-day biases, streak tilts, and broken rules.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable}`}>
      <body className="bg-background font-sans text-white antialiased">
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
