"use client";

import { useSidebar } from "@/context/SidebarContext";
import { ReactNode } from "react";

export default function CandidateLayoutClient({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <div className={`flex-1 ${isOpen ? "ml-64" : "ml-20"} min-h-screen relative transition-all duration-300`}>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
