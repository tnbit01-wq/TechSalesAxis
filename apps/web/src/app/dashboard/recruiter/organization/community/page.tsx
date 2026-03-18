"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
// import { apiClient } from "@/lib/apiClient";
import CommunityFeed from "@/components/CommunityFeed";
import { Info } from "lucide-react";

export default function RecruiterCommunity() {
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }
    loadData();
  }, [router]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto py-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
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
            Engage with professionals, share updates, and build presence.
          </p>
        </div>
      </header>

      <div className="px-4 md:px-0">
        <CommunityFeed />
      </div>
    </div>
  );
}
