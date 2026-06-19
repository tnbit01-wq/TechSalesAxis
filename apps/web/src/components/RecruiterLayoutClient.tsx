"use client";
import { ReactNode } from "react";

export default function RecruiterLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col transition-all duration-300 ease-in-out">
      {children}
    </div>
  );
}
