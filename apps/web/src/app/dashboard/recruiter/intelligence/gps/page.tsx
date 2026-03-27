"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  BarChart3,
  Search,
  Zap,
  ChevronRight,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RecruiterSidebar from "@/components/RecruiterSidebar";
import LockedView from "@/components/dashboard/LockedView";

export default function CareerGPSPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isLocked = profile && (profile.companies?.profile_score ?? 0) === 0;

  useEffect(() => {
    async function loadInsights() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const [profileData, insightsData] = await Promise.all([
          apiClient.get("/recruiter/profile", token),
          apiClient.get("/recruiter/market-insights", token),
        ]);

        setProfile(profileData);
        setInsights(insightsData);
      } catch (err) {
        console.error("Failed to load GPS:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInsights();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {isLocked ? (
          <LockedView featureName="Career GPS" />
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Market <span className="text-indigo-600">Insights</span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Understand trends and opportunities in your talent market
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">Market Status</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {insights?.market_state || "OPTIMIZED"}
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">Active Candidates</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {insights?.pool_size || 0}
                  </p>
                </div>
              </div>
            </header>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Loading insights...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Talent Distribution */}
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <h2 className="text-lg font-bold text-slate-900">Talent Distribution</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Market overview by skill</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {insights?.talent_density.map((item: any) => (
                      <div key={item.skill} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-900">
                            {item.skill}
                          </span>
                          <span className="text-sm font-bold text-slate-500">
                            {item.percentage}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-700"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Competition Index */}
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-2 w-2 rounded-full bg-indigo-600" />
                      <h2 className="text-lg font-bold text-slate-900">Cross-Platform Competition</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Active openings by skill</p>
                  </div>

                  <div className="space-y-3">
                    {insights?.competition_index.map((item: any) => (
                      <div key={item.skill} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-sm font-semibold text-slate-900 flex-1">
                          {item.skill}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-600">
                            {item.active_openings} Live
                          </span>
                          {item.active_openings > 5 && (
                            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidance Protocol */}
                <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-2 w-2 rounded-full bg-slate-600" />
                      <h2 className="text-lg font-bold text-slate-900">Guidance Protocol</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">AI-powered recommendations</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-5 border border-slate-100">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-1">Active Search</h3>
                          <p className="text-xs text-slate-600">
                            High demand detected for <span className="font-semibold">{insights?.talent_density[0]?.skill}</span> assets. Consider active outreach for these skills.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-100">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-1">Engagement Strategy</h3>
                          <p className="text-xs text-slate-600">
                            Capture <span className="font-semibold">{insights?.talent_density[1]?.skill}</span> candidates immediately. Supply is limited for this role type.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push("/dashboard/recruiter/hiring/jobs/new")}
                      className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-200 active:scale-95"
                    >
                      Create New Job
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
