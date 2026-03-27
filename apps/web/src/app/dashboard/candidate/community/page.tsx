"use client";

import CommunityFeed from "@/components/CommunityFeed";

export default function CandidateCommunity() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Community</h1>
          <p className="text-slate-500 text-sm mt-1">Engage with the professional community and share insights.</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <CommunityFeed />
      </div>
    </div>
  );
}
