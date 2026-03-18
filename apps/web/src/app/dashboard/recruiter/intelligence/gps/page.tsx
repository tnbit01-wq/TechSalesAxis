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
    <div className="min-h-screen">
      <main className="p-12 overflow-y-auto">
        {isLocked ? (
          <LockedView featureName="Career GPS" />
        ) : (
          <>
            {/* Premium Intelligence Header */}
            <header className="mb-8 flex items-end justify-between border-b border-slate-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                    Mission Control{" "}
                    <span className="text-indigo-600 italic">GPS</span>
                  </h1>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                    Market Analysis Data • Global Access
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
                    Market Status
                  </span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase italic tracking-tighter">
                    OPTIMIZED / {insights?.market_state || "SYNC"}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-100" />
                <div className="flex flex-col items-end">
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
                    Verified Nodes
                  </span>
                  <span className="text-[10px] font-black text-slate-900 tracking-tighter">
                    {insights?.pool_size || 0}
                  </span>
                </div>
                <button
                  onClick={() =>
                    router.push("/dashboard/recruiter/hiring/jobs/new")
                  }
                  className="px-6 h-9 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                  Deploy
                </button>
              </div>
            </header>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-6">
                {/* 1. Supply Map (The Analytics Engine) */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                  <div className="bg-white rounded-4xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                          Supply Distribution Matrix
                        </h3>
                      </div>
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">
                        Live Saturation Index
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                      {insights?.talent_density.map((item: any) => (
                        <div
                          key={item.skill}
                          className="flex flex-col group gap-1"
                        >
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">
                              {item.skill}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 italic">
                              {item.percentage}%
                            </span>
                          </div>
                          <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-900 group-hover:bg-indigo-600 transition-all duration-700"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Competition Index (Capsule Horizontal) */}
                  <div className="bg-white rounded-4xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-indigo-500" />
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                          Cross-Platform Competition
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {insights?.competition_index.map((item: any) => (
                        <div
                          key={item.skill}
                          className="px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4 hover:border-indigo-200 transition-all group"
                        >
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                            {item.skill}
                          </span>
                          <div className="h-4 w-px bg-slate-200" />
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-xs font-black text-slate-900 italic leading-none">
                              {item.active_openings}
                            </span>
                            <span className="text-[7px] font-bold text-slate-300 uppercase">
                              Live
                            </span>
                          </div>
                          {item.active_openings > 5 && (
                            <div className="h-1 w-1 rounded-full bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. AI Sidebar (Guidance Command) */}
                <div className="col-span-12 lg:col-span-4">
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden h-full">
                    {/* Visual Decor */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-800/50 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

                    <div className="relative z-10 flex flex-col h-full">
                      <h3 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-12 underline decoration-white/10 underline-offset-8">
                        Guidance Protocol
                      </h3>

                      <div className="space-y-10 flex-1">
                        <div>
                          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-3">
                            System Report
                          </p>
                          <p className="text-base font-bold text-white leading-tight">
                            High demand detected for{" "}
                            <span className="text-indigo-400">
                              {insights?.talent_density[0]?.skill}
                            </span>{" "}
                            assets. Supply-demand ratio is critical.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all cursor-default group">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                                Active Search
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed font-medium">
                              Verify benchmark via{" "}
                              <span className="text-white">Sync Direct</span>{" "}
                              recommendations.
                            </p>
                          </div>

                          <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all cursor-default group">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                                Engagement
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed font-medium">
                              Capture{" "}
                              <span className="text-white">
                                {insights?.talent_density[1]?.skill}
                              </span>{" "}
                              nodes immediately.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-12">
                        <button
                          onClick={() =>
                            router.push("/dashboard/recruiter/hiring/jobs/new")
                          }
                          className="w-full py-4 bg-white text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
                        >
                          Launch Job
                        </button>
                        <p className="text-[7px] text-center text-white/30 font-bold uppercase tracking-widest mt-4">
                          Manual Override / Admin Protocol
                        </p>
                      </div>
                    </div>
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
