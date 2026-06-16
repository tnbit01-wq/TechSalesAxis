"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
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
  Share2,
  Target,
  Copy,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import LockedView from "@/components/dashboard/LockedView";
import ShareJobModal from "@/components/ShareJobModal";

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
  applications_count?: number;
  views_count?: number;
  matching_candidates_count?: number;
  skills_required?: string[];
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
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "mine">("all");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [sharingJob, setSharingJob] = useState<Job | null>(null);
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
      const matchesOwnership =
        ownershipFilter === "all" || job.recruiter_id === profile?.user_id;
      return matchesSearch && matchesStatus && matchesOwnership;
    });
  }, [jobs, searchTerm, statusFilter, ownershipFilter, profile]);

  const getJobViewCount = (jobId: string): number => {
    return recentJobViews.filter((view) => view.job_id === jobId).length;
  };

  const stats = useMemo(() => {
    const active = jobs.filter((job) => job.status === "active").length;
    const paused = jobs.filter((job) => job.status === "paused").length;
    const closed = jobs.filter((job) => job.status === "closed").length;
    const totalViews = jobs.reduce((sum, job) => sum + (job.views_count || 0), 0);
    return {
      total: jobs.length,
      active,
      paused,
      closed,
      views: totalViews,
    };
  }, [jobs]);

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

  if (loading) return <LoadingScreen label="Loading hiring roles..." className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" />;

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
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1700px] flex-col gap-4 px-4 py-4">
      {isLocked ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)] p-12">
          <LockedView featureName="Job Management" />
        </div>
      ) : (
        <>
          <section className="flex flex-col lg:grid lg:grid-cols-[290px_minmax(0,1fr)] min-h-0 flex-1 gap-4 overflow-hidden">
            <aside className="flex flex-col min-h-0 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden lg:h-full flex-shrink-0">
              <div className="hidden lg:block flex-shrink-0 px-5 py-4 border-b border-slate-50 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF8A00]">Hiring Directory</h2>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">Manage listings and view pipeline metrics</p>
              </div>

              <div className="flex flex-col gap-3 lg:gap-4 p-4 flex-shrink-0 lg:flex-1 lg:overflow-y-auto lg:space-y-4 lg:gap-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search role or location"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-150 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF8A00]/5"
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:block">Role Status</h3>
                  <div className="flex flex-row overflow-x-auto gap-2 lg:flex-col lg:space-y-1 lg:gap-0 scrollbar-none py-1 -mx-4 px-4 lg:mx-0 lg:px-0">
                    {[
                      { value: "all", label: "All Roles", count: stats.total, color: "text-slate-700 bg-slate-100/70" },
                      { value: "active", label: "Open", count: stats.active, color: "text-emerald-700 bg-emerald-50" },
                      { value: "paused", label: "Paused", count: stats.paused, color: "text-amber-700 bg-amber-50" },
                      { value: "closed", label: "Closed", count: stats.closed, color: "text-rose-700 bg-rose-50" },
                    ].map((status) => (
                      <button
                        key={status.value}
                        onClick={() => setStatusFilter(status.value)}
                        className={`flex items-center justify-between w-auto lg:w-full gap-2 rounded-xl px-3 py-1.5 lg:py-2 text-xs font-bold transition-all whitespace-nowrap ${
                          statusFilter === status.value
                            ? "bg-[#FF8A00] text-white shadow-md shadow-orange-100"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{status.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                          statusFilter === status.value
                            ? "bg-white/20 text-white"
                            : status.color
                        }`}>
                          {status.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Posted By</h3>
                  <div className="flex flex-col space-y-1">
                    {[
                      { value: "all", label: "Company Roles" },
                      { value: "mine", label: "My Roles Only" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setOwnershipFilter(opt.value as "all" | "mine")}
                        className={`flex items-center justify-between w-full rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          ownershipFilter === opt.value
                            ? "bg-[#FF8A00] text-white shadow-md shadow-orange-100"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 hidden lg:block">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Recent Activity</h3>
                  <div className="mt-2.5 space-y-1.5">
                    {recentJobViews.length === 0 ? (
                      <p className="text-[10px] text-slate-400">No activity logged.</p>
                    ) : (
                      recentJobViews.slice(0, 4).map((view) => (
                        <div key={view.id} className="rounded-lg border border-slate-100 bg-white p-2">
                          <p className="text-[11px] font-bold text-[#1E293B] line-clamp-1">{view.candidate_name}</p>
                          <p className="text-[9px] text-slate-400 line-clamp-1">Viewed: {view.job_title}</p>
                          <div className="mt-1 flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase">
                            <span>Activity</span>
                            <span className="text-[#FF8A00]">
                              {new Date(view.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)] flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight text-slate-900">Job Board</h1>
                  <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-black text-[#FF8A00] ring-1 ring-inset ring-orange-100">
                    {filteredJobs.length} listed
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard/recruiter/hiring/applications"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] hover:bg-orange-50/20 active:scale-95"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Applications
                  </Link>
                  <Link
                    href="/dashboard/recruiter/hiring/jobs/new"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95 shadow-md shadow-slate-200 hover:shadow-orange-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Role
                  </Link>
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
                        className="group flex flex-col justify-between rounded-2xl border border-slate-150 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition-all duration-200"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50/50 border border-orange-100 group-hover:bg-[#FFF6ED] transition-colors">
                                <Briefcase className="h-4 w-4 text-[#FF8A00]" />
                              </div>
                              <div>
                                <h2 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-slate-900 transition-colors">
                                  {job.title}
                                </h2>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                                  {profile?.companies?.name || "Your Company"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusClasses(job.status)}`}>
                                {getStatusLabel(job.status)}
                              </span>
                              
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(activeMenu === job.id ? null : job.id);
                                  }}
                                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {activeMenu === job.id && (
                                  <div
                                    className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {job.status !== "active" && (
                                      <button
                                        onClick={() => {
                                          updateJobStatus(job.id, "active");
                                          setActiveMenu(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Mark as Open
                                      </button>
                                    )}
                                    {job.status === "active" && (
                                      <button
                                        onClick={() => {
                                          updateJobStatus(job.id, "paused");
                                          setActiveMenu(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-amber-50 hover:text-amber-700"
                                      >
                                        <PauseCircle className="h-3.5 w-3.5" />
                                        Pause Hiring
                                      </button>
                                    )}
                                    {job.status !== "closed" && (
                                      <button
                                        onClick={() => {
                                          updateJobStatus(job.id, "closed");
                                          setActiveMenu(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Close Role
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        router.push(`/dashboard/recruiter/hiring/jobs/${job.id}/edit`);
                                        setActiveMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      Edit Role
                                    </button>
                                    <button
                                      onClick={() => {
                                        router.push(`/dashboard/recruiter/hiring/jobs/new?clone=${job.id}`);
                                        setActiveMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-orange-50 hover:text-[#FF8A00]"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                      Duplicate Role
                                    </button>
                                    <div className="my-1 h-px bg-slate-100" />
                                    <button
                                      onClick={() => deleteJob(job.id)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete Role
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Location">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {job.location || "Remote"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Experience">
                              <Briefcase className="h-3 w-3 text-slate-400" />
                              {getExperienceBandLabel(job.experience_band)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Positions">
                              <Users className="h-3 w-3 text-slate-400" />
                              {job.number_of_positions || 1} pos
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFF7EE] border border-orange-100 px-2 py-0.5 text-[#C96B00]" title="Views">
                              <Activity className="h-3 w-3 text-[#FF8A00]" />
                              {job.views_count || 0} views
                            </span>
                            <Link
                              href={`/dashboard/recruiter/hiring/applications?job=${job.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#EEF2FF] border border-blue-100 px-2 py-0.5 text-[#4F46E5] hover:bg-blue-100 hover:border-blue-200 transition-colors"
                              title="Applications"
                            >
                              <ClipboardList className="h-3 w-3 text-[#6366F1]" />
                              {job.applications_count || 0} applicants
                            </Link>
                            {(job.matching_candidates_count ?? 0) > 0 && (
                              <Link
                                href={`/dashboard/recruiter/talent-pool?filter=skill_match&skills=${encodeURIComponent(job.skills_required?.join(",") || "")}&location=${encodeURIComponent(job.location || "")}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 transition-colors"
                                title="Matching Candidates"
                              >
                                <Target className="h-3 w-3 text-emerald-500" />
                                {job.matching_candidates_count} matches
                              </Link>
                            )}
                          </div>

                          <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
                            {job.description || "No description provided."}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            Posted {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSharingJob(job);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#FF8A00] hover:text-[#FF8A00] hover:bg-orange-50/10 active:scale-95"
                              title="Share Role"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => router.push(`/dashboard/recruiter/hiring/applications?job=${job.id}`)}
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-slate-900 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                            >
                              Applications
                              <ArrowRight className="h-3 w-3" />
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

      {sharingJob && (
        <ShareJobModal
          job={sharingJob}
          companyName={profile?.companies?.name}
          onClose={() => setSharingJob(null)}
        />
      )}
    </div>
  );
}
