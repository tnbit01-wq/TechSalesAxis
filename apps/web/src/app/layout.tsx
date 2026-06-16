import "./globals.css";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import GlobalChatInterface from "@/components/GlobalChatInterface";

export const metadata = {
  title: "TechSales Axis",
  description: "AI-Powered Intelligent Sales & Recruitment Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalChatInterface />
        <Toaster position="bottom-right" closeButton richColors toastOptions={{ style: { borderRadius: "16px", fontSize: "13px" } }} />
      </body>
    </html>
  );
}
