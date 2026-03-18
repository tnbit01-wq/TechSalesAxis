import "./globals.css";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import GlobalChatInterface from "@/components/GlobalChatInterface";

export const metadata = {
  title: "TalentFlow",
  description: "Chat-first recruitment platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalChatInterface />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
