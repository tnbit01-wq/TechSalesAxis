"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Users,
  Briefcase,
  TrendingUp,
  Award,
  Building2,
  ShieldCheck,
  Zap,
  FileText,
  Compass,
} from "lucide-react";
import HiringFunnel from "@/components/dashboard/HiringFunnel";

interface Company {
  id: string;
  name: string;
  website: string;
  location: string;
  description: string;
  profile_score: number;
  logo_url?: string;
}

interface RecruiterProfile {
  user_id: string;
  company_id: string;
  onboarding_step: string;
  assessment_status: string;
  is_admin: boolean;
  completion_score: number;
  companies: Company;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [stats, setStats] = useState<{
    active_jobs_count?: number;
    total_views?: number;
    total_applications?: number;
    conversion_rate?: number;
    shortlist_rate?: number;
    visibility_tier?: string;
    funnel_data?: {
      applied: number;
      shortlisted: number;
      interviewed: number;
      offered: number;
      hired: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await awsAuth.logout();
    router.replace("/login");
  };

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const [profileData, statsData] = await Promise.all([
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/stats", token),
      ]);

      setProfile(profileData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error("Failed to load recruiter dashboard data:", err);
      setError("Failed to sync dashboard signals");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();

    // Replaced real-time with polling every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-xl max-w-sm text-center">
          <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-tight">
            Sync Offline
          </h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            {error || "Server disconnected"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  const isAssessmentCompleted =
    profile?.assessment_status === "completed" ||
    (profile?.companies?.profile_score ?? 0) > 0;

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
                  Incomplete Profile
                </h3>
                <p className="text-amber-800/70 text-sm font-medium">
                  Complete your assessment to find top matching candidates
                  and access the verified talent pool.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/onboarding/recruiter")}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition shadow-lg shadow-amber-600/10 active:scale-95"
            >
              Complete Now
            </button>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Recruiter <span className="text-indigo-600">Overview</span>
              </h1>
              <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-200">
                Admin
              </div>
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              {profile?.companies?.name || "TechSales Axis Partner"} &bull; Real-time
              updates
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                System Status
              </span>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                OPERATIONAL
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-xl text-xs font-bold transition-all border border-slate-200"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Company Profile Score Card - Premium Version */}
        <div className="bg-slate-900 rounded-4xl p-10 md:p-12 mb-10 relative overflow-hidden group shadow-2xl shadow-indigo-900/20 border border-white/5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/20 transition-all duration-1000" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-600/5 rounded-full blur-[80px] -ml-36 -mb-36" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
                      Profile Analysis
                    </span>
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
                  Company{" "}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-purple-400">
                    Trust score
                  </span>
                </h2>
                <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-md opacity-80">
                  Your trust score is based on company verification, culture details, and job quality.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                    Ranking
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black text-white leading-none">
                      {(profile?.companies?.profile_score ?? 0) >= 85
                        ? "Elite"
                        : (profile?.companies?.profile_score ?? 0) >= 70
                          ? "Prime"
                          : "Growth"}
                    </div>
                  </div>
                  <div className="mt-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Based on profile quality
                  </div>
                </div>
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                    Completion
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black text-white leading-none">
                      {profile?.completion_score}%
                    </div>
                  </div>
                  <div className="mt-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    Data transparency
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative h-64 w-64 md:h-72 md:w-72 group/shield">
                {/* Visual Glow */}
                <div className="absolute inset-x-0 bottom-0 top-0 m-auto h-48 w-48 bg-indigo-600/20 rounded-full blur-3xl group-hover/shield:bg-indigo-500/30 transition-all duration-700" />

                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center z-10 text-center">
                  <div className="bg-slate-800/60 p-10 rounded-full border border-white/10 shadow-3xl backdrop-blur-2xl group-hover/shield:scale-105 transition-transform duration-500">
                    <div className="text-5xl font-black text-white tracking-tighter leading-none mb-1">
                      {profile?.companies?.profile_score ?? 0}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
                      Trust Index
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Circular Progress SVG */}
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_0_25px_rgba(99,102,241,0.4)] z-20"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="transparent"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="transparent"
                    stroke="url(#shieldGradient)"
                    strokeWidth="5"
                    strokeDasharray="289"
                    strokeDashoffset={
                      289 -
                      (289 * (profile?.companies?.profile_score ?? 0)) / 100
                    }
                    strokeLinecap="round"
                    className="transition-all duration-2000 ease-out"
                  />
                  <defs>
                    <linearGradient
                      id="shieldGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Metric Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Jobs"
            value={stats?.active_jobs_count?.toString() || "0"}
            sub="Openings"
            icon={Briefcase}
            trend="+2 this week"
          />
          <StatCard
            label="Talent Reach"
            value={stats?.total_views?.toLocaleString() || "0"}
            sub="Viewed by candidates"
            icon={Users}
            color="indigo"
          />
          <StatCard
            label="Success Rate"
            value={`${stats?.conversion_rate || 0}%`}
            sub="Hiring efficiency"
            icon={Zap}
            color="amber"
          />
          <StatCard
            label="Visibility Score"
            value={stats?.visibility_tier || "Growth"}
            sub="Search ranking"
            icon={Award}
            color="emerald"
          />
        </div>

        {/* Analytics & Roadmap Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    Hiring Progress
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">
                    Real-time candidate pipeline
                  </p>
                </div>
                <div className="px-3 py-1 bg-slate-900/5 border border-slate-100 rounded-lg">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Auto-Sync Active
                  </span>
                </div>
              </div>

              <HiringFunnel
                data={
                  stats?.funnel_data || {
                    applied: stats?.total_applications || 0,
                    shortlisted: 0,
                    interviewed: 0,
                    offered: 0,
                    hired: 0,
                  }
                }
              />
            </div>

            {/* Optimization Hub - Integrated Below Momentum */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

              <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Next Steps
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Critical tasks to improve your profile.
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <div className="flex flex-col items-end">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      Profile Strength
                    </div>
                    <div className="text-xl font-black text-indigo-600 leading-none">
                      {profile?.completion_score}%
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <CompletionItem
                  label="Company Branding"
                  done={!!profile?.companies?.logo_url}
                  href="/dashboard/recruiter/organization/branding"
                  icon={<Building2 className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Team Setup"
                  done={profile?.is_admin || false}
                  href="/dashboard/recruiter/organization/team"
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Culture Audit"
                  done={profile?.assessment_status === "completed"}
                  href="/onboarding/recruiter"
                  icon={<Zap className="h-3.5 w-3.5" />}
                />
                <CompletionItem
                  label="Job Postings"
                  done={(stats?.active_jobs_count || 0) > 0}
                  href="/dashboard/recruiter/hiring/jobs/new"
                  icon={<FileText className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* AI Insights / Market Position */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/10 flex flex-col items-center text-center justify-between min-h-[300px] relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all duration-700 pointer-events-none" />

              <div className="space-y-4 relative z-10 w-full">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl w-fit mx-auto backdrop-blur-xl">
                  <Compass className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
                    Market Insights
                  </div>
                  <h3 className="text-xl font-black tracking-tighter leading-tight">
                    Market Standing
                  </h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-medium opacity-80 px-4">
                    Your quality index is higher than <span className="text-white font-bold">{profile?.companies?.profile_score}%</span> of other companies.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 mt-4 border-t border-white/5 relative z-10 w-full">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                    Visibility
                  </span>
                  <span className="text-[10px] font-black text-white italic tracking-widest leading-none">
                    {stats?.visibility_tier?.toUpperCase() || "GROWTH"}
                  </span>
                </div>
                <button 
                  onClick={() => router.push("/dashboard/recruiter/intelligence/gps")}
                  className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Deep Insights
                </button>
              </div>
            </div>

            {/* Tiers Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1">
              <div className="h-full flex flex-col">
                <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4 shrink-0">
                  <Award className="h-4 w-4" />
                </div>
                <h4 className="text-[13px] font-black text-slate-900 tracking-tight mb-3 shrink-0">
                  Quick Tier Guide
                </h4>
                <div className="flex-1 flex flex-col justify-around gap-2">
                  {[
                    { l: "Elite", d: "Premium visibility", c: "bg-emerald-400" },
                    { l: "Prime", d: "Brand strength", c: "bg-indigo-400" },
                    { l: "Growth", d: "Building signals", c: "bg-slate-300" }
                  ].map(t => (
                    <div key={t.l} className="flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${t.c}`} />
                        <span className="text-[10px] font-bold text-slate-700 truncate">{t.l}</span>
                      </div>
                      <span className="text-[9px] font-medium text-slate-400">{t.d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionItem({
  label,
  done,
  href,
  icon,
}: {
  label: string;
  done: boolean;
  href?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-500 group ${done ? "bg-slate-50 border-slate-100 shadow-sm" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10"}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500 ${done ? "bg-emerald-100 text-emerald-600 scale-90" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:rotate-6"}`}
        >
          {icon}
        </div>
        <span
          className={`text-xs font-bold tracking-tight transition-colors ${done ? "text-slate-400" : "text-slate-700 group-hover:text-slate-900"}`}
        >
          {label}
        </span>
      </div>
      {done ? (
        <div className="h-7 w-7 bg-emerald-50 rounded-full flex items-center justify-center">
          <BadgeCheck className="h-4 w-4 text-emerald-500" />
        </div>
      ) : (
        href && (
          <Link
            href={href}
            className="px-4 py-1.5 bg-indigo-50 text-[9px] font-black uppercase tracking-widest text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all transform active:scale-90"
          >
            Optimize
          </Link>
        )
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = "slate",
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ElementType;
  trend?: string;
  color?: "slate" | "indigo" | "emerald" | "amber";
}) {
  const colorMap = {
    slate: "text-slate-500 bg-slate-50",
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };

  return (
    <div className="bg-white px-6 py-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group flex items-start gap-4">
      <div
        className={`p-3 rounded-xl transition-all duration-500 ${colorMap[color]} group-hover:scale-110 shadow-sm shrink-0`}
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {label}
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tighter">
              {value}
            </div>
          </div>
          {trend && (
            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 uppercase translate-y-1">
              {trend}
            </span>
          )}
        </div>
        <div className="text-[9px] font-medium text-slate-400 mt-1 truncate opacity-70 group-hover:opacity-100 transition-opacity">
          {sub}
        </div>
      </div>
    </div>
  );
}
