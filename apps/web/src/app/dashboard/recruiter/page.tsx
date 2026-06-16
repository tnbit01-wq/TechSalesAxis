"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import LoadingScreen from "@/components/LoadingScreen";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { Briefcase, Users, Building2, Zap, Target, UserCheck, MessageSquare, ArrowRight, Plus, MapPin, CheckCircle, Eye, TrendingUp, ChevronRight, Sparkles, Award, FileText, Brain } from "lucide-react";
import GlobalChatInterface from "@/components/GlobalChatInterface";

interface Company { id: string; name: string; profile_score: number; logo_url?: string; }
interface RecruiterProfile {
  user_id: string; company_id: string; assessment_status: string; is_admin: boolean;
  completion_score: number; team_role?: string; full_name?: string; companies: Company;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [stats, setStats] = useState<{
    active_jobs_count?: number; total_views?: number; pending_applications_count?: number;
    total_hires_count?: number;
    funnel_data?: { applied: number; shortlisted: number; interviewed: number; offered: number; hired: number };
  } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const [jobAppCounts, setJobAppCounts] = useState<Record<string, number>>({});
  const [feedTab, setFeedTab] = useState<"applications" | "jobs" | "brand">("applications");

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) { router.replace("/login"); return; }
      const [p, s, j, pipeline, viewsData] = await Promise.all([
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/stats", token).catch(() => null),
        apiClient.get("/recruiter/jobs", token).catch(() => null),
        apiClient.get("/recruiter/applications/pipeline", token).catch(() => null),
        apiClient.get("/analytics/recruiter/recent-job-views", token).catch(() => null),
      ]);
      setProfile(p);
      if (p?.full_name) setUserName(p.full_name.split(" ")[0]);
      
      const viewsCount = viewsData?.total_views ?? 0;
      
      if (s) {
        setStats({
          ...s,
          total_views: viewsCount,
        });
      }

      const jobsList = Array.isArray(j) ? j : [];
      setJobs(jobsList.slice(0, 4));
      setApplications(Array.isArray(pipeline) ? pipeline : []);

      if (Array.isArray(pipeline)) {
        const counts: Record<string, number> = {};
        let applied = 0, shortlisted = 0, interviewed = 0, hired = 0;
        pipeline.forEach((app: any) => {
          const jid = app.job_id;
          if (jid) counts[jid] = (counts[jid] || 0) + 1;
          const st = (app.status || "").toLowerCase();
          if (st === "applied") applied++;
          else if (st === "shortlisted") shortlisted++;
          else if (st === "interviewing" || st === "interviewed") interviewed++;
          else if (st === "hired" || st === "closed" || st === "offered") hired++;
          else applied++;
        });
        setJobAppCounts(counts);
        if (s && !s.funnel_data) {
          setStats(prev => ({
            ...prev,
            total_views: viewsCount,
            funnel_data: { applied, shortlisted, interviewed, offered: 0, hired },
            pending_applications_count: pipeline.length,
          }));
        } else if (s) {
          setStats(prev => ({
            ...prev,
            total_views: viewsCount,
          }));
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 30000); return () => clearInterval(iv); }, [loadData]);

  if (loading) return <LoadingScreen label="Loading…" />;
  if (!profile) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]"><div className="text-center"><p className="text-sm text-slate-600 mb-4">Could not load dashboard</p><button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#FF8A00] text-white rounded-xl text-[13px] font-semibold">Retry</button></div></div>;

  const companyScore = profile.companies?.profile_score ?? 0;
  const totalApps = stats?.pending_applications_count ?? 0;
  const funnel = stats?.funnel_data || { applied: totalApps, shortlisted: 0, interviewed: 0, offered: 0, hired: 0 };
  const conversionRate = totalApps > 0 ? (((funnel.hired || stats?.total_hires_count || 0) / totalApps) * 100).toFixed(1) : "0.0";
  return (
    <div className="w-full max-w-none px-6 md:px-8 py-5 h-auto lg:h-[calc(100vh-64px)] flex flex-col lg:flex-row gap-6 overflow-hidden bg-[#FAFBFC]">
      
      {/* ── LEFT PANEL: AI ASSISTANT (Point of Attraction) ── */}
      <div className="w-full lg:w-[58%] h-full flex flex-col bg-white border border-slate-200/80 rounded-[28px] shadow-sm overflow-hidden flex-shrink-0">
        <GlobalChatInterface isInline={true} />
      </div>

      {/* ── RIGHT PANEL: ANALYTICS FEED & METRICS ── */}
      <div className="flex-1 flex flex-col gap-5 h-full overflow-hidden min-w-0">
        {/* Welcome & Stats Grid */}
        <div className="flex-shrink-0 flex flex-col gap-4">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-3xl p-5 shadow-lg border border-slate-800 text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-6 translate-y-6">
              <Brain className="h-36 w-36 text-white" />
            </div>
            <div className="relative z-10 min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-2 border border-slate-700/50">
                <Sparkles className="w-3 h-3 text-orange-400" /> Command Center
              </span>
              <h1 className="text-lg font-black text-white leading-tight tracking-tight">Welcome, {userName}</h1>
              <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed">
                You have <span className="text-white font-bold">{totalApps}</span> candidate reviews pending.
              </p>
            </div>
            <div className="relative z-10 shrink-0 self-start sm:self-center">
              <Link href="/dashboard/recruiter/hiring/jobs/new">
                <button className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-orange-500/10 active:scale-[0.97]">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Post a Job
                </button>
              </Link>
            </div>
          </div>

          {/* Compact 4 KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiItem label="New Applicants" value={totalApps} icon={Users} color="orange" />
            <KpiItem label="Active Postings" value={stats?.active_jobs_count ?? 0} icon={Briefcase} color="indigo" />
            <KpiItem label="Interviews" value={funnel.interviewed} icon={Zap} color="amber" />
            <KpiItem label="Total Hires" value={stats?.total_hires_count ?? funnel.hired} icon={Target} color="emerald" />
          </div>
        </div>

        {/* Feed & Analytics Tab Panel */}
        <div className="flex-1 bg-white border border-slate-200/80 rounded-[28px] shadow-sm flex flex-col overflow-hidden min-h-0">
          {/* Tabs Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 flex-shrink-0 bg-slate-50/20">
            <div className="flex gap-1.5">
              <FeedTabButton active={feedTab === "applications"} onClick={() => setFeedTab("applications")} label="Applicants" count={applications.length} />
              <FeedTabButton active={feedTab === "jobs"} onClick={() => setFeedTab("jobs")} label="Jobs" count={jobs.length} />
              <FeedTabButton active={feedTab === "brand"} onClick={() => setFeedTab("brand")} label="Brand Analytics" />
            </div>
          </div>

          {/* Tabs Body */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {feedTab === "applications" && (
              <div className="space-y-2.5">
                {applications.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <Users className="h-6 w-6 text-slate-350 mb-2" strokeWidth={1.5} />
                    <p className="text-xs font-bold text-slate-800">No applications yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Pending applications show up here.</p>
                  </div>
                ) : applications.slice(0, 5).map((app, i) => (
                  <div key={app.id || i} className="flex items-center gap-3 p-3 hover:bg-[#FAFBFC] transition-all group rounded-2xl border border-slate-100 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FFF3E8] to-[#FFE3BF] text-[#FF8A00] flex items-center justify-center font-bold text-[12px] shrink-0 border border-orange-100/30">
                      {app.candidate_name ? app.candidate_name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div className="flex-1 min-w-0 mr-2 text-left">
                      <h4 className="text-[12px] font-bold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{app.candidate_name || "Sales Candidate"}</h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{app.job_title || "Sales Professional"}</p>
                    </div>
                    <span className={`text-[9.5px] font-bold px-2.5 py-1 rounded-lg border shrink-0 uppercase tracking-wider ${
                      app.status === 'shortlisted' ? 'text-emerald-600 bg-emerald-50 border-emerald-150/40' :
                      app.status === 'interviewing' || app.status === 'interview_scheduled' ? 'text-amber-600 bg-amber-50 border-amber-150/40' :
                      app.status === 'rejected' ? 'text-rose-600 bg-rose-50 border-rose-150/40' :
                      'text-[#FF8A00] bg-orange-50 border-orange-150/40'
                    }`}>
                      {app.status ? app.status.replace(/_/g, " ") : 'Applied'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {feedTab === "jobs" && (
              <div className="space-y-2.5">
                {jobs.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <Briefcase className="h-6 w-6 text-slate-350 mb-2" strokeWidth={1.5} />
                    <p className="text-xs font-bold text-slate-800">No active postings</p>
                    <Link href="/dashboard/recruiter/hiring/jobs/new" className="text-[10px] text-[#FF8A00] hover:underline mt-1">Create one</Link>
                  </div>
                ) : jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3.5 hover:bg-[#FAFBFC] transition-all group rounded-2xl border border-slate-100 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
                    <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`} className="flex-1 min-w-0 mr-3 text-left">
                      <h3 className="text-[13px] font-bold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors leading-snug">{job.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                        <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3 text-slate-400" />{job.location || "Remote"}</span>
                        <span className="text-slate-300">•</span>
                        <span>{job.job_type || "Full-time"}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl min-w-[50px]">
                        <p className="text-[13px] font-black text-[#0F172A] leading-none">{jobAppCounts[job.id] ?? 0}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Apps</p>
                      </div>
                      <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`}>
                        <span className="px-3.5 py-1.5 bg-slate-50 hover:bg-[#FF8A00] hover:text-white border border-slate-200/50 hover:border-transparent text-[#0F172A] text-[10.5px] font-bold rounded-xl transition-all duration-150 active:scale-95 shadow-sm">Manage</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {feedTab === "brand" && (
              <div className="space-y-4">
                {/* Brand Strength card */}
                <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-4.5 shadow-sm border border-slate-800 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">Employer Brand Health</span>
                      <p className="text-[11px] text-slate-500 mt-1">Sourcing strength score</p>
                    </div>
                    <span className="text-[18px] font-black text-white leading-none font-mono">{companyScore}<span className="text-slate-500 text-xs font-semibold">/100</span></span>
                  </div>
                  <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF8A00] via-[#FFA233] to-[#FFBF66] rounded-full transition-all duration-700" style={{ width: `${companyScore}%` }} />
                  </div>
                </div>

                {/* Dynamic rows */}
                <div className="space-y-2.5">
                  <BrandItem icon={Eye} label="Job Views" sub="Cumulative exposure" value={`${stats?.total_views ?? 0}`} color="orange" />
                  <BrandItem icon={TrendingUp} label="Conversion Rate" sub="Applications to hires" value={`${conversionRate}%`} color="emerald" />
                  {profile.completion_score < 100 && (
                    <div className="pt-2 border-t border-slate-100 mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">Onboarding Status</span>
                      <Link href="/onboarding/recruiter">
                        <span className="text-[10px] font-bold text-[#FF8A00] hover:underline flex items-center gap-0.5">
                          Complete assessment ({profile.completion_score}%) <ChevronRight className="h-2.5 w-2.5" />
                        </span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Funnel chart inside analytics */}
                <div className="space-y-3 pt-3.5 border-t border-slate-100 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <h4 className="text-[11.5px] font-black text-slate-500 uppercase tracking-wider">Hiring Funnel Progression</h4>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">Applicant pipeline conversion</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full">{conversionRate}% Conversion</span>
                  </div>
                  
                  <div className="space-y-3 text-xs">
                    <FunnelBar label="Applied" count={funnel.applied} pct={100} color="from-[#FF8A00] to-[#FFA233]" />
                    <FunnelBar label="Shortlisted" count={funnel.shortlisted} pct={funnel.applied > 0 ? Math.round((funnel.shortlisted / funnel.applied) * 100) : 0} color="from-[#FFA233] to-[#FFB850]" />
                    <FunnelBar label="Interviewing" count={funnel.interviewed} pct={funnel.applied > 0 ? Math.round((funnel.interviewed / funnel.applied) * 100) : 0} color="from-[#FFB850] to-[#FFCE8C]" />
                    <FunnelBar label="Hired" count={funnel.hired} pct={funnel.applied > 0 ? Math.round((funnel.hired / funnel.applied) * 100) : 0} color="from-emerald-500 to-teal-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiItem({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    orange: { bg: "bg-orange-50 text-[#FF8A00] border-orange-100/60", text: "text-[#FF8A00]", border: "border-orange-100", glow: "shadow-orange-500/5" },
    indigo: { bg: "bg-indigo-50 text-indigo-600 border-indigo-100/60", text: "text-indigo-600", border: "border-indigo-100", glow: "shadow-indigo-500/5" },
    amber: { bg: "bg-amber-50 text-amber-600 border-amber-100/60", text: "text-amber-600", border: "border-amber-100", glow: "shadow-amber-500/5" },
    emerald: { bg: "bg-emerald-50 text-emerald-600 border-emerald-100/60", text: "text-emerald-600", border: "border-emerald-100", glow: "shadow-emerald-500/5" }
  };
  const c = colorMap[color] || colorMap.orange;

  return (
    <div className={`bg-white border border-slate-200/70 rounded-2xl p-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${c.glow} hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/40 transition-all duration-200 text-left`}>
      <div className={`h-9 w-9 rounded-xl ${c.bg} border flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[17px] font-black text-[#0F172A] leading-none tracking-tight">{value}</p>
        <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function FeedTabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3.5 py-2 text-xs font-bold transition-all duration-200 flex items-center gap-2 rounded-xl ${
        active 
          ? "bg-[#FFF3E8] text-[#FF8A00]" 
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
          active ? "bg-[#FF8A00] text-white" : "bg-slate-100 text-slate-500"
        } transition-all duration-200`}>
          {count}
        </span>
      )}
    </button>
  );
}

function BrandItem({ icon: Icon, label, sub, value, color }: { icon: any; label: string; sub: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    orange: "text-[#FF8A00] bg-orange-50 border-orange-100/60",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100/60",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100/60"
  };
  const col = colorMap[color] || colorMap.orange;

  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100/70 hover:bg-[#FAFBFC] hover:border-slate-200 transition-all bg-white shadow-sm shadow-slate-100/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-8.5 w-8.5 rounded-xl ${col} border flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#0F172A] leading-none">{label}</p>
          <p className="text-[9.5px] text-slate-400 mt-1.5 leading-none truncate">{sub}</p>
        </div>
      </div>
      <span className="text-[12.5px] font-black text-[#0F172A] shrink-0 font-mono leading-none">{value}</span>
    </div>
  );
}

function FunnelBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-semibold text-slate-700">
        <span className="font-medium text-slate-500">{label}</span>
        <span className="font-bold text-[#0F172A]">{count} <span className="text-slate-400 font-normal ml-0.5">({pct}%)</span></span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

