"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import RecruiterHeader from "@/components/RecruiterHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import RecruiterLayoutClient from "@/components/RecruiterLayoutClient";
import SidePanel from "@/components/SidePanel";

export default function RecruiterDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    assessment_status?: string;
    team_role?: string;
    companies?: {
      profile_score: number;
    };
  } | null>(null);

  useEffect(() => {
    async function init() {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const profileData = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        setProfile(profileData);
      } catch (err) {
        console.error("Failed to load recruiter profile in layout:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff9800]"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
        <RecruiterLayoutClient>
          <RecruiterHeader />
          <main className="w-full flex-1 min-h-0 pt-16 overflow-y-auto overflow-x-hidden">{children}</main>
          <SidePanel role="recruiter" />
        </RecruiterLayoutClient>
      </div>
    </SidebarProvider>
  );
}

