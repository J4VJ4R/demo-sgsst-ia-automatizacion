import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const boltSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><path d="M38 4 14 36h16l-4 24 28-38H38z" fill="url(#g)"/></svg>`;
const boltIcon = `data:image/svg+xml,${encodeURIComponent(boltSvg)}`;

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
    icon: boltIcon,
    shortcut: boltIcon,
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
