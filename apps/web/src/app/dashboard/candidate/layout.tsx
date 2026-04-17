"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import CandidateSidebar from "@/components/CandidateSidebar";
import CandidateHeader from "@/components/CandidateHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import CandidateLayoutClient from "@/components/CandidateLayoutClient";

export default function CandidateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    assessment_status?: string;
    profile_score?: number;
  } | null>(null);

  useEffect(() => {
    async function init() {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const statsData = await apiClient.get(
          "/candidate/stats",
          token,
        );
        setProfile(statsData);
      } catch (err) {
        console.error("Failed to load candidate stats in layout:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <CandidateSidebar
          assessmentStatus={profile?.assessment_status}
          profileScore={profile?.profile_score ?? 0}
        />
        <CandidateLayoutClient>
          <CandidateHeader />
          <main className="pt-24 p-8">{children}</main>
        </CandidateLayoutClient>
      </div>
    </SidebarProvider>
  );
}

