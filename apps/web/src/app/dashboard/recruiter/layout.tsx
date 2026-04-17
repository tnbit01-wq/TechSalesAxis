"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import RecruiterSidebar from "@/components/RecruiterSidebar";
import RecruiterHeader from "@/components/RecruiterHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import RecruiterLayoutClient from "@/components/RecruiterLayoutClient";

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
        <RecruiterSidebar
          assessmentStatus={profile?.assessment_status}
          teamRole={profile?.team_role}
          profileScore={profile?.companies?.profile_score ?? 0}
        />
        <RecruiterLayoutClient>
          <RecruiterHeader />
          <main className="w-full px-8 py-8 pt-20">{children}</main>
        </RecruiterLayoutClient>
      </div>
    </SidebarProvider>
  );
}

