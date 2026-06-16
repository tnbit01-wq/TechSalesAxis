"use client";

import React from "react";

interface LoadingScreenProps {
  label?: string;
  className?: string;
}

export default function LoadingScreen({
  label = "Loading…",
  className = "h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]",
}: LoadingScreenProps) {
  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" />
        <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}
