import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "atools",
  description: "Mon dashboard d'outils perso",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}
