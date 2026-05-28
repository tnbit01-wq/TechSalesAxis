"use client";
import { useSidebar } from "@/context/SidebarContext";
import { ReactNode } from "react";

export default function CandidateLayoutClient({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();
  return (
    <div className={`${isOpen ? "ml-[240px]" : "ml-[68px]"} flex-1 min-h-screen overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
      {children}
    </div>
  );
}
