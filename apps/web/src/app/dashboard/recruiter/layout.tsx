"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import RecruiterHeader from "@/components/RecruiterHeader";
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

  if (loading) return <LoadingScreen label="Loading Dashboard..." className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <RecruiterLayoutClient>
        <RecruiterHeader />
        <main className="w-full flex-1 min-h-0 pt-16 overflow-y-auto overflow-x-hidden">{children}</main>
      </RecruiterLayoutClient>
    </div>
  );
}
