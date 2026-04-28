import "./globals.css";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import GlobalChatInterface from "@/components/GlobalChatInterface";
import CSSReloadOnNavigation from "@/components/CSSReloadOnNavigation";

export const metadata = {
  title: "TechSales Axis",
  description: "AI-Powered Intelligent Sales & Recruitment Platform",
};

// Disable cache for dynamic auth pages to ensure CSS is always applied
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Revalidate on every request

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Prevent CSS from being cached on browser back */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Force CSS reload on every page visit */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <CSSReloadOnNavigation />
        {children}
        <GlobalChatInterface />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
