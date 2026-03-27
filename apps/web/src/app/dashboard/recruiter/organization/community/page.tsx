"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import CommunityFeed from "@/components/CommunityFeed";

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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Community</h1>
          <p className="text-slate-500 text-sm mt-1">Engage with professionals, share updates, and build your presence.</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <CommunityFeed />
      </div>
    </div>
  );
}
