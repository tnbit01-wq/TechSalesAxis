"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  TrendingUp,
  Award,
  ShieldCheck,
  Zap,
  FileText,
  Compass,
  Target,
  User,
  Users,
  Map as MapIcon,
} from "lucide-react";

interface ComponentScores {
  skill?: number;
  behavioral?: number;
  resume?: number;
  psychometric?: number;
  reference?: number;
  [key: string]: number | undefined;
}

interface AssessmentResults {
  overall_score: number;
  component_scores: ComponentScores;
  status: string;
  completed_at?: string;
}

interface CandidateStats {
  applications_count: number;
  shortlisted_count: number;
  invites_received: number;
  posts_count: number;
  saved_jobs_count: number;
  profile_score: number | null;
  profile_strength: string;
  completion_score: number;
  assessment_status: string;
  terms_accepted: boolean;
  account_status: string;
  onboarding_step: string;
  identity_verified: boolean;
}

export default function CandidateDashboard() {
  const router = useRouter();
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const [resultsData, statsData] = await Promise.all([
        apiClient.get("/assessment/results", token),
        apiClient.get("/candidate/stats", token),
      ]);

      setResults(resultsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error("Failed to load candidate dashboard data:", err);
      setError("Failed to update dashboard");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
    
    // Real-time updates replaced by periodic sync or manual refresh
    // REDUCED FREQUENCY: Sync every 60 seconds to improve performance
    const interval = setInterval(loadData, 60000); 

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-xl max-w-sm text-center">
          <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-tight">
            Connection Error
          </h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            {error || "Unable to connect to server"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isAssessmentCompleted = stats.assessment_status === "completed";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="max-w-6xl mx-auto space-y-10">
        {!isAssessmentCompleted && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-amber-900 font-bold text-lg tracking-tight">
                  Verification Pending
                </h3>
                <p className="text-amber-800/70 text-sm font-medium">
                  Complete your assessment to unlock verified status and premium role placements.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/assessment/candidate")}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition shadow-lg shadow-amber-600/10 active:scale-95"
            >
              Complete Now
            </button>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Your profile overview and progress tracking.</p>
          </div>
        </header>

        {/* Candidate Profile Score Card */}
        <div className="bg-slate-900 rounded-4xl p-10 md:p-12 mb-10 relative overflow-hidden group shadow-2xl shadow-indigo-900/20 border border-white/5">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
                      Identity Verified
                    </span>
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
                  Your{" "}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-purple-400">
                    Profile Score
                  </span>
                </h2>
                <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-md opacity-80">
                  Your overall score based on skills, work style, and assessment results.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                    Tier
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black text-white leading-none">
                      {(stats.profile_score ?? 0) >= 85
                        ? "Top"
                        : (stats.profile_score ?? 0) >= 70
                          ? "Strong"
                          : "Growing"}
                    </div>
                  </div>
                  <div className="mt-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Your position
                  </div>
                </div>
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                    Completeness
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black text-white leading-none">
                      {stats.completion_score}%
                    </div>
                  </div>
                  <div className="mt-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Profile filled
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative h-64 w-64 md:h-72 md:w-72 group/shield">
                <div className="absolute inset-x-0 bottom-0 top-0 m-auto h-48 w-48 bg-indigo-600/20 rounded-full blur-3xl group-hover/shield:bg-indigo-500/30 transition-all duration-700" />

                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center z-10 text-center">
                  <div className="bg-slate-800/60 p-10 rounded-full border border-white/10 shadow-3xl backdrop-blur-2xl group-hover/shield:scale-105 transition-transform duration-500">
                    <div className="text-5xl font-black text-white tracking-tighter leading-none mb-1">
                      {stats.profile_score ?? 0}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
                      Profile Score
                    </div>
                  </div>
                </div>

                {/* Circular Progress SVG */}
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_0_25px_rgba(99,102,241,0.4)] z-20"
                  viewBox="0 0 100 100"
                >
                  <circle cx="50" cy="50" r="46" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                  <circle
                    cx="50" cy="50" r="46" fill="transparent" stroke="url(#candidateGradient)" strokeWidth="5"
                    strokeDasharray="289"
                    strokeDashoffset={289 - (289 * (stats.profile_score ?? 0)) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-2000 ease-out"
                  />
                  <defs>
                    <linearGradient id="candidateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Applications"
            value={stats.applications_count.toString()}
            sub="Roles pursued"
            icon={Target}
          />
          <StatCard
            label="Shortlists"
            value={stats.shortlisted_count.toString()}
            sub="Recruiter interest"
            icon={Award}
            color="indigo"
          />
          <StatCard
            label="Invites Received"
            value={stats.invites_received.toString()}
            sub="Interview invitations"
            icon={Zap}
            color="amber"
          />
          <StatCard
            label="Market Visibility"
            value={stats.account_status}
            sub="Current search state"
            icon={Compass}
            color="emerald"
          />
        </div>

        {/* Optimization & Insights Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

              <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Action Items
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Complete these tasks to improve your profile.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <CompletionItem
                  label="Profile Identity"
                  done={stats.completion_score > 70}
                  href="/dashboard/candidate/profile"
                  icon={<FileText className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Identity Verification"
                  done={stats.identity_verified ?? false}
                  href="/dashboard/candidate/settings"
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Skill Assessment"
                  done={isAssessmentCompleted}
                  href="/onboarding/candidate/assessment"
                  icon={<Zap className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Job Applications"
                  done={stats.applications_count > 0}
                  href="/dashboard/candidate/jobs"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Career Trajectory Analysis */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/10 flex flex-col items-center text-center justify-between min-h-[300px] relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all duration-700 pointer-events-none" />

              <div className="space-y-4 relative z-10 w-full">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl w-fit mx-auto backdrop-blur-xl">
                  <MapIcon className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
                    Path Insights
                  </div>
                  <h3 className="text-xl font-black tracking-tighter leading-tight">
                    Career Path
                  </h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-medium opacity-80 px-4">
                    Your profile is trending higher than <span className="text-white font-bold">{stats.profile_score}%</span> of other candidates.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 mt-4 border-t border-white/5 relative z-10 w-full">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                    Status
                  </span>
                  <span className="text-[10px] font-black text-white italic tracking-widest leading-none">
                    {stats.account_status?.toUpperCase() || "ACTIVE"}
                  </span>
                </div>
                <button
                  onClick={() => router.push("/dashboard/candidate/gps")}
                  className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  View Path
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Assessment Breakdown Section */}
        {results && (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <Target className="h-5 w-5 text-indigo-500" />
                  Assessment Results
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">
                  Your scores across key areas
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                <Zap className="h-3 w-3" />
                <span className="text-[8px] font-black uppercase tracking-widest">
                  Live Results
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { label: "Work Style", score: results.component_scores.behavioral, icon: <Users className="h-4 w-4" /> },
                { label: "Skills & Expertise", score: results.component_scores.skill, icon: <Zap className="h-4 w-4" /> },
                { label: "Personality & Fit", score: results.component_scores.psychometric, icon: <ShieldCheck className="h-4 w-4" /> },
                { label: "Resume Quality", score: results.component_scores.resume, icon: <FileText className="h-4 w-4" /> },
                { label: "Verification & References", score: results.component_scores.reference, icon: <BadgeCheck className="h-4 w-4" /> },
              ].map((item) => (
                <div key={item.label} className="space-y-3 p-4 rounded-3xl bg-slate-50 border border-slate-100 group hover:bg-white hover:border-indigo-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm border border-slate-100">
                      {item.icon}
                    </div>
                    <span className="text-lg font-black text-slate-900">{item.score || 0}</span>
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${item.score || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletionItem({ label, done, href, icon }: { label: string; done: boolean; href?: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-500 group ${done ? "bg-slate-50 border-slate-100 shadow-sm" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10"}`}>
      <div className="flex items-center gap-4">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500 ${done ? "bg-emerald-100 text-emerald-600 scale-90" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:rotate-6"}`}>
          {icon}
        </div>
        <span className={`text-xs font-bold tracking-tight transition-colors ${done ? "text-slate-400" : "text-slate-700 group-hover:text-slate-900"}`}>
          {label}
        </span>
      </div>
      {done ? (
        <div className="h-7 w-7 bg-emerald-50 rounded-full flex items-center justify-center">
          <BadgeCheck className="h-4 w-4 text-emerald-500" />
        </div>
      ) : (
        href && (
          <Link href={href} className="px-4 py-1.5 bg-indigo-50 text-[9px] font-black uppercase tracking-widest text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all transform active:scale-90">
            Complete
          </Link>
        )
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend, color = "slate" }: { label: string; value: string; sub: string; icon?: React.ElementType; trend?: string; color?: "slate" | "indigo" | "emerald" | "amber"; }) {
  const colorMap = {
    slate: "text-slate-500 bg-slate-50",
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };

  return (
    <div className="bg-white px-6 py-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group flex items-start gap-4">
      <div className={`p-3 rounded-xl transition-all duration-500 ${colorMap[color]} group-hover:scale-110 shadow-sm shrink-0`}>
        {Icon && <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</div>
            <div className="text-2xl font-black text-slate-900 tracking-tighter">{value}</div>
          </div>
        </div>
        <div className="text-[9px] font-medium text-slate-400 mt-1 truncate opacity-70 group-hover:opacity-100 transition-opacity">{sub}</div>
      </div>
    </div>
  );
}
