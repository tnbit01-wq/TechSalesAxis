"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Briefcase, Zap, Target, Eye, Sparkles, ArrowRight, Bookmark, Building2, FileText, ChevronRight, Inbox, TrendingUp, Award } from "lucide-react";

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
        apiClient.get("/candidate/recommended-jobs?limit=4", token).catch(() => null),
      ]);
      setStats(s);
      if (p?.full_name) setUserName(p.full_name.split(" ")[0]);
      setJobs((j?.data || j?.recommended_jobs || j?.recommendations || []).slice(0, 4));

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
    { label: "Complete your profile", done: stats.completion_score > 70, href: "/dashboard/candidate/profile" },
    { label: "Verify your identity", done: stats.identity_verified, href: "/dashboard/candidate/settings" },
    { label: "Take the skill assessment", done: isVerified, href: "/assessment/candidate" },
    { label: "Apply to your first job", done: stats.applications_count > 0, href: "/dashboard/candidate/jobs" },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const hasApps = stats.applications_count > 0 || stats.saved_jobs_count > 0 || stats.shortlisted_count > 0 || stats.invites_received > 0;
  const expPct = Math.min(100, stats.completion_score);
  const skillPct = isVerified ? 100 : 0;
  const idPct = stats.identity_verified ? 100 : 0;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-y-auto overflow-x-hidden">
      <div className="min-h-[calc(100vh-64px)] p-5 flex flex-col gap-4 pb-8">
        {/* ── TOP ROW: Welcome (narrow) + 4 KPIs ── */}
        <div className="flex gap-4 flex-shrink-0">
          {/* Welcome — compact horizontal strip */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1a2744] to-[#1E293B] rounded-2xl px-6 py-4 flex items-center gap-6 min-w-[340px] shadow-[0_4px_20px_rgba(15,23,42,0.2)]">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/[0.03]" />
            <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-[#FF8A00]/10" />
            <div className="relative z-10 flex-1">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-0.5">Welcome back</p>
              <h1 className="text-lg font-bold text-white tracking-tight">{userName} 👋</h1>
              <p className="text-[11px] text-white/40 mt-0.5">Profile <span className="text-white/70 font-semibold">{stats.completion_score}%</span> complete</p>
            </div>
            <div className="flex gap-2 relative z-10">
              <Link href="/dashboard/candidate/jobs"><button className="px-4 py-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-orange-900/25">Find Jobs</button></Link>
              <Link href="/dashboard/candidate/profile"><button className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] text-white/90 rounded-xl text-[11px] font-bold transition-all border border-white/[0.08]">Edit Profile</button></Link>
            </div>
          </div>
          {/* 4 KPI cards */}
          <div className="flex-1 grid grid-cols-4 gap-3">
            <KpiCard icon={Eye} value={stats.profile_views_count ?? 0} label="Profile Views" trend="up" accent="violet" />
            <KpiCard icon={Target} value={stats.applications_count} label="Applications" trend={stats.applications_count > 0 ? "up" : "neutral"} accent="blue" />
            <KpiCard icon={Sparkles} value={jobs.length} label="Job Matches" trend="up" accent="amber" />
            <KpiCard icon={Zap} value={stats.invites_received} label="Interviews" trend={stats.invites_received > 0 ? "up" : "neutral"} accent="emerald" />
          </div>
        </div>

        {/* ── MAIN CONTENT ROW ── */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left — 60% — stacked: Recommended Roles + Onboarding */}
          <div className="flex-[3] flex flex-col gap-4 min-h-0">
            {/* Recommended Roles */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100/80 flex-shrink-0">
                <h2 className="text-[14px] font-bold text-[#0F172A] tracking-tight">Recommended Roles</h2>
                <Link href="/dashboard/candidate/jobs" className="text-[12px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              <div className="flex-1 overflow-hidden">
                {jobs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mb-3 border border-slate-200/50"><Briefcase className="h-6 w-6 text-slate-300" strokeWidth={1.5} /></div>
                    <p className="text-[14px] font-bold text-[#0F172A]">No matches yet</p>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-[280px] text-center leading-relaxed">Complete your profile and assessment to get AI-powered job recommendations.</p>
                    <Link href="/dashboard/candidate/profile"><button className="mt-4 px-5 py-2 bg-[#FF8A00] text-white rounded-xl text-[12px] font-semibold hover:bg-[#E67A00] transition-all shadow-sm">Enhance Profile</button></Link>
                  </div>
                ) : jobs.map((job: any, i: number) => (
                  <Link key={job.job_id} href="/dashboard/candidate/jobs">
                    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFBFC] transition-all cursor-pointer group ${i < jobs.length - 1 ? "border-b border-slate-100/70" : ""}`}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {job.company_logo_url ? <img src={job.company_logo_url} className="h-7 w-7 object-contain" alt="" /> : <Building2 className="h-4 w-4 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-semibold text-[#0F172A] truncate group-hover:text-[#FF8A00] transition-colors">{job.title}</h3>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{job.company_name} · {job.location}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {job.salary_range && <span className="text-[11.5px] font-semibold text-slate-600 hidden lg:block">{job.salary_range}</span>}
                        <span className={`text-[11px] font-bold ${(job.match_score || 0) >= 80 ? "text-emerald-600" : "text-[#FF8A00]"}`}>
                          {(job.match_score || 0) >= 80 && <span className="mr-0.5">✓</span>}{Math.round(job.match_score || 0)}% Match
                        </span>
                        <button onClick={e => e.preventDefault()} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-[#FF8A00] hover:bg-orange-50 transition-all"><Bookmark className="h-3.5 w-3.5" strokeWidth={1.8} /></button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {/* Onboarding checklist — compact horizontal strip */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] px-5 py-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <h2 className="text-[13px] font-bold text-[#0F172A]">Setup</h2>
                  <div className="flex items-center gap-0.5">
                    {tasks.map((t, i) => <div key={i} className={`h-1.5 w-6 rounded-full ${t.done ? "bg-emerald-400" : "bg-slate-200"}`} />)}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 ml-1">{doneCount}/{tasks.length}</span>
                </div>
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  {tasks.map(task => (
                    <div key={task.label} className="flex items-center gap-1.5 cursor-pointer group flex-shrink-0" onClick={() => !task.done && router.push(task.href)}>
                      {task.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={2} /> : <Circle className="h-4 w-4 text-slate-300 group-hover:text-slate-400" strokeWidth={1.8} />}
                      <span className={`text-[11px] font-medium whitespace-nowrap ${task.done ? "text-emerald-600" : "text-slate-500 group-hover:text-[#0F172A]"}`}>{task.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right — 40% — Profile Score + Application Status */}
          <div className="flex-[2] flex flex-col gap-4 min-h-0">
            {/* Profile Score */}
            <div className="flex-shrink-0 bg-[#0F172A] rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.2)] overflow-hidden">
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="h-4 w-4 text-[#FF8A00]" strokeWidth={2} />
                      <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.12em]">Profile Score</p>
                    </div>
                    <p className="text-[11px] text-white/35 leading-relaxed">Complete your profile to boost visibility</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[36px] font-black text-white leading-none tracking-tight">{score}</span>
                    <span className="text-[14px] font-bold text-white/30 ml-0.5">/100</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] text-white/35">{score >= 80 ? "Excellent — top visibility!" : score >= 50 ? "Keep going — you're making progress" : "Get started to stand out"}</p>
                  <Link href="/assessment/candidate">
                    <button className="px-3.5 py-1.5 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.06] text-white/80 rounded-lg text-[10px] font-bold transition-all">Retake Assessment →</button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-white/[0.06]">
                <ScoreTile label="Experience" pct={expPct} />
                <ScoreTile label="Skills" pct={skillPct} border />
                <ScoreTile label="Identity" pct={idPct} />
              </div>
            </div>

            {/* Assessment Feedback */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100/80">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-[#FF8A00]" strokeWidth={2} />
                    <h2 className="text-[14px] font-bold text-[#0F172A] tracking-tight">Assessment Feedback</h2>
                  </div>
                  <p className="text-[11px] text-slate-400">Category-level coaching and your 30-day improvement plan</p>
                </div>
                <Link href="/assessment/candidate" className="text-[11px] font-semibold text-[#FF8A00] hover:text-[#E67A00] transition-colors">Retake flow</Link>
              </div>

              <div className="p-5 space-y-4">
                {feedbackLoading ? (
                  <div className="flex items-center gap-3 text-slate-500 text-[12px]">
                    <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-[#FF8A00] animate-spin" />
                    Loading feedback...
                  </div>
                ) : feedback ? (
                  <>
                    <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-[10px] font-bold text-[#FF8A00] uppercase tracking-[0.14em]">{feedback.overall_tier || "Assessment"}</p>
                          <p className="text-[13px] font-semibold text-[#0F172A] mt-1">{feedback.llm_feedback?.overall_summary || feedback.score_explanation || "Your assessment feedback is ready."}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[28px] font-black text-[#0F172A] leading-none">{feedback.final_score ?? score}</span>
                          <span className="text-[12px] font-bold text-slate-400">/100</span>
                        </div>
                      </div>
                      {feedback.visibility_impact && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">{feedback.visibility_impact}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FeedbackList title="Strengths" items={feedback.strengths || []} tone="emerald" />
                      <FeedbackList title="Improve" items={feedback.improvement_areas || []} tone="amber" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(feedback.llm_feedback?.category_feedback || {}).slice(0, 4).map(([category, item]) => (
                        <div key={category} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-[#0F172A] capitalize">{category}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.12em]">Coach tip</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{item?.summary || item?.next_move || item?.practice || "Keep improving this category."}</p>
                        </div>
                      ))}
                    </div>

                    {(feedback.llm_feedback?.["30_day_plan"] || feedback.recommendations || feedback.next_steps) && (
                      <div className="rounded-2xl border border-slate-100 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-[#0F172A] uppercase tracking-[0.14em]">30-day plan</p>
                          <span className="text-[10px] font-semibold text-slate-400">Retake after 30 days</span>
                        </div>
                        <ol className="space-y-2">
                          {(feedback.llm_feedback?.["30_day_plan"] || feedback.recommendations || feedback.next_steps || []).slice(0, 4).map((item: string, index: number) => (
                            <li key={`${index}-${item}`} className="flex gap-2 text-[11px] text-slate-600 leading-relaxed">
                              <span className="mt-0.5 h-5 w-5 rounded-full bg-[#FF8A00]/10 text-[#FF8A00] flex items-center justify-center text-[10px] font-bold shrink-0">{index + 1}</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                    <p className="text-[13px] font-semibold text-[#0F172A]">No feedback yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Complete your assessment to unlock category feedback and a 30-day improvement plan.</p>
                    <Link href="/assessment/candidate">
                      <button className="mt-3 px-4 py-2 rounded-xl bg-[#FF8A00] text-white text-[11px] font-semibold hover:bg-[#E67A00] transition-all">Go to assessment</button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Application Status */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100/80 flex-shrink-0">
                <h2 className="text-[14px] font-bold text-[#0F172A] tracking-tight">Application Status</h2>
                <Link href="/dashboard/candidate/applications" className="text-[12px] font-semibold text-[#FF8A00] hover:text-[#E67A00] flex items-center gap-1 transition-colors">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              <div className="flex-1 flex flex-col justify-center px-5 py-4">
                {!hasApps ? (
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex items-center justify-center mx-auto mb-3"><Inbox className="h-5 w-5 text-slate-300" strokeWidth={1.5} /></div>
                    <p className="text-[13px] font-bold text-[#0F172A]">No applications yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Start applying to track your progress</p>
                    <Link href="/dashboard/candidate/jobs"><button className="mt-3 px-5 py-2 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[11px] font-semibold transition-all shadow-sm">Browse Jobs</button></Link>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Link href="/dashboard/candidate/jobs"><StatusRow label="Saved Jobs" value={stats.saved_jobs_count} icon={Bookmark} accent="slate" /></Link>
                    <Link href="/dashboard/candidate/applications"><StatusRow label="Applied" value={stats.applications_count} icon={FileText} accent="blue" /></Link>
                    <Link href="/dashboard/candidate/applications"><StatusRow label="Shortlisted" value={stats.shortlisted_count} icon={Target} accent="amber" /></Link>
                    <Link href="/dashboard/candidate/applications"><StatusRow label="Interviews" value={stats.invites_received} icon={Zap} accent="orange" /></Link>
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

/* ── Sub-components ── */
function KpiCard({ icon: Icon, value, label, trend, accent }: { icon: React.ElementType; value: number; label: string; trend: string; accent: string }) {
  const colors: Record<string, { bg: string; icon: string; ring: string }> = {
    violet: { bg: "bg-violet-50", icon: "text-violet-500", ring: "ring-violet-100" },
    blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "ring-blue-100" },
    amber: { bg: "bg-amber-50", icon: "text-amber-500", ring: "ring-amber-100" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100" },
  };
  const c = colors[accent] || colors.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className={`h-9 w-9 rounded-xl ${c.bg} ${c.icon} ring-1 ${c.ring} flex items-center justify-center`}><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
        {trend === "up" && value > 0 && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />}
      </div>
      <p className="text-[24px] font-extrabold text-[#0F172A] leading-none tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function ScoreTile({ label, pct, border }: { label: string; pct: number; border?: boolean }) {
  return (
    <div className={`px-4 py-3 text-center ${border ? "border-x border-white/[0.06]" : ""}`}>
      <p className="text-[8px] font-semibold text-white/30 uppercase tracking-[0.1em] mb-1.5">{label}</p>
      <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden mb-1.5 mx-auto max-w-[60px]">
        <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFB800] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[15px] font-bold text-white/90">{pct}%</p>
    </div>
  );
}

function StatusRow({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  const cls: Record<string, string> = { slate: "bg-slate-50 text-slate-400", blue: "bg-blue-50 text-blue-500", amber: "bg-amber-50 text-amber-500", orange: "bg-orange-50 text-[#FF8A00]" };
  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50/70 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${cls[accent]}`}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></div>
        <span className="text-[12px] font-medium text-slate-600">{label}</span>
      </div>
      <span className="text-[14px] font-bold text-[#0F172A]">{value}</span>
    </div>
  );
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "amber" }) {
  const toneStyles = {
    emerald: { badge: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
    amber: { badge: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  };
  const style = toneStyles[tone];

  return (
    <div className="rounded-2xl border border-slate-100 p-3.5 bg-white">
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] ${style.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {(items.length ? items : ["No item available yet."]).slice(0, 3).map((item, index) => (
          <li key={`${title}-${index}`} className="text-[11px] text-slate-600 leading-relaxed flex gap-2">
            <span className={`mt-1 h-1.5 w-1.5 rounded-full ${style.dot} shrink-0`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
