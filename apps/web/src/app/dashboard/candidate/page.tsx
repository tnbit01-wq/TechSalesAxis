"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Briefcase, Zap, Target, Eye, Sparkles, ArrowRight, Bookmark, Building2, FileText, ChevronRight, Inbox, TrendingUp, Award } from "lucide-react";
import GlobalChatInterface from "@/components/GlobalChatInterface";
import { useSidePanelStore } from "@/hooks/useSidePanelStore";

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
  const { openPanel } = useSidePanelStore();
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

  if (loading) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]"><div className="flex flex-col items-center gap-3"><div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" /><p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading…</p></div></div>;
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
  const expPct = Math.min(100, stats.completion_score);
  const skillPct = isVerified ? 100 : 0;
  const idPct = stats.identity_verified ? 100 : 0;

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-orange-50/10 flex flex-col p-4 md:p-6 space-y-6 overflow-y-auto">
      {/* ── TOP SECTION ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Left: 48% Width - Embedded AI Assistant Chat */}
        <div className="w-full lg:w-[48%] h-[420px] flex flex-col shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 shadow-md shadow-slate-100/50 bg-white">
          <GlobalChatInterface isInline={true} />
        </div>

        {/* Right: 52% Width - Welcome Header & Status Roadmap */}
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
                    Make sure to complete your assessments and keep your profile updated to stand out to hiring managers.
                  </p>
                </div>
                
                <div className="mt-4 flex gap-2.5">
                  <Link href="/dashboard/candidate/jobs">
                    <button className="px-4 py-2 bg-gradient-to-r from-[#FF8A00] to-[#FF9F24] hover:from-[#E67A00] hover:to-[#FF8A00] text-white rounded-xl text-xs font-bold transition-all duration-205 active:scale-95 shadow-md shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20">
                      Browse Open Jobs
                    </button>
                  </Link>
                  <Link href="/dashboard/candidate/profile">
                    <button className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-white/90 rounded-xl text-xs font-bold transition-all duration-205 border border-white/[0.06] active:scale-95">
                      Update Profile
                    </button>
                  </Link>
                </div>
              </div>

              {/* Circular progress bars */}
              <div className="flex gap-4 shrink-0 items-center justify-center bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 backdrop-blur-md">
                <CircularProgress value={stats.completion_score} label="Completion" color="stroke-[#FF8A00]" />
                <CircularProgress value={score} label="Profile Score" color="stroke-blue-500" />
              </div>
            </div>
          </div>

          {/* Redesigned Career Journey Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col gap-4 flex-shrink-0 text-left h-[225px] justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#FF8A00] animate-ping" />
                <h2 className="text-[11px] font-extrabold text-[#0F172A] uppercase tracking-wider">My Progress & Activity</h2>
              </div>
              <span className="text-[10px] font-bold text-[#FF8A00] bg-orange-50 border border-orange-100/50 px-2.5 py-0.5 rounded-full font-sans tracking-wide">
                Active Status
              </span>
            </div>

            {/* Stepper Timeline */}
            <div className="relative pt-1 pb-1">
              <div className="absolute top-4 left-6 right-6 h-[2px] bg-slate-100 -z-0"></div>
              <div className="relative z-10 flex justify-between items-start">
                
                {/* Step 1: Profile */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    stats.completion_score > 70 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-orange-50 border-orange-200 text-[#FF8A00]'
                  }`}>
                    {stats.completion_score > 70 ? <CheckCircle2 className="h-4.5 w-4.5" /> : "1"}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Profile Setup</span>
                  <span className={`text-[8.5px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md border ${
                    stats.completion_score > 70 
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                      : 'text-orange-650 bg-orange-50/50 border-orange-100'
                  }`}>
                    {stats.completion_score > 70 ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                {/* Step 2: Skills */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    isVerified 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-orange-50 border-orange-200 text-[#FF8A00]'
                  }`}>
                    {isVerified ? <CheckCircle2 className="h-4.5 w-4.5" /> : "2"}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Skills Evaluated</span>
                  <span className={`text-[8.5px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md border ${
                    isVerified 
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                      : 'text-orange-600 bg-orange-50 border-orange-100'
                  }`}>
                    {isVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>

                {/* Step 3: Identity */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    stats.identity_verified 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-orange-50 border-orange-200 text-[#FF8A00]'
                  }`}>
                    {stats.identity_verified ? <CheckCircle2 className="h-4.5 w-4.5" /> : "3"}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Identity Check</span>
                  <span className={`text-[8.5px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md border ${
                    stats.identity_verified 
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                      : 'text-orange-600 bg-orange-50 border-orange-100'
                  }`}>
                    {stats.identity_verified ? 'Confirmed' : 'Pending'}
                  </span>
                </div>

                {/* Step 4: Search */}
                <div className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-all duration-300 ${
                    stats.applications_count > 0 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {stats.applications_count > 0 ? <CheckCircle2 className="h-4.5 w-4.5" /> : "4"}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 mt-2">Job Search</span>
                  <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                    {stats.applications_count > 0 ? `${stats.applications_count} Applied` : 'Ready'}
                  </span>
                </div>

              </div>
            </div>

            {/* Performance Stats grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div className="text-center bg-slate-50/50 rounded-xl py-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Profile Views</span>
                <span className="text-[14px] font-extrabold text-[#0F172A]">{stats.profile_views_count ?? 0}</span>
              </div>
              <div className="text-center bg-slate-50/50 rounded-xl py-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Job Matches</span>
                <span className="text-[14px] font-extrabold text-[#0F172A]">{jobs.length}</span>
              </div>
              <div className="text-center bg-[#FF8A00]/5 rounded-xl py-1 border border-[#FF8A00]/10">
                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider block">Interviews</span>
                <span className="text-[14px] font-extrabold text-[#FF8A00]">{stats.invites_received}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
        {/* Card 1: Recommended Roles */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#FF8A00]" />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Recommended Roles</h2>
            </div>
            <Link href="/dashboard/candidate/jobs" className="text-[11px] font-bold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-4 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 border border-slate-100">
                  <Briefcase className="h-5 w-5 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-bold text-[#0F172A]">No matches yet</p>
                <Link href="/dashboard/candidate/profile" className="text-[10px] text-[#FF8A00] hover:underline mt-1 font-semibold">Enhance Profile</Link>
              </div>
            ) : jobs.map((job: any) => (
              <Link key={job.job_id} href="/dashboard/candidate/jobs" className="block">
                <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFBFC] border border-transparent hover:border-slate-100/80 transition-all duration-205 group rounded-xl">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {job.company_logo_url ? <img src={job.company_logo_url} className="h-6 w-6 object-contain" alt="" /> : <Building2 className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11.5px] font-bold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                    <p className="text-[9.5px] text-slate-400 mt-0.5 truncate">{job.company_name} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${(job.match_score || 0) >= 80 ? "text-emerald-700 bg-emerald-50/50 border-emerald-100" : "text-[#FF8A00] bg-orange-50/50 border-orange-100"}`}>
                      {Math.round(job.match_score || 0)}% Match
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Card 2: Assessment Feedback */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF8A00]" strokeWidth={2} />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Assessment Feedback</h2>
            </div>
            <Link href="/assessment/candidate" className="text-[11px] font-bold text-[#FF8A00] hover:text-[#E67A00] transition-colors">Retake flow</Link>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
            {feedbackLoading ? (
              <div className="flex items-center gap-3 text-slate-550 text-[12px] py-4 justify-center flex-grow">
                <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-[#FF8A00] animate-spin" />
                Loading feedback...
              </div>
            ) : feedback ? (
              <div className="space-y-3 flex-grow flex flex-col justify-between">
                <div className="rounded-xl bg-gradient-to-br from-slate-50 via-white to-slate-50/50 border border-slate-100 p-3 shadow-xs relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#FF8A00]/5 rounded-full blur-xl"></div>
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div>
                      <p className="text-[8px] font-extrabold text-[#FF8A00] uppercase tracking-[0.14em]">{feedback.overall_tier || "Verified Tier"}</p>
                      <h3 className="text-[12px] font-bold text-[#0F172A] mt-0.5">Coaching Report Ready</h3>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {feedback.llm_feedback?.overall_summary || feedback.score_explanation || "Your customized coaching analysis is ready."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center my-1">
                  <div className="bg-emerald-50/40 border border-emerald-100/40 rounded-xl py-1.5 px-0.5 hover:bg-emerald-50/60 transition-colors">
                    <p className="text-[13px] font-extrabold text-emerald-600">{(feedback.strengths || []).length}</p>
                    <p className="text-[8px] font-bold text-emerald-600/70 uppercase tracking-wider">Strengths</p>
                  </div>
                  <div className="bg-amber-50/40 border border-amber-100/40 rounded-xl py-1.5 px-0.5 hover:bg-amber-50/60 transition-colors">
                    <p className="text-[13px] font-extrabold text-amber-600">{(feedback.improvement_areas || []).length}</p>
                    <p className="text-[8px] font-bold text-amber-600/70 uppercase tracking-wider">To Improve</p>
                  </div>
                  <div className="bg-blue-50/40 border border-blue-100/40 rounded-xl py-1.5 px-0.5 hover:bg-blue-50/60 transition-colors">
                    <p className="text-[13px] font-extrabold text-blue-600">
                      {Object.keys(feedback.llm_feedback?.category_feedback || {}).length}
                    </p>
                    <p className="text-[8px] font-bold text-blue-600/70 uppercase tracking-wider">Domains</p>
                  </div>
                </div>

                <Link href="/dashboard/candidate/feedback" className="w-full shrink-0">
                  <button className="w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-98">
                    View Detailed Coaching Report
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center py-5 flex-grow flex flex-col justify-center items-center">
                <p className="text-[12px] font-bold text-[#0F172A]">No feedback yet</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Complete your assessment to unlock category feedback and coaching plan.</p>
                <Link href="/assessment/candidate">
                  <button className="mt-3 px-4 py-2 rounded-xl bg-[#FF8A00] text-white text-[11px] font-bold hover:bg-[#E67A00] transition-all">Go to assessment</button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Activity Hub */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-[320px] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/80 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF8A00]" />
              <h2 className="text-[12px] font-extrabold text-[#0F172A] uppercase tracking-wider">Activity Hub</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Live Tracker</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-blue-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Saved Opportunities</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{stats.saved_jobs_count}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Active Applications</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{stats.applications_count}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11.5px] font-bold text-[#0F172A]">Shortlisted Roles</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#0F172A]">{stats.shortlisted_count}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => openPanel("messages")}
                className="w-full py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[#0F172A] rounded-xl text-[10.5px] font-bold transition-all text-center cursor-pointer"
              >
                Chat Inbox
              </button>
              <Link href="/dashboard/candidate/jobs" className="w-full">
                <button className="w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-[10.5px] font-bold transition-all text-center">
                  Find Jobs
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressCol({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase">
        <span>{label}</span>
        <span className="text-[#0F172A]">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
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
