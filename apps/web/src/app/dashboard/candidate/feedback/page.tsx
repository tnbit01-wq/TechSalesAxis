"use client";
import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ArrowRight, 
  BookOpen,
  Target,
  Zap
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

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

export default function CandidateFeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<AssessmentFeedbackReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"strengths" | "improvements">("strengths");

  useEffect(() => {
    async function loadFeedback() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const fb = await apiClient.get("/assessment/feedback", token).catch(() => null);
        if (fb?.data) {
          setFeedback(fb.data);
        } else if (fb && !fb.error) {
          setFeedback(fb);
        }
      } catch (err) {
        console.error("Failed to load feedback:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFeedback();
  }, [router]);

  if (loading) return <LoadingScreen label="Loading Coach Feedback…" />;

  if (!feedback) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC] p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/60 p-8 text-center shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mx-auto mb-4 border border-slate-200/50">
            <Award className="h-6 w-6 text-slate-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">No feedback report found</h3>
          <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
            You need to complete the skill assessment first to generate your coaching report and 30-day action plan.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/assessment/candidate">
              <button className="w-full py-2.5 bg-[#FF8A00] text-white rounded-xl text-xs font-semibold hover:bg-[#E67A00] transition-all">
                Take Skill Assessment
              </button>
            </Link>
            <Link href="/dashboard/candidate">
              <button className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-all">
                Back to Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const score = feedback.final_score ?? 0;
  const strengthsList = feedback.strengths || [];
  const improvementsList = feedback.improvement_areas || [];
  const recommendationsList = feedback.llm_feedback?.["30_day_plan"] || feedback.recommendations || feedback.next_steps || [];
  const categoriesFeedback = feedback.llm_feedback?.category_feedback || {};

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/candidate" className="inline-flex items-center gap-2 text-[12.5px] font-bold text-slate-500 hover:text-[#FF8A00] transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>
          <span className="text-[11px] font-medium text-slate-400 bg-white border border-slate-200/60 px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Generated {feedback.generated_at ? new Date(feedback.generated_at).toLocaleDateString() : "Recently"}
          </span>
        </div>

        {/* Main Score Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1a2744] to-[#1E293B] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 shadow-xl shadow-slate-900/10">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/[0.02]" />
          <div className="absolute bottom-0 right-20 h-24 w-24 rounded-full bg-[#FF8A00]/5" />
          
          {/* Radial score representation */}
          <div className="relative flex-shrink-0 h-32 w-32 rounded-full border-4 border-white/[0.06] flex flex-col items-center justify-center bg-white/[0.03] shadow-inner shadow-black/30">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.1em] mb-1">Score</p>
            <span className="text-[38px] font-black text-white leading-none tracking-tight">{score}</span>
            <span className="text-[12px] font-bold text-white/35 border-t border-white/10 mt-1 pt-0.5 px-2">/ 100</span>
          </div>

          <div className="flex-1 text-center md:text-left z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center md:justify-start">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF8A00] text-white rounded-full text-[10px] font-bold uppercase tracking-wider self-center md:self-start">
                <Sparkles className="h-3 w-3" />
                {feedback.overall_tier || "Verified Skill Tier"}
              </span>
              {feedback.visibility_impact && (
                <span className="text-[11.5px] text-emerald-400 font-semibold">
                  {feedback.visibility_impact}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-3">
              Coaching & Skill Assessment Report
            </h1>
            <p className="text-[13px] text-white/70 mt-2 leading-relaxed max-w-2xl">
              {feedback.llm_feedback?.overall_summary || feedback.score_explanation || "Your professional assessment summary and roadmap are ready."}
            </p>
          </div>
        </div>

        {/* Strengths & Improvements Tabs + Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Strengths & Improvements Column - Left 2/5 */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_24px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-100 flex-shrink-0">
              <button
                onClick={() => setActiveTab("strengths")}
                className={`flex-1 py-4 text-[12.5px] font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === "strengths"
                    ? "border-[#FF8A00] text-[#FF8A00] bg-orange-50/10"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <CheckCircle2 className={`h-4 w-4 ${activeTab === "strengths" ? "text-[#FF8A00]" : "text-slate-400"}`} />
                Strengths ({strengthsList.length})
              </button>
              <button
                onClick={() => setActiveTab("improvements")}
                className={`flex-1 py-4 text-[12.5px] font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === "improvements"
                    ? "border-[#FF8A00] text-[#FF8A00] bg-orange-50/10"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <AlertCircle className={`h-4 w-4 ${activeTab === "improvements" ? "text-[#FF8A00]" : "text-slate-400"}`} />
                Improvements ({improvementsList.length})
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto min-h-[250px]">
              {activeTab === "strengths" ? (
                <ul className="space-y-4">
                  {strengthsList.length > 0 ? (
                    strengthsList.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-[12.5px] text-slate-600 leading-relaxed bg-emerald-50/20 p-3 rounded-2xl border border-emerald-100/50">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">No specific strengths captured yet.</p>
                  )}
                </ul>
              ) : (
                <ul className="space-y-4">
                  {improvementsList.length > 0 ? (
                    improvementsList.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-[12.5px] text-slate-600 leading-relaxed bg-amber-50/25 p-3 rounded-2xl border border-amber-100/50">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">No critical areas of improvement captured.</p>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Category-Level Coaching - Right 3/5 */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-sm font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#FF8A00]" />
              Category Coaching Details
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {Object.keys(categoriesFeedback).length > 0 ? (
                Object.entries(categoriesFeedback).map(([category, item]: [string, any]) => (
                  <div key={category} className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm space-y-3 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-[13px] font-bold text-[#0F172A] capitalize flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#FF8A00]" />
                        {category.replace(/_/g, " ")}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200/30 px-2 py-0.5 rounded-lg">
                        Domain coaching
                      </span>
                    </div>
                    
                    {item.summary && (
                      <div>
                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Assessment Feedback</h4>
                        <p className="text-[12px] text-slate-600 leading-relaxed">{item.summary}</p>
                      </div>
                    )}

                    {item.practice && (
                      <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                        <h4 className="text-[10px] font-extrabold text-[#FF8A00] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <Target className="h-3 w-3" /> Practice Recommendation
                        </h4>
                        <p className="text-[11.5px] text-slate-600 leading-relaxed">{item.practice}</p>
                      </div>
                    )}

                    {item.next_move && (
                      <div>
                        <h4 className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider mb-0.5">Next Active Step</h4>
                        <p className="text-[11.5px] text-slate-600 leading-relaxed">{item.next_move}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/60 p-8 text-center text-slate-400">
                  No domain feedback details available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 30-Day Coaching Plan - Full Width */}
        {recommendationsList.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_24px_rgba(0,0,0,0.02)] space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#FF8A00]" />
                  Your 30-Day Action & Improvement Plan
                </h2>
                <p className="text-xs text-slate-400 mt-1">Recommended daily focus and practice routines to boost your capabilities.</p>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase bg-slate-50 border border-slate-200/30 px-3 py-1 rounded-full">
                Step-by-Step
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendationsList.map((item: string, index: number) => (
                <div key={index} className="flex gap-4 p-4 rounded-2xl border border-slate-100 bg-[#FAFBFC] hover:bg-white hover:border-[#FF8A00]/20 hover:shadow-sm transition-all group">
                  <span className="h-8 w-8 rounded-xl bg-orange-50 text-[#FF8A00] flex items-center justify-center text-xs font-black shrink-0 border border-orange-100 group-hover:bg-[#FF8A00] group-hover:text-white transition-colors">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-[12.5px] font-bold text-[#0F172A] mb-1">Focus Point {index + 1}</h3>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Panel: Retake Skill Assessment */}
        <div className="bg-gradient-to-br from-[#FFF6ED] to-[#FFF0E0] border border-orange-100/80 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="text-center sm:text-left">
            <h3 className="text-base font-bold text-[#0F172A]">Want to improve your score?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              You can retake the assessment every 30 days. We recommend practicing the guidelines in your plan first.
            </p>
          </div>
          <Link href="/assessment/candidate" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-6 py-3 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-950/10 flex items-center justify-center gap-1.5">
              Retake Assessment Flow
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
