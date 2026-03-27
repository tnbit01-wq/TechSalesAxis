"use client";

import { useEffect, useState, useCallback } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter, useParams } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Video,
  Briefcase,
  Building2,
  MapPin,
  Calendar,
  User,
  ArrowRight
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

  const activeInterview = app?.interviews?.find(i => ["scheduled", "pending_confirmation"].includes(i.status)) || app?.interviews?.[0];

  const loadData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      // Fetch specific application details
      // If no specific endpoint exists, we fetch all and find the one. 
      // But usually there is a /candidate/applications/{id}
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Application...</p>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 uppercase italic">Signal Lost</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6">{error || "Could not retrieve application data"}</p>
          <button 
            onClick={() => router.back()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
          <Activity className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Active Link Established</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Briefcase className="h-40 w-40" />
        </div>
        
        <div className="space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">{app.status.replace('_', ' ')}</span>
          </div>

          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              {app.job?.title || "Unknown Role"}
            </h1>
            <div className="flex items-center gap-4 mt-4 text-slate-500">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-bold uppercase tracking-tight">{app.job?.location || "Remote"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="md:col-span-2 space-y-8">
          {/* Interview Status if Active */}
          {activeInterview && (
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200 border-4 border-indigo-500/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase italic tracking-tight">Interview Protocol</h3>
                    <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">Round {activeInterview.round_number}: {activeInterview.round_name}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                  {activeInterview.status}
                </div>
              </div>

              {activeInterview.status === 'scheduled' && activeInterview.meeting_link && (() => {
                  // Standardize time comparison to IST
                  const now = new Date();
                  // For a very accurate comparison, we should adjust local 'now' to Asia/Kolkata
                  // However, comparing UTC-to-UTC or parsing both as Date objects works if they both have offsets.
                  // Database times are UTC, coming from API as ISO strings.
                  
                  const slot = activeInterview.interview_slots?.find(s => s.is_selected);
                  if (!slot) return null;
                  
                  const start = new Date(slot.start_time);
                  const end = new Date(slot.end_time);
                  
                  // RELAXED WINDOW FOR TESTING: 24h before to 24h after
                  const allowedStart = new Date(start.getTime() - 24 * 60 * 60000);
                  const allowedEnd = new Date(end.getTime() + 24 * 60 * 60000);
                  
                  const isActive = now >= allowedStart && now <= allowedEnd;

                  return (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 text-indigo-50 mb-2">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-wide">Confirmed Timing (IST)</span>
                        </div>
                        <p className="text-lg font-black tracking-tight italic">
                          {start.toLocaleString('en-IN', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'Asia/Kolkata'
                            })}
                        </p>
                      </div>
                      <button 
                        disabled={!isActive}
                        onClick={async () => {
                          try {
                            const token = awsAuth.getToken();
                            if (token) {
                              apiClient.post(`/interviews/${activeInterview.id}/join-event`, {}, token);
                            }
                          } catch (err) {
                            console.error("Failed to signal join:", err);
                          }
                          window.open(activeInterview.meeting_link, '_blank');
                        }}
                        className={`w-full py-4 rounded-2xl font-black uppercase italic tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 ${
                          isActive ? "bg-white text-indigo-600 hover:bg-slate-50" : "bg-white/20 text-indigo-300 cursor-not-allowed"
                        }`}
                      >
                        {isActive ? "Enter Meeting Room" : now < start ? "Link Not Yet Active" : "Meeting Link Expired"}
                        {isActive && <ArrowRight className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* Job Description */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-slate-400" />
              <h3 className="font-black text-slate-900 uppercase italic">Transmission Brief</h3>
            </div>
            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {app.job?.description || "Mission parameters under encryption. Please contact support for full briefing."}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Calendar className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Applied on</span>
              </div>
              <p className="font-bold text-slate-900">
                {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <User className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Interviewer</span>
              </div>
              <p className="font-bold text-slate-900">
                {activeInterview?.interviewer_names?.join(', ') || "Awaiting Assignment"}
              </p>
            </div>
          </div>

          {app.feedback && (
            <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100 italic relative">
               <div className="absolute -top-3 -left-3 bg-emerald-500 text-white p-2 rounded-xl shadow-lg">
                <CheckCircle2 className="h-4 w-4" />
               </div>
               <p className="text-emerald-800 text-sm font-medium leading-relaxed">
                "{app.feedback}"
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
