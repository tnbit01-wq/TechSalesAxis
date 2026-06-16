"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Briefcase, Zap, Target, Eye, Sparkles, ArrowRight, Bookmark, Building2, FileText, ChevronRight, Inbox, TrendingUp, Award } from "lucide-react";
import GlobalChatInterface from "@/components/GlobalChatInterface";

interface CandidateStats {
  applications_count: number; shortlisted_count: number; invites_received: number;
  saved_jobs_count: number; profile_score: number | null; completion_score: number;
  assessment_status: string; identity_verified: boolean; profile_views_count?: number;
}

interface AssessmentFeedbackReport {
  overall_tier?: string;
  final_score?: number;
  score_explanation?: string;
  strengths?: string[];
  improvement_areas?: string[];
  recommendations?: string[];
  next_steps?: string[];
  visibility_impact?: string;
  generated_at?: string;
  llm_feedback?: {
    overall_summary?: string;
    category_feedback?: Record<string, { summary?: string; next_move?: string; practice?: string }>;
    [key: string]: any;
  };
}

export default function CandidateDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<AssessmentFeedbackReport | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const feedbackLoadedRef = useRef(false);

  const loadData = useCallback(async (options?: { refreshFeedback?: boolean }) => {
    try {
      const token = awsAuth.getToken();
      if (!token) { router.replace("/login"); return; }
      const shouldRefreshFeedback = Boolean(options?.refreshFeedback) || !feedbackLoadedRef.current;
      const [s, p, j] = await Promise.all([
        apiClient.get("/candidate/stats", token),
        apiClient.get("/candidate/profile", token).catch(() => null),
        apiClient.get("/candidate/recommended-jobs?limit=3", token).catch(() => null),
      ]);
      setStats(s);
      if (p?.full_name) setUserName(p.full_name.split(" ")[0]);
      setJobs((j?.data || j?.recommended_jobs || j?.recommendations || []).slice(0, 3));

      const assessmentCompleted = (s?.assessment_status || "").toLowerCase() === "completed";

      if (assessmentCompleted && shouldRefreshFeedback) {
        setFeedbackLoading(true);
        const fb = await apiClient.get("/assessment/feedback", token).catch(() => null);
        if (fb?.data) {
          setFeedback(fb.data);
          feedbackLoadedRef.current = true;
        } else if (fb && !fb.error) {
          setFeedback(fb);
          feedbackLoadedRef.current = true;
        }
        setFeedbackLoading(false);
      } else if (!assessmentCompleted) {
        feedbackLoadedRef.current = false;
        setFeedback(null);
      }
    } catch {}
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    loadData({ refreshFeedback: true });
    const iv = setInterval(() => loadData({ refreshFeedback: false }), 60000);
    return () => clearInterval(iv);
  }, [loadData]);

  if (loading) return <LoadingScreen label="Loading..." />;
  if (!stats) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]"><div className="text-center"><p className="text-sm text-slate-600 mb-4">Could not load dashboard</p><button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#FF8A00] text-white rounded-xl text-[13px] font-semibold">Retry</button></div></div>;

  const score = stats.profile_score ?? 0;
  const isVerified = stats.assessment_status === "completed";
  const tasks = [
    { label: "Profile Setup", done: stats.completion_score > 70, href: "/dashboard/candidate/profile" },
    { label: "Identity Verification", done: stats.identity_verified, href: "/dashboard/candidate/settings" },
    { label: "Skill Assessment", done: isVerified, href: "/assessment/candidate" },
    { label: "First Application", done: stats.applications_count > 0, href: "/dashboard/candidate/jobs" },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const hasApps = stats.applications_count > 0 || stats.saved_jobs_count > 0 || stats.shortlisted_count > 0 || stats.invites_received > 0;
  const expPct = Math.min(100, stats.completion_score);
  const skillPct = isVerified ? 100 : 0;
  const idPct = stats.identity_verified ? 100 : 0;

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
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">CANDIDATE PORTAL</p>
            <h1 className="text-xl md:text-2xl font-serif font-semibold text-white leading-tight">
              Welcome back, {userName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Your profile is <span className="text-white font-semibold">{stats.completion_score}%</span> complete.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/candidate/jobs">
                <button className="px-4 py-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-orange-900/10">
                  Find Jobs
                </button>
              </Link>
              <Link href="/dashboard/candidate/profile">
                <button className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] text-white/90 rounded-xl text-xs font-bold transition-all border border-white/[0.08]">
                  Edit Profile
                </button>
              </Link>
            </div>
          </div>

          {/* Career Journey & Metrics Card */}
          <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm p-5 flex flex-col gap-4 flex-shrink-0 text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Career Journey</h2>
              <span className="text-[10px] font-semibold text-[#FF8A00] bg-orange-50 px-2 py-0.5 rounded-full font-sans">Active Status</span>
            </div>

            {/* 4 KPIs in mini grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Profile Views</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{stats.profile_views_count ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Job Matches</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{jobs.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Applications</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{stats.applications_count}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Interviews</span>
                <span className="text-[17px] font-extrabold text-[#0F172A]">{stats.invites_received}</span>
              </div>
            </div>

            {/* Career readiness progress indicator */}
            <div className="space-y-3 pt-3.5 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-500">Evaluation & Profile Status</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isVerified ? 'text-emerald-600 bg-emerald-50' : 'text-[#FF8A00] bg-orange-50'}`}>
                  {isVerified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
              
              <div className="space-y-2 text-xs">
                <ProgressRow label="Profile Completion" pct={expPct} color="from-orange-500 to-amber-500" />
                <ProgressRow label="Profile Evaluation Status" pct={skillPct} color="from-emerald-500 to-teal-500" />
                <ProgressRow label="Verification Status" pct={idPct} color="from-blue-500 to-indigo-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
        {/* Card 1: Recommended Roles */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Recommended Roles</h2>
            <Link href="/dashboard/candidate/jobs" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-4 text-center">
                <Briefcase className="h-5 w-5 text-slate-300 mb-1" strokeWidth={1.5} />
                <p className="text-[11px] font-bold text-[#0F172A]">No matches yet</p>
                <Link href="/dashboard/candidate/profile" className="text-[10px] text-[#FF8A00] hover:underline mt-1">Enhance Profile</Link>
              </div>
            ) : jobs.map((job: any) => (
              <Link key={job.job_id} href="/dashboard/candidate/jobs" className="block">
                <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] transition-all group rounded-xl">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {job.company_logo_url ? <img src={job.company_logo_url} className="h-5 w-5 object-contain" alt="" /> : <Building2 className="h-3.5 w-3.5 text-slate-350" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11.5px] font-semibold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                    <p className="text-[9.5px] text-slate-400 mt-0.5 truncate">{job.company_name} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold ${(job.match_score || 0) >= 80 ? "text-emerald-600" : "text-[#FF8A00]"}`}>
                      {Math.round(job.match_score || 0)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Card 2: Assessment Feedback */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF8A00]" strokeWidth={2} />
              <h2 className="text-[13px] font-bold text-[#0F172A] tracking-tight">Assessment Feedback</h2>
            </div>
            <Link href="/assessment/candidate" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] transition-colors">Retake flow</Link>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
            {feedbackLoading ? (
              <div className="flex items-center gap-3 text-slate-550 text-[12px] py-4 justify-center flex-grow">
                <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-[#FF8A00] animate-spin" />
                Loading feedback...
              </div>
            ) : feedback ? (
              <div className="space-y-3 flex-grow flex flex-col justify-between">
                <div className="rounded-xl bg-gradient-to-br from-orange-50/60 to-amber-50/60 border border-orange-100/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold text-[#FF8A00] uppercase tracking-[0.14em]">{feedback.overall_tier || "Verified Tier"}</p>
                      <h3 className="text-[12px] font-extrabold text-[#0F172A] mt-0.5">Coaching Report Ready</h3>
                    </div>
                    <div className="text-right shrink-0 bg-white/90 rounded-lg px-2 py-0.5 border border-orange-100 flex items-baseline gap-0.5">
                      <span className="text-[17px] font-black text-[#0F172A] leading-none">{feedback.final_score ?? score}</span>
                      <span className="text-[9px] font-bold text-slate-400">/100</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-orange-200/40 rounded-full overflow-hidden mt-2 flex">
                    <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full transition-all duration-500" style={{ width: `${feedback.final_score ?? score}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {feedback.llm_feedback?.overall_summary || feedback.score_explanation || "Your customized coaching analysis is ready."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center my-1">
                  <div className="bg-emerald-50/40 border border-emerald-100/40 rounded-xl py-1.5 px-0.5">
                    <p className="text-[13px] font-extrabold text-emerald-600">{(feedback.strengths || []).length}</p>
                    <p className="text-[8.5px] font-bold text-emerald-600/70 uppercase">Strengths</p>
                  </div>
                  <div className="bg-amber-50/40 border border-amber-100/40 rounded-xl py-1.5 px-0.5">
                    <p className="text-[13px] font-extrabold text-amber-600">{(feedback.improvement_areas || []).length}</p>
                    <p className="text-[8.5px] font-bold text-amber-600/70 uppercase">To Improve</p>
                  </div>
                  <div className="bg-blue-50/40 border border-blue-100/40 rounded-xl py-1.5 px-0.5">
                    <p className="text-[13px] font-extrabold text-blue-600">
                      {Object.keys(feedback.llm_feedback?.category_feedback || {}).length}
                    </p>
                    <p className="text-[8.5px] font-bold text-blue-600/70 uppercase">Domains</p>
                  </div>
                </div>

                <Link href="/dashboard/candidate/feedback" className="w-full shrink-0">
                  <button className="w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 shadow-sm">
                    View Detailed Coaching Report
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center py-5 flex-grow flex flex-col justify-center items-center">
                <p className="text-[12.5px] font-bold text-[#0F172A]">No feedback yet</p>
                <p className="text-[10.5px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Complete your assessment to unlock category feedback and coaching plan.</p>
                <Link href="/assessment/candidate">
                  <button className="mt-3 px-4 py-2 rounded-xl bg-[#FF8A00] text-white text-[11px] font-semibold hover:bg-[#E67A00] transition-all">Go to assessment</button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Setup Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/65 shadow-sm flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <h2 className="text-[13px] font-bold text-[#0F172A]">Setup Progress</h2>
            <span className="text-[10.5px] font-bold text-slate-400">{doneCount}/{tasks.length} Done</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center gap-2">
            {tasks.map(task => (
              <div
                key={task.label}
                className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100/50 rounded-xl cursor-pointer"
                onClick={() => !task.done && router.push(task.href)}
              >
                <span className={`text-[11px] font-semibold ${task.done ? "text-emerald-600 line-through opacity-70" : "text-slate-655"}`}>
                  {task.label}
                </span>
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-4 w-4 text-slate-400 shrink-0" strokeWidth={1.8} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, value, label, trend, accent }: { icon: React.ElementType; value: number; label: string; trend: string; accent: string }) {
  const colors: Record<string, { bg: string; icon: string; ring: string }> = {
    violet: { bg: "bg-violet-50", icon: "text-violet-500", ring: "ring-violet-100" },
    blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "ring-blue-100" },
    amber: { bg: "bg-amber-50", icon: "text-amber-500", ring: "ring-amber-100" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100" },
  };
  const c = colors[accent] || colors.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-3 shadow-sm flex items-center gap-3">
      <div className={`h-8.5 w-8.5 rounded-xl ${c.bg} ${c.icon} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0`}><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
      <div>
        <p className="text-[18px] font-extrabold text-[#0F172A] leading-none">{value}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1 leading-none">{label}</p>
      </div>
    </div>
  );
}

function ScoreTile({ label, pct, border }: { label: string; pct: number; border?: boolean }) {
  return (
    <div className={`px-2 py-2.5 text-center ${border ? "border-x border-white/[0.06]" : ""}`}>
      <p className="text-[8px] font-semibold text-white/30 uppercase tracking-[0.1em] mb-1">{label}</p>
      <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden mb-1 mx-auto max-w-[50px]">
        <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] font-bold text-white/90">{pct}%</p>
    </div>
  );
}

function StatusRow({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  const cls: Record<string, string> = { slate: "bg-slate-50 text-slate-400", blue: "bg-blue-50 text-blue-500", amber: "bg-amber-50 text-amber-500", orange: "bg-orange-50 text-[#FF8A00]" };
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50/70 transition-colors">
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cls[accent]}`}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></div>
        <span className="text-[11.5px] font-medium text-slate-600 leading-none">{label}</span>
      </div>
      <span className="text-[13px] font-bold text-[#0F172A]">{value}</span>
    </div>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10.5px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="font-bold text-[#0F172A]">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}