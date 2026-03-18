"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronRight,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Video,
} from "lucide-react";
import CandidateInterviewConfirmModal from "@/components/CandidateInterviewConfirmModal";

interface Application {
  id: string;
  job_title: string;
  company_name: string;
  status: string;
  applied_at: string;
  feedback?: string;
  metadata?: {
    interview_link?: string;
    interview_time?: string;
  };
  active_interview?: {
    id: string;
    status: string;
    meeting_link?: string;
    round_number?: number;
    round_name?: string;
    interview_slots?: Array<{
      id: string;
      start_time: string;
      end_time: string;
      is_selected: boolean;
    }>;
  };
}

export default function CandidateApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const appsData = await apiClient.get(
        "/candidate/applications",
        token,
      );
      console.log("DEBUG: Refreshing Candidate Applications Data", appsData);
      setApplications(appsData);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds to catch schedule changes
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
              Active{" "}
              <span className="text-indigo-600 font-black">Transmissions</span>
            </h1>
            <div className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-200">
              Applications
            </div>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
            <Activity className="h-3 w-3 text-emerald-500" />
            Real-time tracking of your position within the hiring funnel.
          </p>
        </div>
      </header>

      {applications.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-20 border border-slate-200 border-dashed text-center">
          <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-400 mb-2">
            No Active Applications
          </h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">
            You haven&apos;t initiated any application signals yet.
          </p>
          <button
            onClick={() => router.push("/dashboard/candidate/feed")}
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            Explore Role Feed
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-4xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {app.job_title}
                    </h3>
                  </div>
                  <p className="text-slate-500 font-bold text-sm mb-4">
                    {app.company_name}
                  </p>

                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {app.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* If an interview is scheduled, show the protocol button */}
                  {app.active_interview?.status === "scheduled" &&
                    app.active_interview?.meeting_link && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100 animate-in fade-in zoom-in duration-500">
                          <Clock className="h-3 w-3" />
                          {(() => {
                            const slot =
                              app.active_interview?.interview_slots?.find(
                                (s: any) => s.is_selected,
                              );
                            if (!slot) return "Pending Coord...";
                            return new Date(slot.start_time).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                              timeZone: "Asia/Kolkata"
                            });
                          })()}
                        </div>
                        {(() => {
                          const slot = app.active_interview?.interview_slots?.find((s: any) => s.is_selected);
                          const now = new Date();
                          
                          // Handle cases where no slot is selected for display but UI expects it
                          if (!slot) return null;

                          const start = new Date(slot.start_time);
                          
                          // Window Strategy: Join opens 15m before START until 10m AFTER start
                          const allowedStart = new Date(start.getTime() - 15 * 60000);
                          const allowedEnd = new Date(start.getTime() + 10 * 60000);
                          const nowInBrowser = new Date();
                          const isActive = nowInBrowser >= allowedStart && nowInBrowser <= allowedEnd;

                          if (isActive) {
                            return (
                              <button
                                onClick={async () => {
                                  try {
                                    const token = awsAuth.getToken();
                                    if (token) {
                                      apiClient.post(`/interviews/${app.active_interview?.id}/join-event`, { role: "candidate" }, token);
                                    }
                                  } catch (err) {
                                    console.error("Failed to signal join:", err);
                                  }
                                  app.active_interview?.meeting_link && window.open(
                                    app.active_interview.meeting_link,
                                    "_blank",
                                  );
                                }}
                                className={`px-6 py-2.5 ${app.active_interview?.status === "in_progress" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"} text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center gap-2 shadow-lg active:scale-95`}
                              >
                                <Video className="h-3.5 w-3.5" />
                                {app.active_interview?.status === "in_progress" ? "Live Stream Active" : "Initiate Meeting Protocol"}
                              </button>
                            );
                          }
                          return (
                            <div className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-100 italic">
                              {nowInBrowser < allowedStart 
                                ? "Secure: Locked Until Start (15m before)" 
                                : "Window Closed (10m Late)"}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  {/* If an interview is pending confirmation from the candidate */}
                  {app.active_interview?.status === "pending_confirmation" && (
                    <div className="flex flex-col items-end gap-2 px-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        Round {app.active_interview.round_number}: {app.active_interview.round_name}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedInterviewId(app.active_interview?.id || "");
                          setIsModalOpen(true);
                        }}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition flex items-center gap-2 animate-pulse shadow-lg shadow-indigo-100"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Pick Slot
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      router.push(`/dashboard/candidate/applications/${app.id}`)
                    }
                    className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {app.feedback && (
                <div className="mt-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-indigo-500 mt-0.5" />
                  <p className="text-[11px] text-indigo-700 font-medium leading-relaxed italic">
                    &quot;{app.feedback}&quot;
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CandidateInterviewConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        interviewId={selectedInterviewId || ""}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
