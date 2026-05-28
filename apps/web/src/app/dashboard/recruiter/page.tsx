"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { Briefcase, Users, Building2, Zap, Target, UserCheck, MessageSquare, ArrowRight, Plus, MapPin, CheckCircle, Eye, TrendingUp, ChevronRight, Sparkles, Award } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const [jobAppCounts, setJobAppCounts] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) { router.replace("/login"); return; }
      const [p, s, j, pipeline] = await Promise.all([
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/stats", token).catch(() => null),
        apiClient.get("/recruiter/jobs", token).catch(() => null),
        apiClient.get("/recruiter/applications/pipeline", token).catch(() => null),
      ]);
      setProfile(p);
      if (p?.full_name) setUserName(p.full_name.split(" ")[0]);
      if (s) setStats(s);

      const jobsList = Array.isArray(j) ? j : [];
      setJobs(jobsList.slice(0, 4));

      // Build per-job application counts from pipeline data
      if (Array.isArray(pipeline)) {
        const counts: Record<string, number> = {};
        // Also build funnel data from pipeline
        let applied = 0, shortlisted = 0, interviewed = 0, hired = 0;
        pipeline.forEach((app: any) => {
          const jid = app.job_id;
          if (jid) counts[jid] = (counts[jid] || 0) + 1;
          // Funnel
          const st = (app.status || "").toLowerCase();
          if (st === "applied") applied++;
          else if (st === "shortlisted") shortlisted++;
          else if (st === "interviewing" || st === "interviewed") interviewed++;
          else if (st === "hired" || st === "closed" || st === "offered") hired++;
          else applied++; // default bucket
        });
        setJobAppCounts(counts);
        // If stats doesn't have funnel_data, create it from pipeline
        if (s && !s.funnel_data) {
          setStats(prev => ({
            ...prev,
            funnel_data: { applied, shortlisted, interviewed, offered: 0, hired },
            pending_applications_count: pipeline.length,
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
  const culturePct = Math.min(100, Math.round(companyScore * 0.7));
  const brandPct = Math.min(100, Math.round(companyScore * 1.2));
  const benefitsPct = Math.min(100, Math.round(companyScore * 1.1));

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-hidden">
      <div className="h-full p-5 flex flex-col gap-4">
        {/* ── TOP ROW: Welcome + 4 KPIs ── */}
        <div className="flex gap-4 flex-shrink-0">
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1a2744] to-[#1E293B] rounded-2xl px-6 py-4 flex items-center gap-6 min-w-[340px] shadow-[0_4px_20px_rgba(15,23,42,0.2)]">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/[0.03]" />
            <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-[#FF8A00]/10" />
            <div className="relative z-10 flex-1">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-0.5">Welcome back</p>
              <h1 className="text-lg font-bold text-white tracking-tight">{userName} 👋</h1>
              <div className="flex items-center gap-1.5 mt-0.5"><Building2 className="h-3 w-3 text-white/30" strokeWidth={1.8} /><p className="text-[11px] text-white/40 truncate">{profile.companies?.name}</p></div>
            </div>
            <div className="relative z-10">
              <Link href="/dashboard/recruiter/hiring/jobs/new"><button className="flex items-center gap-1.5 px-4 py-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-orange-900/25"><Plus className="h-3.5 w-3.5" strokeWidth={2.5} />Post Job</button></Link>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-4 gap-3">
            <KpiCard icon={Users} value={totalApps} label="New Applicants" accent="blue" />
            <KpiCard icon={Briefcase} value={stats?.active_jobs_count ?? 0} label="Active Postings" accent="violet" />
            <KpiCard icon={MessageSquare} value={funnel.interviewed} label="Interviews" accent="emerald" />
            <KpiCard icon={CheckCircle} value={stats?.total_hires_count ?? funnel.hired} label="Hired" accent="amber" />
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left — 60% — Jobs + Pipeline */}
          <div className="flex-[3] flex flex-col gap-4 min-h-0">
            {/* Active Jobs */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100/80 flex-shrink-0">
                <h2 className="text-[14px] font-bold text-[#0F172A] tracking-tight">Active Job Postings</h2>
                <Link href="/dashboard/recruiter/hiring/jobs" className="text-[12px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              <div className="flex-1 overflow-hidden">
                {jobs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex items-center justify-center mb-3"><Briefcase className="h-6 w-6 text-slate-300" strokeWidth={1.5} /></div>
                    <p className="text-[14px] font-bold text-[#0F172A]">No active postings</p>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-[280px] text-center leading-relaxed">Post your first job to start building your candidate pipeline.</p>
                    <Link href="/dashboard/recruiter/hiring/jobs/new"><button className="mt-4 px-5 py-2 bg-[#FF8A00] text-white rounded-xl text-[12px] font-semibold hover:bg-[#E67A00] transition-all shadow-sm">Create Job Post</button></Link>
                  </div>
                ) : jobs.map((job, i) => (
                  <div key={job.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFBFC] transition-all group ${i < jobs.length - 1 ? "border-b border-slate-100/70" : ""}`}>
                    <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`} className="flex-1 min-w-0 cursor-pointer">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[13px] font-semibold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider flex-shrink-0 ring-1 ${(job.status || "active") === "active" ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-slate-50 text-slate-500 ring-slate-200"}`}>{job.status || "Active"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] text-slate-400"><MapPin className="h-2.5 w-2.5" /><span>{job.location || "Remote"}</span><span className="text-slate-200">·</span><span>{job.job_type || "Full-time"}</span></div>
                    </Link>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right"><p className="text-[16px] font-bold text-[#0F172A]">{jobAppCounts[job.id] ?? 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Applicants</p></div>
                      <Link href={`/dashboard/recruiter/hiring/jobs/${job.id}/edit`}>
                        <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 text-[#0F172A] text-[11px] font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">Manage</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Pipeline — compact strip */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] px-5 py-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[13px] font-bold text-[#0F172A]">Candidate Pipeline</h2>
                <Link href="/dashboard/recruiter/hiring/applications" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <PipeStage label="Applied" value={funnel.applied} icon={Users} accent="blue" />
                <PipeStage label="Shortlisted" value={funnel.shortlisted} icon={UserCheck} accent="amber" />
                <PipeStage label="Interviewing" value={funnel.interviewed} icon={MessageSquare} accent="purple" />
                <PipeStage label="Hired" value={funnel.hired} icon={CheckCircle} accent="emerald" />
              </div>
            </div>
          </div>

          {/* Right — 40% — AI Matches + Employer Brand */}
          <div className="flex-[2] flex flex-col gap-4 min-h-0">
            {/* AI Matches */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[14px] font-bold text-[#0F172A]">AI Matches</h2>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100 px-2 py-0.5 rounded-full"><Zap className="h-2.5 w-2.5" />POWERED</span>
              </div>
              <div className="bg-gradient-to-br from-[#FFF6ED] to-[#FFF0E0] border border-orange-100/80 rounded-xl p-5 text-center">
                <div className="h-10 w-10 rounded-xl bg-white/70 border border-orange-100 flex items-center justify-center mx-auto mb-2.5 shadow-sm"><Sparkles className="h-5 w-5 text-[#FF8A00]" strokeWidth={1.5} /></div>
                <p className="text-[13px] font-bold text-[#0F172A]">Unlock AI Sourcing</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-[220px] mx-auto">Post a job and our AI will identify top talent automatically.</p>
                <Link href="/dashboard/recruiter/talent-pool">
                  <button className="mt-3 w-full py-2.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"><Users className="h-3.5 w-3.5" />Browse Talent Pool</button>
                </Link>
              </div>
            </div>

            {/* Employer Brand */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100/80 flex-shrink-0">
                <h2 className="text-[14px] font-bold text-[#0F172A] tracking-tight">Employer Brand</h2>
              </div>
              <div className="flex-1 flex flex-col p-4 gap-4">
                {/* Dark score card */}
                <div className="bg-[#0F172A] rounded-xl overflow-hidden flex-shrink-0">
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-[#FF8A00]" strokeWidth={2} />
                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-[0.1em]">Profile Score</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[28px] font-black text-white leading-none">{companyScore}</span>
                        <span className="text-[12px] font-bold text-white/25 ml-0.5">/100</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full" style={{ width: `${companyScore}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-white/[0.06]">
                    <ScoreTile label="Culture" pct={culturePct} />
                    <ScoreTile label="Brand" pct={brandPct} border />
                    <ScoreTile label="Benefits" pct={benefitsPct} />
                  </div>
                </div>
                {/* Metrics */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <BrandRow icon={Eye} label="Total Applications" sub="All time" value={`${totalApps}`} />
                  <BrandRow icon={TrendingUp} label="Conversion Rate" sub="Applications → Hires" value={`${conversionRate}%`} />
                </div>
                {profile.completion_score < 100 && (
                  <div className="flex-shrink-0 pt-3 border-t border-slate-100">
                    <Link href="/onboarding/recruiter"><span className="text-[11px] font-bold text-[#FF8A00] hover:underline flex items-center gap-0.5">Complete assessment ({profile.completion_score}%) <ChevronRight className="h-3 w-3" /></span></Link>
                  </div>
                )}
              </div>
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
    <div className="bg-white rounded-2xl border border-slate-200/60 px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all duration-200 flex flex-col justify-between">
      <div className={`h-9 w-9 rounded-xl ${s.bg} ${s.ic} ring-1 ${s.ring} flex items-center justify-center mb-2`}><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
      <p className="text-[24px] font-extrabold text-[#0F172A] leading-none tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function PipeStage({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  const c: Record<string, { bg: string; ic: string }> = { blue: { bg: "bg-blue-50", ic: "text-blue-500" }, amber: { bg: "bg-amber-50", ic: "text-amber-500" }, purple: { bg: "bg-purple-50", ic: "text-purple-500" }, emerald: { bg: "bg-emerald-50", ic: "text-emerald-500" } };
  const s = c[accent] || c.blue;
  return (
    <div className={`flex flex-col items-center gap-1 ${s.bg} rounded-xl py-2.5`}>
      <div className={`h-7 w-7 rounded-lg bg-white/70 ${s.ic} flex items-center justify-center shadow-sm`}><Icon className="h-3 w-3" strokeWidth={1.8} /></div>
      <span className="text-[17px] font-extrabold text-[#0F172A] leading-none">{value}</span>
      <span className="text-[9px] font-semibold text-slate-400">{label}</span>
    </div>
  );
}

function ScoreTile({ label, pct, border }: { label: string; pct: number; border?: boolean }) {
  return (
    <div className={`px-3 py-2.5 text-center ${border ? "border-x border-white/[0.06]" : ""}`}>
      <p className="text-[7px] font-semibold text-white/30 uppercase tracking-[0.1em] mb-1">{label}</p>
      <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden mb-1 max-w-[50px] mx-auto">
        <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] font-bold text-white/90">{pct}%</p>
    </div>
  );
}

function BrandRow({ icon: Icon, label, sub, value }: { icon: React.ElementType; label: string; sub: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50/70 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center"><Icon className="h-4 w-4 text-slate-400" strokeWidth={1.8} /></div>
        <div><p className="text-[12px] font-semibold text-[#0F172A]">{label}</p><p className="text-[9.5px] text-slate-400">{sub}</p></div>
      </div>
      <span className="text-[15px] font-bold text-[#0F172A]">{value}</span>
    </div>
  );
}
