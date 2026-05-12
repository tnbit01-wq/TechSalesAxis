"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Building2,
  Clock,
  AlertCircle,
  Calendar,
  Video,
  Search,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight,
  CheckCheck,
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_40%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)]">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00] mb-4"></div>
        <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <style>{`
        .apps-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .apps-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1700px] flex-col gap-4 px-4 py-4">
        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Sidebar Filters */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white/90 shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex-shrink-0 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Applications</p>
              <p className="mt-1 text-sm text-slate-500">Track your progress</p>
            </div>

            <div className="apps-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search jobs, companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                />
              </div>

              {/* Status Filters */}
              <div>
                <label className="mb-2.5 block text-[11px] font-bold text-slate-600">Status</label>
                <div className="space-y-2">
                  {[
                    { value: "all", label: "All Applications", icon: null },
                    { value: "applied", label: "Applied", icon: null },
                    { value: "shortlisted", label: "Shortlisted", icon: null },
                    { value: "interview_scheduled", label: "Interview", icon: null },
                    { value: "offered", label: "Offered", icon: null },
                    { value: "rejected", label: "Rejected", icon: null },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setFilterStatus(status.value)}
                      className={`w-full text-left px-3 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
                        filterStatus === status.value
                          ? "bg-[#FF8A00] text-white"
                          : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Card */}
              <div className="rounded-2xl border border-orange-100 bg-[#FFF8F1] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C96B00]">Overview</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Total Applied</span>
                    <span className="font-black text-slate-900">{applications.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">In Progress</span>
                    <span className="font-black text-slate-900">
                      {applications.filter(a => 
                        ["applied", "shortlisted", "interview_scheduled"].includes(a.status)
                      ).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Offers</span>
                    <span className="font-black text-emerald-600">
                      {applications.filter(a => a.status === "offered").length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <Link
                href="/dashboard/candidate/jobs"
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-[#FFF6ED] px-3 py-2.5 text-xs font-bold text-[#FF8A00] transition-all hover:bg-[#FFEFD8] w-full justify-center"
              >
                <Zap className="h-4 w-4" />
                Explore Jobs
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white/85 shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex-shrink-0 border-b border-orange-100/70 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Your Applications</h2>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">
                    {filteredApplications.length} {filteredApplications.length === 1 ? "application" : "applications"} • 
                    {applications.filter(a => ["shortlisted", "interview_scheduled", "offered"].includes(a.status)).length} active
                  </p>
                </div>
              </div>
            </div>

            {/* Applications List */}
            <div className="apps-scroll flex-1 min-h-0 overflow-y-auto">
              {filteredApplications.length === 0 && applications.length > 0 ? (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center">
                    <Search className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-900">No matches found</h3>
                    <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
                  </div>
                </div>
              ) : applications.length === 0 ? (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center max-w-sm">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-[#FFF6ED] flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-[#FF8A00]" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
                    <p className="text-slate-500 text-sm mt-2">
                      Start by exploring and applying to jobs that match your interests
                    </p>
                    <Link
                      href="/dashboard/candidate/jobs"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#FF8A00] text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider mt-4 transition-all hover:bg-[#E67A00]"
                    >
                      <Zap className="h-4 w-4" />
                      Find Jobs
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  {filteredApplications.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => router.push(`/dashboard/candidate/applications/${app.id}`)}
                      className="group cursor-pointer rounded-[20px] border border-orange-100/60 bg-white hover:border-[#FF8A00]/40 transition-all duration-300 hover:shadow-[0_12px_32px_rgba(255,138,0,0.12)] overflow-hidden"
                    >
                      <div className="h-1 bg-gradient-to-r from-[#FF8A00] via-[#FFB366] to-[#FFE3BF]" />
                      
                      <div className="p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          {/* Left: Job Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#FFF6ED] to-[#FFE3BF] flex items-center justify-center flex-shrink-0 border border-orange-100">
                                <Building2 className="h-6 w-6 text-[#FF8A00]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-[#FF8A00] transition-colors">
                                  {app.job_title}
                                </h3>
                                <p className="text-[11px] font-bold text-[#C96B00] uppercase tracking-wider">
                                  {app.company_name}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Right: Status & Actions */}
                          <div className="flex items-center gap-3 md:justify-end">
                            {/* Status Badge */}
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
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
                                        : "bg-slate-100 text-slate-700"
                            }`}>
                              {app.status === "applied" && "Applied"}
                              {app.status === "shortlisted" && "Shortlisted"}
                              {app.status === "interview_scheduled" && "Interview"}
                              {app.status === "offered" && "Offered"}
                              {app.status === "rejected" && "Rejected"}
                            </div>

                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#FF8A00] transition-colors" />
                          </div>
                        </div>

                        {/* Info Row */}
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold">
                              {new Date(app.applied_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                          </div>
                          {app.active_interview?.status && (
                            <div className="flex items-center gap-1">
                              {app.active_interview.status === "scheduled" && (
                                <>
                                  <Calendar className="h-4 w-4 text-purple-400" />
                                  <span className="font-semibold">Interview Scheduled</span>
                                </>
                              )}
                              {app.active_interview.status === "pending_confirmation" && (
                                <>
                                  <AlertCircle className="h-4 w-4 text-amber-400" />
                                  <span className="font-semibold">Pending Confirmation</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Interview Actions */}
                        {app.active_interview?.status === "pending_confirmation" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInterviewId(app.active_interview?.id || "");
                              setIsModalOpen(true);
                            }}
                            className="mt-3 w-full md:w-auto px-3 py-2 bg-purple-50 text-purple-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Calendar className="h-4 w-4" />
                            Pick Interview Slot
                          </button>
                        )}

                        {app.active_interview?.status === "scheduled" && app.active_interview?.meeting_link && (() => {
                          const now = new Date();
                          const confirmedSlot = app.active_interview.interview_slots?.find((s: any) => s.is_selected);
                          if (!confirmedSlot) return null;

                          const start = new Date(confirmedSlot.start_time);
                          const end = new Date(confirmedSlot.end_time);
                          const allowedStart = new Date(start.getTime() - 15 * 60 * 1000);
                          const fiveAfterStart = new Date(start.getTime() + 5 * 60 * 1000);
                          const allowedEnd = fiveAfterStart < end ? fiveAfterStart : end;
                          const isActive = now >= allowedStart && now <= allowedEnd;

                          return (
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
                                    return;
                                  }
                                }
                                if (app.active_interview?.meeting_link) {
                                  window.open(app.active_interview.meeting_link, "_blank");
                                }
                              }}
                              className={`mt-3 w-full md:w-auto px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
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
                          );
                        })()}

                        {/* Feedback */}
                        {app.feedback && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Feedback</p>
                              <p className="text-xs text-blue-700 mt-1">
                                {app.feedback}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </main>

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
