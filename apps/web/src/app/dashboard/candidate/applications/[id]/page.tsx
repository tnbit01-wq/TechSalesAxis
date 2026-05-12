"use client";

import { useEffect, useState, useCallback } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Video,
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
  Briefcase,
  Users,
  FileText,
} from "lucide-react";

interface ApplicationDetails {
  id: string;
  job_id: string;
  status: string;
  applied_at: string;
  feedback?: string;
  job?: {
    id: string;
    title: string;
    description: string;
    location?: string;
    salary_range?: string;
    company_name?: string;
  };
  interviews?: Array<{
    id: string;
    status: string;
    meeting_link?: string;
    round_number?: number;
    round_name?: string;
    format: string;
    interviewer_names?: string[];
    interview_slots?: Array<{
      id: string;
      start_time: string;
      end_time: string;
      is_selected: boolean;
    }>;
  }>;
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  
  const [app, setApp] = useState<ApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTechnicalValue = (value?: string) => {
    if (!value) return false;

    const trimmed = value.trim();
    // Hide UUID-like or hash-like values from user-facing UI labels.
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const longHexPattern = /^[0-9a-f]{16,}$/i;
    return uuidPattern.test(trimmed) || longHexPattern.test(trimmed);
  };

  const toDisplayText = (value: string | undefined, fallback: string) => {
    if (!value || isTechnicalValue(value)) {
      return fallback;
    }
    return value;
  };

  const displayTitle = toDisplayText(app?.job?.title, "Application");
  const displayCompany = toDisplayText(app?.job?.company_name, "Company");

