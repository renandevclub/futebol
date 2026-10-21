import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "F&V Sports — Plataforma de Futebol, Vôlei e Multi-Esportes",
  description:
    "Plataforma completa para organização de partidas e ligas de futebol, vôlei e esportes: agende partidas, controle lista de presença, sorteie times com raspadinha virtual, realize pagamentos via PIX e acompanhe o placar ao vivo.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/favicon_192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo_512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/apple-touch-icon.png" },
      {
        url: "/apple-touch-icon_180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "F&V Sports",
  },
  keywords: [
    "futebol",
    "vôlei",
    "partida de futebol",
    "partida de vôlei",
    "organizar partida",
    "sorteio de times",
    "raspadinha virtual",
    "PIX",
    "esportes",
    "F&V Sports",
  ],
  openGraph: {
    title: "F&V Sports — Plataforma de Futebol, Vôlei e Multi-Esportes",
    description:
      "Agende partidas, controle pagamentos PIX, sorteie times e acompanhe o placar em tempo real. Tudo em um só lugar.",
    type: "website",
    siteName: "F&V Sports",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#16a34a" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { Suspense } from "react";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { BottomNavBar } from "@/components/BottomNavBar";
import { ModalAccessibilityManager } from "@/components/ModalAccessibilityManager";
import { LeagueProvider } from "@/context/LeagueContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <LeagueProvider>
            <ServiceWorkerRegister />
            <PwaInstallPrompt />
            <ModalAccessibilityManager />
            <div className="min-h-dvh flex flex-col">
              {children}
            </div>
            <Suspense fallback={null}>
              <BottomNavBar />
            </Suspense>
            <Toaster position="top-right" richColors closeButton />
          </LeagueProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
