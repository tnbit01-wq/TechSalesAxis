"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { RecommendedJobsCard } from "./components/RecommendedJobsCard";
import { RecommendedCompaniesCard } from "./components/RecommendedCompaniesCard";
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
  Eye,
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
  profile_views_count?: number;
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

      const [resultsData, statsData, profileViewsData] = await Promise.all([
        apiClient.get("/assessment/results", token),
        apiClient.get("/candidate/stats", token),
        apiClient.get("/candidate/profile", token).then(() => ({ unique_recruiters: 0 })).catch(() => ({ unique_recruiters: 0 })),
      ]);

      setResults(resultsData);
      setStats({
        ...statsData,
        profile_views_count: profileViewsData.unique_recruiters || 0,
      });
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!isAssessmentCompleted && (
          <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-6 flex items-center justify-between backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30 flex-shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-amber-900 font-bold text-base tracking-tight">
                  Assessment Verification
                </h3>
                <p className="text-amber-800/70 text-xs font-medium mt-0.5">
                  Complete your assessment to unlock verified status and access premium placements.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/assessment/candidate")}
              className="px-5 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/20 transition active:scale-95 flex-shrink-0"
            >
              Start Now
            </button>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-100">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
            <p className="text-slate-500 text-sm font-medium">Track your career progress, applications, and opportunities in real-time.</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold transition-all border border-slate-200 hover:border-red-200"
          >
            Logout
          </button>
        </header>

        {/* Candidate Profile Score Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 mb-6 relative overflow-hidden shadow-2xl shadow-indigo-900/20 border border-white/5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -mr-48 -mt-48 opacity-40" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-600/5 rounded-full blur-[80px] -ml-36 -mb-36" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    <span className="text-[8px] font-black uppercase tracking-[0.15em] text-primary">
                      Verified
                    </span>
                  </div>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                  Profile<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
                    Strength Score
                  </span>
                </h2>
                <p className="text-slate-300 text-sm font-medium leading-relaxed max-w-md opacity-90">
                  Comprehensive ranking of your professional profile based on data quality, skills, and assessment results.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all group cursor-default">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Tier
                  </div>
                  <div className="text-2xl font-black text-white leading-none mb-1">
                    {(stats.profile_score ?? 0) >= 85
                      ? "⭐ Top"
                      : (stats.profile_score ?? 0) >= 70
                        ? "✓ Strong"
                        : "→ Growing"}
                  </div>
                  <div className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Your position
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all group cursor-default">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Complete
                  </div>
                  <div className="text-2xl font-black text-white leading-none mb-1">
                    {stats.completion_score}%
                  </div>
                  <div className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Profile filled
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative h-80 w-80 group/shield">
                <div className="absolute inset-x-0 bottom-0 top-0 m-auto h-56 w-56 bg-primary/20 rounded-full blur-3xl group-hover/shield:bg-primary/40 transition-all duration-700" />

                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center z-10 text-center">
                  <div className="bg-slate-800/80 p-12 rounded-full border border-white/10 shadow-2xl backdrop-blur-2xl group-hover/shield:scale-105 transition-transform duration-500">
                    <div className="text-6xl font-black text-white tracking-tighter leading-none mb-2">
                      {stats.profile_score ?? 0}
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">
                      Score
                    </div>
                  </div>
                </div>

                <svg
                  className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_0_30px_rgba(99,102,241,0.3)] z-20"
                  viewBox="0 0 100 100"
                >
                  <circle cx="50" cy="50" r="46" fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <circle
                    cx="50" cy="50" r="46" fill="transparent" stroke="url(#candidateGradient)" strokeWidth="6"
                    strokeDasharray="289"
                    strokeDashoffset={289 - (289 * (stats.profile_score ?? 0)) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-2000 ease-out"
                  />
                  <defs>
                    <linearGradient id="candidateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Profile Views"
            value={stats.profile_views_count?.toString() || "0"}
            sub="Recruiters this month"
            icon={Eye}
            color="indigo"
          />
          <StatCard
            label="Applications"
            value={stats.applications_count.toString()}
            sub="Jobs pursued"
            icon={Target}
            color="emerald"
          />
          <StatCard
            label="Shortlists"
            value={stats.shortlisted_count.toString()}
            sub="Recruiter interest"
            icon={Award}
            color="amber"
          />
          <StatCard
            label="Invites"
            value={stats.invites_received.toString()}
            sub="Interview calls"
            icon={Zap}
            color="purple"
          />
          <StatCard
            label="Saved Jobs"
            value={stats.saved_jobs_count?.toString() || "0"}
            sub="Bookmarked roles"
            icon={Briefcase}
            color="indigo"
          />
        </div>

        {/* Optimization & Insights Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-light rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

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
                  href="/assessment/candidate"
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

            {/* Recommended Jobs Card */}
            <RecommendedJobsCard />

            {/* Recommended Companies Card */}
            <RecommendedCompaniesCard />
          </div>

          <div className="space-y-6">
            {/* Career Trajectory Analysis */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/10 flex flex-col items-center text-center justify-between min-h-[300px] relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all duration-700 pointer-events-none" />

              <div className="space-y-4 relative z-10 w-full">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl w-fit mx-auto backdrop-blur-xl">
                  <MapIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
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
                  <Target className="h-5 w-5 text-primary" />
                  Assessment Results
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">
                  Your scores across key areas
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-primary-light text-primary rounded-lg">
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
                <div key={item.label} className="space-y-3 p-4 rounded-3xl bg-slate-50 border border-slate-100 group hover:bg-white hover:border-primary-light hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-primary shadow-sm border border-slate-100">
                      {item.icon}
                    </div>
                    <span className="text-lg font-black text-slate-900">{item.score || 0}</span>
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000" 
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
    <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-500 group ${done ? "bg-slate-50 border-slate-100 shadow-sm" : "bg-white border-slate-200 hover:border-primary-light hover:shadow-2xl hover:shadow-primary/10"}`}>
      <div className="flex items-center gap-4">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500 ${done ? "bg-emerald-100 text-emerald-600 scale-90" : "bg-slate-100 text-slate-400 group-hover:bg-primary-light group-hover:text-primary group-hover:rotate-6"}`}>
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
          <Link href={href} className="px-4 py-1.5 bg-primary-light text-[9px] font-black uppercase tracking-widest text-primary rounded-xl hover:bg-primary hover:text-white transition-all transform active:scale-90">
            Complete
          </Link>
        )
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend, color = "slate" }: { label: string; value: string; sub: string; icon?: React.ElementType; trend?: string; color?: "slate" | "indigo" | "emerald" | "amber" | "purple"; }) {
  const colorMap = {
    slate: "text-slate-500 bg-slate-50",
    indigo: "text-primary bg-primary-light",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    purple: "text-purple-600 bg-purple-50",
  };

  return (
    <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 group flex items-start gap-3">
      <div className={`p-3 rounded-lg transition-all duration-500 ${colorMap[color]} group-hover:scale-110 shadow-sm shrink-0`}>
        {Icon && <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</div>
        <div className="text-xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="text-[9px] font-medium text-slate-400 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{sub}</div>
      </div>
    </div>
  );
}

