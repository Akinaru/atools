import type { Metadata } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import "./globals.css";

// Rounded and heavy, like Nintendo's system fonts. No light weights.
const rounded = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  weight: ["500", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
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
    <html lang="fr" className={`${rounded.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}
