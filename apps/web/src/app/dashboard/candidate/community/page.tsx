"use client";

import CommunityFeed from "@/components/CommunityFeed";
import { Info } from "lucide-react";

export default function CandidateCommunity() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-5xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
              Community <span className="text-indigo-600 font-black">Feed</span>
            </h1>
            <div className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-md border border-slate-800">
              Community
            </div>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
            <Info className="h-3 w-3 text-indigo-500" />
            Engage with the professional community and share insights.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto">
        <CommunityFeed />
      </div>
    </div>
  );
}
