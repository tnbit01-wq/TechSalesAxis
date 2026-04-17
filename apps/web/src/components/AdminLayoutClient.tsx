"use client";

import { useSidebar } from "@/context/SidebarContext";
import { ReactNode } from "react";

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <main className={`flex-1 ${isOpen ? "ml-64" : "ml-20"} w-full overflow-y-auto transition-all duration-300`}>
      <div className="w-full px-8 py-8">
        {children}
      </div>
    </main>
  );
}
