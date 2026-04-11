"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Clock,
  AlertCircle,
  Calendar,
  Video,
  Search,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
      setApplications(appsData);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Filter applications based on search and status
  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Applications</h1>
          <p className="text-slate-500 text-sm mt-1">Track your applied positions and upcoming interviews.</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by job title, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Application Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer font-medium text-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="applied">Applied</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview</option>
              <option value="offered">Offered</option>
              <option value="rejected">Rejected</option>
            </select>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApplications.length === 0 && applications.length > 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <Search className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No matching applications found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <FileText className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
            <p className="text-slate-500 text-sm">Start applying to jobs to see them here.</p>
          </div>
        ) : (
          filteredApplications.map((app) => (
            <div
              key={app.id}
              className="group bg-white rounded-3xl border border-slate-200 hover:shadow-md transition-all flex flex-col h-full relative cursor-pointer p-5"
              onClick={() =>
                router.push(`/dashboard/candidate/applications/${app.id}`)
              }
            >
              {/* Company Icon & Status Badge */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-colors flex-shrink-0">
                  <FileText className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <div>
                <span
                  className={`text-[7px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md ${
                    app.status === "applied"
                      ? "bg-blue-100 text-blue-700"
                      : app.status === "shortlisted"
                        ? "bg-emerald-100 text-emerald-700"
                        : app.status === "interview_scheduled"
                          ? "bg-purple-100 text-purple-700"
                          : app.status === "offered"
                            ? "bg-amber-100 text-amber-700"
                            : app.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {app.status.replace(/_/g, " ")}
                </span>
                </div>
              </div>

              {/* Job Title & Company */}
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1">
                  {app.job_title}
                </h3>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-indigo-600 uppercase tracking-wider">{app.company_name}</span>
                </div>
                
                {/* Status Progress Indicator */}
                <div className="mt-2 pt-2 border-t border-slate-50/50">
                  <div className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mb-1">Progress</div>
                  <div className="flex items-center gap-1">
                    {["applied", "shortlisted", "interview_scheduled", "offered"].map((stage) => (
                      <div 
                        key={stage}
                        className={`h-1 flex-1 rounded-full ${
                          ["applied", "shortlisted", "interview_scheduled", "offered"].indexOf(app.status) >= ["applied", "shortlisted", "interview_scheduled", "offered"].indexOf(stage)
                            ? "bg-indigo-600"
                            : "bg-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Interview Section */}
              {app.active_interview?.status === "pending_confirmation" && (
                <div className="mt-2 pt-2 border-t border-slate-50/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInterviewId(app.active_interview?.id || "");
                      setIsModalOpen(true);
                    }}
                    className="w-full px-2 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-[8px] uppercase tracking-wider hover:bg-indigo-100 transition flex items-center justify-center gap-2"
                  >
                    <Calendar className="h-3 w-3" />
                    Pick Interview Slot
                  </button>
                </div>
              )}

              {app.active_interview?.status === "scheduled" && app.active_interview?.meeting_link && (() => {
                const now = new Date();
                const confirmedSlot = app.active_interview.interview_slots?.find((s: any) => s.is_selected);
                if (!confirmedSlot) return null;

                const start = new Date(confirmedSlot.start_time);
                const end = new Date(confirmedSlot.end_time);
                
                // NEW PROTOCOL: Join opens 15m before START 
                const allowedStart = new Date(start.getTime() - 15 * 60 * 1000);
                const fiveAfterStart = new Date(start.getTime() + 5 * 60 * 1000);
                
                // Cannot join after end time
                const allowedEnd = fiveAfterStart < end ? fiveAfterStart : end;
                const isActive = now >= allowedStart && now <= allowedEnd;

                return (
                  <div className="mt-2 pt-2 border-t border-slate-50/50">
                    <button
                      disabled={!isActive}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const token = awsAuth.getToken();
                        if (token) {
                          try {
                            await apiClient.post(`/interviews/${app.active_interview?.id}/join-event`, { role: "candidate" }, token);
                          } catch (err: any) {
                            console.error("Failed to signal join:", err);
                            // If backend rejects, don't open meeting
                            return;
                          }
                        }
                        if (app.active_interview?.meeting_link) {
                          window.open(app.active_interview.meeting_link, "_blank");
                        }
                      }}
                      className={`w-full px-2 py-1.5 rounded-lg font-bold text-[8px] uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                        isActive
                          ? "bg-indigo-600 text-white hover:bg-slate-900 shadow-lg shadow-indigo-200"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Video className="h-3 w-3" />
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

              {/* Applied Date & Actions */}
              <div className="mt-2 pt-2 border-t border-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                  <Clock className="w-2 h-2" />
                  {new Date(app.applied_at).toLocaleDateString()}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/candidate/applications/${app.id}`)
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Feedback */}
              {app.feedback && (
                <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 flex items-start gap-2">
                  <AlertCircle className="h-2.5 w-2.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[8px] text-indigo-700 font-medium line-clamp-2">
                    {app.feedback}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
