"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Clock3,
  MapPin,
  Users,
  Search,
  ArrowRight,
  Trash2,
  Edit3,
  MoreVertical,
  CheckCircle2,
  PauseCircle,
  XCircle,
  ClipboardList,
  Activity,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import LockedView from "@/components/dashboard/LockedView";

interface Job {
  id: string;
  title: string;
  description: string;
  status: "active" | "closed" | "paused";
  experience_band: string;
  job_type: string;
  location: string;
  number_of_positions: number;
  created_at: string;
  recruiter_id: string;
  recruiter_profiles?: {
    full_name: string;
    user_id: string;
  };
}

interface JobView {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email?: string;
  job_title: string;
  viewed_at: string;
}

export default function JobsManagement() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recentJobViews, setRecentJobViews] = useState<JobView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    assessment_status?: string;
    full_name?: string;
    is_verified?: boolean;
    user_id?: string;
    team_role?: "admin" | "recruiter";
    companies?: {
      profile_score: number;
      name?: string;
    };
  } | null>(null);

  const isLocked = Boolean(profile && (profile.companies?.profile_score ?? 0) === 0);

  const getExperienceBandLabel = (band: string) => {
    switch (band) {
      case "fresher":
        return "0-1 (Fresher)";
      case "mid":
        return "1-5 (Mid-level)";
      case "senior":
        return "5-10 (Senior)";
      case "leadership":
        return "10+ (Leadership)";
      default:
        return band || "Flexible";
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const [jobsData, profileData, viewsData] = await Promise.all([
          apiClient.get("/recruiter/jobs", token),
          apiClient.get("/recruiter/profile", token),
          apiClient.get("/analytics/recruiter/recent-job-views", token).catch(() => ({ recent_views: [] })),
        ]);
        setJobs(jobsData);
        setProfile(profileData);
        setRecentJobViews(viewsData.recent_views || []);
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        `/recruiter/jobs/${jobId}`,
        { status: newStatus },
        token,
      );
      setJobs(
        jobs.map((j) =>
          j.id === jobId ? { ...j, status: newStatus as Job["status"] } : j,
        ),
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this job posting? This cannot be undone.",
      )
    )
      return;

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.delete(`/recruiter/jobs/${jobId}`, token);
      setJobs(jobs.filter((j) => j.id !== jobId));
      setActiveMenu(null);
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  const getJobViewCount = (jobId: string): number => {
    return recentJobViews.filter((view) => view.job_id === jobId).length;
  };

  const stats = useMemo(() => {
    const active = jobs.filter((job) => job.status === "active").length;
    const paused = jobs.filter((job) => job.status === "paused").length;
    const closed = jobs.filter((job) => job.status === "closed").length;
    return {
      total: jobs.length,
      active,
      paused,
      closed,
      views: recentJobViews.length,
    };
  }, [jobs, recentJobViews]);

  const getStatusClasses = (status: Job["status"]) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "paused":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  const getStatusLabel = (status: Job["status"]) => {
    switch (status) {
      case "active":
        return "Open";
      case "paused":
        return "Paused";
      default:
        return "Closed";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00]"></div>
          <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">Loading hiring roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <style>{`
        .jobs-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .jobs-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .jobs-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .jobs-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .jobs-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1700px] flex-col gap-4 px-4 py-4">
      {isLocked ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)] p-12">
          <LockedView featureName="Job Management" />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[28px] border border-orange-100/80 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(255,138,0,0.08)] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Hiring Workspace</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Job management</h1>
              <p className="mt-1 text-sm text-slate-500">
                Review openings, keep the board readable, and move candidates through the pipeline without wasting vertical space.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">{stats.total} total</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{stats.active} open</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{stats.paused} paused</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">{stats.closed} closed</span>
            </div>
          </section>

          <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
              <div className="flex-shrink-0 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Hiring Roles</p>
                <p className="mt-1 text-sm text-slate-500">Organize openings and move faster on hiring decisions</p>
              </div>

              <div className="jobs-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <Link
                  href="/dashboard/recruiter/hiring/jobs/new"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#E67A00]"
                >
                  <Plus className="h-4 w-4" />
                  Create New Role
                </Link>

                <Link
                  href="/dashboard/recruiter/hiring/applications"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                >
                  <ClipboardList className="h-4 w-4" />
                  Open Candidate Pipeline
                </Link>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search role or location"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                  />
                </div>

                <div>
                  <p className="mb-2.5 text-[11px] font-bold text-slate-600">Role Status</p>
                  <div className="space-y-2">
                    {[
                      { value: "all", label: "All Roles" },
                      { value: "active", label: "Open" },
                      { value: "paused", label: "Paused" },
                      { value: "closed", label: "Closed" },
                    ].map((status) => (
                      <button
                        key={status.value}
                        onClick={() => setStatusFilter(status.value)}
                        className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                          statusFilter === status.value
                            ? "bg-[#FF8A00] text-white"
                            : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-[#FFF8F1] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C96B00]">Recent Activity</p>
                  <div className="mt-3 space-y-2">
                    {recentJobViews.length === 0 ? (
                      <p className="text-xs text-slate-500">No candidate activity yet for your roles.</p>
                    ) : (
                      recentJobViews.slice(0, 5).map((view) => (
                        <div key={view.id} className="rounded-xl border border-orange-100/70 bg-white p-2.5">
                          <p className="text-xs font-bold text-slate-900 line-clamp-1">{view.candidate_name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">Viewed {view.job_title}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#C96B00]">
                            {new Date(view.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Openings Board</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {filteredJobs.length} role{filteredJobs.length !== 1 ? "s" : ""} matching your filters
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-[#C96B00]">
                  <Activity className="h-3.5 w-3.5" />
                  Hiring in progress
                </div>
              </div>

              <div className="jobs-scroll flex-1 min-h-0 overflow-y-auto p-4">
                {filteredJobs.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-[#FFFDF9] p-10 text-center">
                    <Briefcase className="h-10 w-10 text-orange-200" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">No roles found</h3>
                    <p className="mt-1 text-sm text-slate-500">Try changing filters or create a new role to start hiring.</p>
                    <Link
                      href="/dashboard/recruiter/hiring/jobs/new"
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#FF8A00] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#E67A00]"
                    >
                      <Plus className="h-4 w-4" />
                      Create Role
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {filteredJobs.map((job) => (
                      <article
                        key={job.id}
                        className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] transition-all hover:border-orange-200 hover:shadow-[0_12px_28px_rgba(255,138,0,0.12)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-100 bg-[#FFF6ED]">
                              <Briefcase className="h-5 w-5 text-[#FF8A00]" />
                            </div>
                            <div>
                              <h2 className="text-lg font-black text-slate-900 line-clamp-1">{job.title}</h2>
                              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#C96B00]">
                                {profile?.companies?.name || "Your Company"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusClasses(job.status)}`}>
                              {getStatusLabel(job.status)}
                            </span>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(activeMenu === job.id ? null : job.id);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {activeMenu === job.id && (
                                <div
                                  className="absolute right-0 top-full z-40 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {job.status !== "active" && (
                                    <button
                                      onClick={() => {
                                        updateJobStatus(job.id, "active");
                                        setActiveMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      Mark as Open
                                    </button>
                                  )}
                                  {job.status === "active" && (
                                    <button
                                      onClick={() => {
                                        updateJobStatus(job.id, "paused");
                                        setActiveMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-amber-50 hover:text-amber-700"
                                    >
                                      <PauseCircle className="h-4 w-4" />
                                      Pause Hiring
                                    </button>
                                  )}
                                  {job.status !== "closed" && (
                                    <button
                                      onClick={() => {
                                        updateJobStatus(job.id, "closed");
                                        setActiveMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Close Role
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      router.push(`/dashboard/recruiter/hiring/jobs/${job.id}/edit`);
                                      setActiveMenu(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    Edit Role
                                  </button>
                                  <div className="my-1 h-px bg-slate-100" />
                                  <button
                                    onClick={() => deleteJob(job.id)}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Role
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                          {job.description || "No role summary added yet."}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</p>
                            <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
                              <MapPin className="h-3.5 w-3.5 text-slate-500" />
                              {job.location || "Remote"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Positions</p>
                            <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              {job.number_of_positions}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Experience</p>
                            <p className="mt-1 font-semibold text-slate-800">{getExperienceBandLabel(job.experience_band)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Candidate Views</p>
                            <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              {getJobViewCount(job.id)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            Posted {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/dashboard/recruiter/hiring/jobs/${job.id}/edit`)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit Role
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/recruiter/hiring/applications?job=${job.id}`)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00]"
                            >
                              Review Candidates
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
      </main>
    </div>
  );
}

