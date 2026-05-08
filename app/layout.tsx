import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SG-SST-IA (Analítica Predictiva)",
  description: "Software SG-SST-IA para inspecciones, formación y plan de trabajo anual con analítica predictiva y alertas preventivas.",
  openGraph: {
    title: "SG-SST-IA (Analítica Predictiva)",
    description: "Software SG-SST-IA para inspecciones, formación y plan de trabajo anual con analítica predictiva y alertas preventivas.",
    siteName: "Automatización Avanzada S.A.S",
    images: [
      {
        url: "/img/sg-sst-ia-logo.svg",
        width: 1200,
        height: 630,
        alt: "SG-SST-IA (Analítica Predictiva)",
      },
    ],
    type: "website",
    locale: "es",
  },
  twitter: {
    card: "summary_large_image",
    title: "SG-SST-IA (Analítica Predictiva)",
    description: "Software SG-SST-IA para inspecciones, formación y plan de trabajo anual con analítica predictiva y alertas preventivas.",
    images: ["/img/sg-sst-ia-logo.svg"],
  },
  icons: {
    icon: "/img/favicon.ico",
    shortcut: "/img/favicon.ico",
    apple: "/img/sg-sst-ia-mark.svg",
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
