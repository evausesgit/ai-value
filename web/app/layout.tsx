import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "./Nav";
import { SessionProvider } from "@/lib/session";

const inter = Inter({ subsets: ["latin"], variable: "--ff-sans", display: "swap" });

export const metadata: Metadata = {
  title: "AI Value",
  description: "Suivre l'adoption de l'IA dans les équipes : usages, connaissances, feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <SessionProvider>
          <Nav />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
