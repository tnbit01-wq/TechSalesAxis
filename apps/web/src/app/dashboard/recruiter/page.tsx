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
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-orange-50/10 flex flex-col p-4 md:p-6 space-y-6 overflow-y-auto">
      {/* ── TOP SECTION ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Left: 48% Width - Embedded AI Assistant Chat */}
        <div className="w-full lg:w-[48%] h-[420px] flex flex-col shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 shadow-md shadow-slate-100/50 bg-white">
          <GlobalChatInterface isInline={true} />
        </div>

        {/* Right: 52% Width - Welcome Header & Hiring Pipeline Progress */}
        <div className="w-full lg:w-[52%] h-[420px] flex flex-col gap-5 justify-between">
          {/* Welcome Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B0F19] rounded-2xl p-5 shadow-lg border border-slate-800 flex-shrink-0 flex-1 flex flex-col justify-between group transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10">
            {/* Background glowing decorations */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#FF8A00]/8 rounded-full blur-3xl -mr-6 -mt-6 group-hover:bg-[#FF8A00]/12 transition-colors duration-500"></div>
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
            
            <div className="relative z-10 flex h-full justify-between items-center gap-4">
              <div className="flex-1 flex flex-col justify-between h-full text-left">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-tight">
                    Welcome back, {userName}
                  </h1>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    You have <span className="text-orange-400 font-bold">{totalApps}</span> active applications pending review.
                  </p>
                </div>
                
                <div className="mt-4 flex gap-2.5">
                  <Link href="/dashboard/recruiter/hiring/jobs/new">
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#FF8A00] to-[#FF9F24] hover:from-[#E67A00] hover:to-[#FF8A00] text-white rounded-xl text-xs font-bold transition-all duration-205 active:scale-95 shadow-md shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20">
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Create Job Opening
                    </button>
                  </Link>
                </div>
              </div>

              {/* Circular progress bars */}
              <div className="flex gap-4 shrink-0 items-center justify-center bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 backdrop-blur-md">
                <CircularProgress value={profile.completion_score} label="Completion" color="stroke-[#FF8A00]" />
                <CircularProgress value={companyScore} label="Company Score" color="stroke-blue-500" />
              </div>
            </div>
          </div>

          {/* Redesigned Hiring Pipeline Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col gap-4 flex-shrink-0 text-left h-[225px] justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#FF8A00] animate-ping" />
                <h2 className="text-[11px] font-extrabold text-[#0F172A] uppercase tracking-wider">Hiring Pipeline Progress</h2>
              </div>
              <span className="text-[10px] font-bold text-[#FF8A00] bg-orange-50 border border-orange-100/50 px-2.5 py-0.5 rounded-full font-sans tracking-wide">
                Live Funnel
              </span>
            </div>

            {/* Stepper Pipeline */}
            <div className="relative pt-1 pb-1">
              <div className="absolute top-4 left-6 right-6 h-[2px] bg-slate-100 -z-0"></div>
              <div className="relative z-10 flex justify-between items-start">
                
                {/* Stage 1: Received Resumes */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold bg-orange-50 border-orange-200 text-[#FF8A00] shadow-sm">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">New Resumes</span>
                  <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">{totalApps} Received</span>
                </div>

                {/* Stage 2: Shortlisted */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    funnel.shortlisted > 0 
                      ? 'bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Target className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Selected</span>
                  <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                    {funnel.shortlisted} Shortlisted
                  </span>
                </div>

                {/* Stage 3: Interview */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    funnel.interviewed > 0 
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Interviews</span>
                  <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                    {funnel.interviewed} Scheduled
                  </span>
                </div>

                {/* Stage 4: Hired */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    (stats?.total_hires_count ?? funnel.hired) > 0 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Award className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Hired</span>
                  <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                    {stats?.total_hires_count ?? funnel.hired} Completed
                  </span>
                </div>

              </div>
            </div>

            {/* Funnel Metrics summary */}
            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div className="text-center bg-slate-50/50 rounded-xl py-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Active Jobs</span>
                <span className="text-[14px] font-extrabold text-[#0F172A]">{stats?.active_jobs_count ?? 0}</span>
              </div>
              <div className="text-center bg-slate-50/50 rounded-xl py-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Offer Success</span>
                <span className="text-[14px] font-extrabold text-[#0F172A]">{conversionRate}%</span>
              </div>
              <div className="text-center bg-[#FF8A00]/5 rounded-xl py-1 border border-[#FF8A00]/10">
                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider block">Shortlist Rate</span>
                <span className="text-[14px] font-extrabold text-[#FF8A00]">
                  {totalApps > 0 ? Math.round((funnel.shortlisted / totalApps) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
        {/* Card 1: Active Job Postings */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#FF8A00]" />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Active Job Postings</h2>
            </div>
            <Link href="/dashboard/recruiter/hiring/jobs" className="text-[11px] font-bold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-4 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 border border-slate-100">
                  <Briefcase className="h-5 w-5 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-bold text-[#0F172A]">No active postings</p>
                <Link href="/dashboard/recruiter/hiring/jobs/new" className="text-[10px] text-[#FF8A00] hover:underline mt-1 font-semibold">Create one</Link>
              </div>
            ) : jobs.map((job, i) => (
              <div key={job.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] border border-transparent hover:border-slate-100/80 transition-all duration-205 group rounded-xl">
                <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`} className="flex-1 min-w-0">
                  <h3 className="text-[11.5px] font-bold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 text-slate-350" /> {job.location || "Remote"} · {job.job_type || "Full-time"}
                  </p>
                </Link>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="bg-slate-100 px-2 py-0.5 rounded-md text-right min-w-[32px] border border-slate-150">
                    <p className="text-[11.5px] font-bold text-[#0F172A] leading-tight">{jobAppCounts[job.id] ?? 0}</p>
                  </div>
                  <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`}>
                    <span className="px-2.5 py-1 bg-[#0F172A] hover:bg-slate-800 text-white text-[9.5px] font-bold rounded-md transition-colors shadow-xs active:scale-95">Manage</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Recent Applications Queue */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#FF8A00]" />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Recent Applications</h2>
            </div>
            <Link href="/dashboard/recruiter/hiring/applications" className="text-[11px] font-bold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {applications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 border border-slate-100">
                  <Users className="h-5 w-5 text-slate-350" strokeWidth={1.5} />
                </div>
                <p className="text-[11.5px] font-bold text-[#0F172A]">No applications yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Pending applications show up here.</p>
              </div>
            ) : applications.slice(0, 4).map((app, i) => (
              <div key={app.id || i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] border border-transparent hover:border-slate-100/80 transition-all duration-205 group rounded-xl">
                <div className="h-8 w-8 rounded-lg bg-orange-50 text-[#FF8A00] border border-orange-100/50 flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
                  {app.candidate_name ? app.candidate_name.charAt(0).toUpperCase() : "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11.5px] font-bold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{app.candidate_name || "Sales Candidate"}</h4>
                  <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{app.job_title || "Sales Professional"}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  app.status === 'shortlisted' ? 'text-emerald-700 bg-emerald-50/50 border-emerald-100' :
                  app.status === 'interviewing' || app.status === 'interview_scheduled' ? 'text-amber-700 bg-amber-50/50 border-amber-100' :
                  app.status === 'rejected' ? 'text-rose-705 bg-rose-50/50 border-rose-100' :
                  'text-[#FF8A00] bg-orange-50/50 border-orange-100'
                }`}>
                  {app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Applied'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Company Presence Hub */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#FF8A00]" />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Company Presence Hub</h2>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 font-sans tracking-wide">
              Active Brand
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
            <div className="space-y-2.5 flex-grow flex flex-col justify-center">
              <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50/50 transition-colors border border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Candidate Profile Views</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{stats?.total_views ?? 0}</span>
              </div>
              
              <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50/50 transition-colors border border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Active Job Openings</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{stats?.active_jobs_count ?? 0}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50/50 transition-colors border border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Active Candidates</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{totalApps}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2">
              <Link href="/dashboard/recruiter/talent-pool" className="w-full">
                <button className="w-full py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[#0F172A] rounded-xl text-[10.5px] font-bold transition-all text-center">
                  Talent Pool
                </button>
              </Link>
              <Link href="/dashboard/recruiter/hiring/jobs/new" className="w-full">
                <button className="w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-[10.5px] font-bold transition-all text-center">
                  Post Job
                </button>
              </Link>
            </div>
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

function CircularProgress({ value, label, size = 52, strokeWidth = 4, color = "stroke-[#FF8A00]" }: { value: number; label: string; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="stroke-white/[0.08]"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={`${color} transition-all duration-500 ease-out`}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-white text-[10.5px] font-extrabold">
          {value}%
        </div>
      </div>
      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}
