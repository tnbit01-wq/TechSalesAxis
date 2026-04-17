"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Settings,
  Clock,
  MapPin,
  Building2,
  Users,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  Edit3,
  MoreVertical,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
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

  const isLocked = profile && (profile.companies?.profile_score ?? 0) === 0;

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

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getJobViewCount = (jobId: string): number => {
    return recentJobViews.filter((view) => view.job_id === jobId).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      {isLocked ? (
        <div className="p-12 flex justify-center">
          <LockedView featureName="Job Management" />
        </div>
      ) : (
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Job Openings</h1>
              <p className="text-slate-500 text-sm mt-1">Manage your active job postings.</p>
            </div>

            <Link
              href="/dashboard/recruiter/hiring/jobs/new"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shadow-md flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <Plus className="h-4 w-4" />
              Post a Job
            </Link>
          </header>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["all", "active", "paused", "closed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    statusFilter === status
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-20 text-center">
              <Briefcase className="h-10 w-10 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No jobs found</h3>
              <p className="text-slate-500 text-sm mt-1">Post your first job to get started recruiting.</p>
              <Link
                href="/dashboard/recruiter/hiring/jobs/new"
                className="mt-6 inline-flex px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors gap-2"
              >
                <Plus className="h-4 w-4" />
                Post a Job
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all flex flex-col group cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/recruiter/hiring/jobs/${job.id}/edit`)
                  }
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 group-hover:bg-blue-100 transition-colors">
                      <Briefcase className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === job.id ? null : job.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenu === job.id && (
                        <div
                          className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl opacity-100 visible z-50 p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.status !== "active" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateJobStatus(job.id, "active");
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors flex items-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Activate
                            </button>
                          )}
                          {job.status === "active" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateJobStatus(job.id, "paused");
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-amber-600 transition-colors flex items-center gap-2"
                            >
                              <PauseCircle className="w-4 h-4" />
                              Pause
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/dashboard/recruiter/hiring/jobs/${job.id}/edit`,
                              );
                            }}
                            className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                          {job.status !== "closed" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateJobStatus(job.id, "closed");
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-red-400 transition-colors flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Close
                            </button>
                          )}
                          <div className="h-px bg-slate-100 my-1 mx-2" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteJob(job.id);
                            }}
                            className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-base font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {job.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                        {profile?.companies?.name || "Company"}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span className="text-[10px] text-slate-500">{job.location || "Remote"}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        {getJobViewCount(job.id) > 0 && (
                          <>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Views</span>
                            <span className="text-sm font-bold text-blue-600">{getJobViewCount(job.id)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            job.status === "active"
                              ? "text-emerald-600"
                              : job.status === "paused"
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/dashboard/recruiter/hiring/applications");
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-colors"
                    >
                      View Pipeline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

