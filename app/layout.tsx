import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { ConfirmProvider } from "@/components/confirm";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Onfly Thought Engine",
    template: "%s · Onfly Thought Engine",
  },
  description:
    "Conteúdo de thought leadership para líderes da Onfly. Voz própria, sem freelancer, sem soar como IA.",
  // app/icon.svg + app/apple-icon.svg são detectados automaticamente
  // pelo App Router. Aqui só reforçamos pra ferramentas que olham só
  // o <head> em vez do file-system convention do Next.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#009EFB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
