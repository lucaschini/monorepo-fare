import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERP Gráfica",
  description: "Sistema Integrado de Gestão para Gráficas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
