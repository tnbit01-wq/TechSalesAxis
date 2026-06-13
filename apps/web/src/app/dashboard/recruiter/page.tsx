"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { Briefcase, Users, Building2, Zap, Target, UserCheck, MessageSquare, ArrowRight, Plus, MapPin, CheckCircle, Eye, TrendingUp, ChevronRight, Sparkles, Award, FileText } from "lucide-react";
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

  if (loading) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]"><div className="flex flex-col items-center gap-3"><div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" /><p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading…</p></div></div>;
  if (!profile) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]"><div className="text-center"><p className="text-sm text-slate-600 mb-4">Could not load dashboard</p><button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#FF8A00] text-white rounded-xl text-[13px] font-semibold">Retry</button></div></div>;

  const companyScore = profile.companies?.profile_score ?? 0;
  const totalApps = stats?.pending_applications_count ?? 0;
  const funnel = stats?.funnel_data || { applied: totalApps, shortlisted: 0, interviewed: 0, offered: 0, hired: 0 };
  const conversionRate = totalApps > 0 ? (((funnel.hired || stats?.total_hires_count || 0) / totalApps) * 100).toFixed(1) : "0.0";

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#F8F9FC] flex flex-col p-4 md:p-6 space-y-6 overflow-y-auto">
      {/* ── TOP SECTION ── */}
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        {/* Left: 60% Width - Embedded AI Assistant Chat */}
        <div className="w-full md:w-[60%] h-[520px] flex flex-col shrink-0">
          <GlobalChatInterface isInline={true} />
        </div>

        {/* Right: 40% Width - Welcome Header & KPIs */}
        <div className="w-full md:w-[40%] flex flex-col gap-6 justify-between">
          {/* Welcome Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-5 shadow-sm text-left flex-shrink-0 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">RECRUITER WORKSPACE</p>
              <h1 className="text-xl md:text-2xl font-serif font-semibold text-white leading-tight">
                Welcome back, {userName}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                You have {totalApps} active applications pending review.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/recruiter/hiring/jobs/new">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-orange-900/10">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Create Job
                </button>
              </Link>
            </div>
          </div>

          {/* Hiring Performance & Funnel Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm p-5 flex flex-col gap-4 flex-shrink-0 text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Hiring Performance</h2>
              <span className="text-[10px] font-semibold text-[#FF8A00] bg-orange-50 px-2 py-0.5 rounded-full">Live Stats</span>
            </div>
            
            {/* 4 KPIs in mini grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">New Applicants</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{totalApps}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Active Postings</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{stats?.active_jobs_count ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Interviews</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{funnel.interviewed}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Hired Candidates</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{stats?.total_hires_count ?? funnel.hired}</span>
              </div>
            </div>

            {/* Funnel distribution chart */}
            <div className="space-y-3 pt-3.5 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-500">Pipeline Funnel</span>
                <span className="text-[10px] font-semibold text-[#FF8A00] bg-orange-50 px-2 py-0.5 rounded-full">{conversionRate}% Conversion</span>
              </div>
              
              <div className="space-y-2 text-xs">
                <FunnelBar label="Applied" count={funnel.applied} pct={100} color="from-orange-500 to-amber-500" />
                <FunnelBar label="Shortlisted" count={funnel.shortlisted} pct={funnel.applied > 0 ? Math.round((funnel.shortlisted / funnel.applied) * 100) : 0} color="from-orange-400 to-amber-400" />
                <FunnelBar label="Interviewing" count={funnel.interviewed} pct={funnel.applied > 0 ? Math.round((funnel.interviewed / funnel.applied) * 100) : 0} color="from-amber-500 to-yellow-500" />
                <FunnelBar label="Hired" count={funnel.hired} pct={funnel.applied > 0 ? Math.round((funnel.hired / funnel.applied) * 100) : 0} color="from-emerald-500 to-teal-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
        {/* Card 1: Active Job Postings */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Active Job Postings</h2>
            <Link href="/dashboard/recruiter/hiring/jobs" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-4">
                <Briefcase className="h-5 w-5 text-slate-300 mb-1" strokeWidth={1.5} />
                <p className="text-[12px] font-bold text-[#0F172A]">No active postings</p>
                <Link href="/dashboard/recruiter/hiring/jobs/new" className="text-[10px] text-[#FF8A00] hover:underline mt-1">Create one</Link>
              </div>
            ) : jobs.map((job, i) => (
              <div key={job.id} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] transition-all group rounded-xl ${i < jobs.length - 1 ? "border-b border-slate-100/60" : ""}`}>
                <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`} className="flex-1 min-w-0">
                  <h3 className="text-[11.5px] font-semibold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">{job.location || "Remote"} · {job.job_type || "Full-time"}</p>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right"><p className="text-[13px] font-bold text-[#0F172A]">{jobAppCounts[job.id] ?? 0}</p></div>
                  <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`}>
                    <span className="px-2 py-1 bg-slate-100 hover:bg-slate-200/80 text-[#0F172A] text-[9.5px] font-semibold rounded-md transition-colors">Manage</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Recent Applications Queue */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Recent Applications</h2>
            <Link href="/dashboard/recruiter/hiring/applications" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {applications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                <Users className="h-5 w-5 text-slate-350 mb-1" strokeWidth={1.5} />
                <p className="text-[12px] font-bold text-[#0F172A]">No applications yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Pending applications show up here.</p>
              </div>
            ) : applications.slice(0, 4).map((app, i) => (
              <div key={app.id || i} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] transition-all group rounded-xl ${i < applications.length - 1 ? "border-b border-slate-100/60" : ""}`}>
                <div className="h-7 w-7 rounded-lg bg-orange-50 text-[#FF8A00] flex items-center justify-center font-bold text-[11px] shrink-0">
                  {app.candidate_name ? app.candidate_name.charAt(0).toUpperCase() : "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11.5px] font-semibold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{app.candidate_name || "Sales Candidate"}</h4>
                  <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{app.job_title || "Sales Professional"}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  app.status === 'shortlisted' ? 'text-emerald-600 bg-emerald-50 border-emerald-250/50' :
                  app.status === 'interviewing' || app.status === 'interview_scheduled' ? 'text-amber-600 bg-amber-50 border-amber-255/50' :
                  app.status === 'rejected' ? 'text-rose-650 bg-rose-50 border-rose-250/50' :
                  'text-[#FF8A00] bg-orange-50 border-orange-250/50'
                }`}>
                  {app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Applied'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Employer Brand overview */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Employer Brand</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col justify-between gap-3">
            {/* Score progress */}
            <div className="bg-[#0F172A] rounded-xl p-3.5 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8.5px] font-bold text-white/50 uppercase tracking-widest">Brand Strength</span>
                <span className="text-[14px] font-bold text-white">{companyScore}/100</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full" style={{ width: `${companyScore}%` }} />
              </div>
            </div>

            <div className="flex-grow flex flex-col gap-1.5">
              <BrandRow icon={Eye} label="Job Views" sub="All time views" value={`${stats?.total_views ?? 0}`} />
              <BrandRow icon={TrendingUp} label="Conversion Rate" sub="Apps → Hires" value={`${conversionRate}%`} />
            </div>
            {profile.completion_score < 100 && (
              <div className="flex-shrink-0 pt-2 border-t border-slate-100/80">
                <Link href="/onboarding/recruiter"><span className="text-[10px] font-bold text-[#FF8A00] hover:underline flex items-center gap-0.5">Complete assessment ({profile.completion_score}%) <ChevronRight className="h-2.5 w-2.5" /></span></Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, value, label, accent }: { icon: React.ElementType; value: number; label: string; accent: string }) {
  const c: Record<string, { bg: string; ic: string; ring: string }> = {
    blue: { bg: "bg-blue-50", ic: "text-blue-500", ring: "ring-blue-100" },
    violet: { bg: "bg-violet-50", ic: "text-violet-500", ring: "ring-violet-100" },
    emerald: { bg: "bg-emerald-50", ic: "text-emerald-500", ring: "ring-emerald-100" },
    amber: { bg: "bg-amber-50", ic: "text-amber-500", ring: "ring-amber-100" },
  };
  const s = c[accent] || c.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-3 shadow-sm flex items-center gap-3">
      <div className={`h-8.5 w-8.5 rounded-xl ${s.bg} ${s.ic} ring-1 ${s.ring} flex items-center justify-center flex-shrink-0`}><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
      <div>
        <p className="text-[18px] font-extrabold text-[#0F172A] leading-none">{value}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1 leading-none">{label}</p>
      </div>
    </div>
  );
}

function PipeStage({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  const c: Record<string, { bg: string; ic: string }> = { blue: { bg: "bg-blue-50", ic: "text-blue-500" }, amber: { bg: "bg-amber-50", ic: "text-amber-500" }, purple: { bg: "bg-purple-50", ic: "text-purple-500" }, emerald: { bg: "bg-emerald-50", ic: "text-emerald-500" } };
  const s = c[accent] || c.blue;
  return (
    <div className={`flex items-center gap-2 ${s.bg} rounded-xl px-2.5 py-1.5`}>
      <div className={`h-6 w-6 rounded-lg bg-white/80 ${s.ic} flex items-center justify-center shadow-sm flex-shrink-0`}><Icon className="h-3 w-3" strokeWidth={1.8} /></div>
      <div>
        <span className="text-[13px] font-extrabold text-[#0F172A] leading-none block">{value}</span>
        <span className="text-[8.5px] font-semibold text-slate-400 leading-none">{label}</span>
      </div>
    </div>
  );
}

function BrandRow({ icon: Icon, label, sub, value }: { icon: React.ElementType; label: string; sub: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50/70 transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" strokeWidth={1.8} />
        <div><p className="text-[11.5px] font-semibold text-[#0F172A] leading-none">{label}</p><p className="text-[8.5px] text-slate-400 mt-0.5 leading-none">{sub}</p></div>
      </div>
      <span className="text-[13px] font-bold text-[#0F172A]">{value}</span>
    </div>
  );
}

function FunnelBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10.5px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="font-bold text-[#0F172A]">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
