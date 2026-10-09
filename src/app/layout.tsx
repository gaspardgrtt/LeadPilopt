import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion/motion";
import { SystemThemeListener } from "@/components/theme/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/preferences/preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LeadPilot",
    template: "%s · LeadPilot",
  },
  description:
    "L'assistant commercial qui vous dit quels dossiers relancer aujourd'hui, combien d'argent est en jeu, et prépare la relance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning : la classe `dark` est posée par le script avant l'hydratation.
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Thème appliqué avant le premier affichage (cookie + réglage du système) : pas de flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SystemThemeListener />
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