  const activeInterview = app?.interviews?.find(i => ["scheduled", "pending_confirmation"].includes(i.status)) || app?.interviews?.[0];

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const data = await apiClient.get(`/candidate/applications/${applicationId}`, token);
      setApp(data);
    } catch (err: any) {
      console.error("Failed to load application details:", err);
      setError(err.message || "Failed to load application details");
    } finally {
      setLoading(false);
    }
  }, [applicationId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_40%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00]"></div>
          <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">Loading Application...</p>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_40%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border border-orange-100 shadow-[0_8px_24px_rgba(255,138,0,0.08)] text-center">
          <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Unable to Load</h2>
          <p className="text-slate-500 text-sm mt-3 mb-6">{error || "Could not retrieve application details"}</p>
          <button 
            onClick={() => router.back()}
            className="w-full py-2.5 bg-[#FF8A00] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#E67A00] transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case "applied": return "bg-blue-100 text-blue-700";
      case "shortlisted": return "bg-emerald-100 text-emerald-700";
      case "interview_scheduled": return "bg-purple-100 text-purple-700";
      case "offered": return "bg-amber-100 text-amber-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case "applied": return "Applied";
      case "shortlisted": return "Shortlisted";
      case "interview_scheduled": return "Interview Scheduled";
      case "offered": return "Offered";
      case "rejected": return "Rejected";
      default: return status.replace(/_/g, " ");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-10 w-10 rounded-xl border border-orange-100 bg-white hover:bg-orange-50 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-[#FF8A00]" />
          </button>
          <div>
            <p className="text-xs font-bold text-[#C96B00] uppercase tracking-wider">Application Details</p>
            <p className="text-sm font-semibold text-slate-500">View and track your application progress</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Header Card */}
            <div className="rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.06)] overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-[#FF8A00] via-[#FFB366] to-[#FFE3BF]" />
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#FFF6ED] to-[#FFE3BF] flex items-center justify-center flex-shrink-0 border border-orange-100">
                      <Building2 className="h-7 w-7 text-[#FF8A00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl md:text-3xl font-black text-slate-900 line-clamp-2">
                        {displayTitle}
                      </h1>
                      <p className="text-sm font-bold text-[#FF8A00] uppercase tracking-wider mt-1">
                        {displayCompany}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap ${getStatusColor(app.status)}`}>
                    {getStatusLabel(app.status)}
                  </div>
                </div>

                {/* Job Meta Information */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                  {app.job?.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location</p>
                        <p className="text-sm font-semibold text-slate-900">{app.job.location}</p>
                      </div>
                    </div>
                  )}
                  {app.job?.salary_range && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Budget</p>
                        <p className="text-sm font-semibold text-slate-900">{app.job.salary_range}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applied</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(app.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interview Card (if active) */}
            {activeInterview && (
              <div className="rounded-[28px] border border-purple-100 bg-gradient-to-br from-purple-50 to-white shadow-[0_8px_24px_rgba(168,85,247,0.08)] overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-300" />
                
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Video className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">Interview Scheduled</h3>
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        {activeInterview.round_name} {activeInterview.round_number && `• Round ${activeInterview.round_number}`}
                      </p>
                    </div>
                  </div>

                  {activeInterview.status === 'scheduled' && activeInterview.meeting_link && (() => {
                    const now = new Date();
                    const slot = activeInterview.interview_slots?.find(s => s.is_selected);
                    if (!slot) return null;
                    
                    const start = new Date(slot.start_time);
                    const end = new Date(slot.end_time);
                    const allowedStart = new Date(start.getTime() - 15 * 60 * 1000);
                    const fiveAfterStart = new Date(start.getTime() + 5 * 60 * 1000);
                    const allowedEnd = fiveAfterStart < end ? fiveAfterStart : end;
                    const isActive = now >= allowedStart && now <= allowedEnd;

                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-white border border-purple-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Scheduled Time</p>
                          <p className="text-lg font-black text-slate-900">
                            {start.toLocaleString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        </div>
                        {activeInterview.interviewer_names && activeInterview.interviewer_names.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Interviewer(s)</p>
                            <p className="text-sm font-semibold text-slate-900">{activeInterview.interviewer_names.join(", ")}</p>
                          </div>
                        )}
                        <button
                          disabled={!isActive}
                          onClick={async () => {
                            try {
                              const token = awsAuth.getToken();
                              if (token) {
                                await apiClient.post(`/interviews/${activeInterview.id}/join-event`, { role: "candidate" }, token);
                              }
                            } catch (err) {
                              console.error("Failed to signal join:", err);
                              return;
                            }
                            window.open(activeInterview.meeting_link, '_blank');
                          }}
                          className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all ${
                            isActive
                              ? "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <Video className="h-4 w-4" />
                          {isActive
                            ? "Join Interview"
                            : now < allowedStart
                              ? `Locked: In ${Math.round((allowedStart.getTime() - now.getTime()) / 60000)}m`
                              : now > end
                                ? "Expired"
                                : "Window Closed"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Job Description Card */}
            {app.job?.description && (
              <div className="rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.06)] overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <FileText className="h-5 w-5 text-[#FF8A00]" />
                    <h3 className="font-black text-slate-900">About This Role</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-[10]">
                    {app.job.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Application Timeline Card */}
            <div className="rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00] mb-4">Progress</p>
              <div className="space-y-3">
                {[
                  { step: "Applied", status: true },
                  { step: "Shortlisted", status: ["shortlisted", "interview_scheduled", "offered", "rejected"].includes(app.status) },
                  { step: "Interview", status: ["interview_scheduled", "offered"].includes(app.status) },
                  { step: "Offered", status: app.status === "offered" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      item.status
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      {item.status ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className="font-semibold text-sm text-slate-900">{item.step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback Card (if exists) */}
            {app.feedback && (
              <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 shadow-[0_8px_24px_rgba(16,185,129,0.08)] p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 mb-2">Feedback</p>
                    <p className="text-sm text-emerald-900 leading-relaxed">
                      {app.feedback}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Card */}
            <div className="rounded-[28px] border border-orange-100/80 bg-[#FFF8F1] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C96B00] mb-4">Next Steps</p>
              <Link
                href="/dashboard/candidate/applications"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider hover:bg-[#E67A00] transition-all"
              >
                <ArrowRight className="h-4 w-4" />
                View All Applications
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
