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

export default function JobsManagement() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
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

  const handleLogout = async () => {
    await awsAuth.logout();
    router.replace("/login");
  };

  useEffect(() => {
    async function loadData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const [jobsData, profileData] = await Promise.all([
          apiClient.get("/recruiter/jobs", token),
          apiClient.get("/recruiter/profile", token),
        ]);
        setJobs(jobsData);
        setProfile(profileData);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30">
      {isLocked ? (
        <div className="p-12 flex justify-center">
          <LockedView featureName="Job Management" />
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Top Navigation Bar */}
          <header className="bg-white/80 border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20 w-full backdrop-blur-md text-black">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                <div
                  className={`w-2 h-2 rounded-full ${
                    profile?.is_verified ? "bg-green-500" : "bg-amber-500"
                  } animate-pulse`}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {profile?.is_verified ? "Verified" : "Syncing"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 shadow-sm cursor-pointer group hover:bg-white hover:border-slate-300 transition-all">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] text-white font-black shadow-lg">
                  {profile?.full_name?.[0] || "R"}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                    Recruiter
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {profile?.full_name}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-all active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </header>

          {/* Content Container */}
          <main className="p-8 max-w-5xl mx-auto w-full">
            {/* Action Bar */}
            <div className="flex flex-col mb-10">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-900 text-white rounded-lg shadow-lg">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Global Roles
                    </span>
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                    Jobs <span className="text-indigo-600">Posted</span>
                  </h1>
                </div>

                <Link
                  href="/dashboard/recruiter/hiring/jobs/new"
                  className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-[1.25rem] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 font-black text-[10px] uppercase tracking-widest active:scale-95 group"
                >
                  <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                  Post a Job
                </Link>
              </div>

              <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md p-2 rounded-[2.5rem] border border-slate-200 shadow-sm group-focus-within:border-indigo-500 transition-all duration-500 focus-within:bg-white focus-within:shadow-indigo-100">
                <div className="relative flex-1 px-4">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200" />
                  <input
                    type="text"
                    placeholder="Search roles by title, department or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-transparent text-[11px] font-bold text-slate-900 placeholder:text-slate-200 outline-none"
                  />
                </div>
                <div className="h-8 w-px bg-slate-100" />
                <div className="flex items-center gap-1 px-2">
                  {["all", "active", "paused", "closed"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === status
                          ? "bg-slate-900 text-white shadow-lg"
                          : "bg-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredJobs.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-3 bg-white rounded-5xl p-24 text-center border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Briefcase className="w-64 h-64 -mr-16 -mt-16 text-indigo-600" />
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all duration-500">
                      <Briefcase className="w-6 h-6 text-slate-300 group-hover:text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 italic">
                      Inventory <span className="text-indigo-600">Empty</span>
                    </h3>
                    <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mb-10 max-w-xs mx-auto">
                      Your talent pipeline is currently dormant. Initialize your
                      first executive opportunity.
                    </p>
                    <Link
                      href="/dashboard/recruiter/hiring/jobs/new"
                      className="inline-flex items-center px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      Configure Role
                    </Link>
                  </div>
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="group bg-white rounded-4xl border border-slate-200 hover:border-indigo-600/30 hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.08)] transition-all duration-700 flex flex-col h-full relative cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/recruiter/hiring/jobs/${job.id}/edit`,
                      )
                    }
                  >
                    <div className="p-5 flex-1 flex flex-col">
                      {/* Compact Header: Company & Action */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 transition-all duration-500 ${
                              job.status === "active"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                : job.status === "paused"
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-50 text-slate-400"
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-extrabold text-slate-400 text-[9px] uppercase tracking-widest truncate max-w-30">
                            {profile?.companies?.name || "Partner"}
                          </span>
                        </div>

                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(
                                activeMenu === job.id ? null : job.id,
                              );
                            }}
                            className="p-1.5 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === job.id && (
                            <div
                              className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {job.status !== "active" && (
                                <button
                                  onClick={() =>
                                    updateJobStatus(job.id, "active")
                                  }
                                  className="w-full px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-3 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />{" "}
                                  ACTIVATE ROLE
                                </button>
                              )}
                              {job.status === "active" && (
                                <button
                                  onClick={() =>
                                    updateJobStatus(job.id, "paused")
                                  }
                                  className="w-full px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-3 transition-colors"
                                >
                                  <PauseCircle className="w-4 h-4 text-amber-500" />{" "}
                                  PAUSE ROLE
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  router.push(
                                    `/dashboard/recruiter/hiring/jobs/${job.id}/edit`,
                                  )
                                }
                                className="w-full px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                              >
                                <Edit3 className="w-4 h-4 text-indigo-500" />{" "}
                                EDIT DETAILS
                              </button>
                              {job.status !== "closed" && (
                                <button
                                  onClick={() =>
                                    updateJobStatus(job.id, "closed")
                                  }
                                  className="w-full px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-red-400 flex items-center gap-3 transition-colors"
                                >
                                  <XCircle className="w-4 h-4 text-red-400" />{" "}
                                  CLOSE ROLE
                                </button>
                              )}
                              <div className="h-px bg-slate-50 my-1" />
                              <button
                                onClick={() => deleteJob(job.id)}
                                className="w-full px-4 py-2.5 text-left text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" /> DELETE ROLE
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Main Role Identity */}
                      <div className="mb-4 flex-1">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            {job.status === "active" && (
                              <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-50 rounded-md border border-emerald-100">
                                <div className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">
                                  Live
                                </span>
                              </div>
                            )}
                            <span
                              className={`text-[7px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md ${
                                job.status === "active"
                                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                  : job.status === "paused"
                                    ? "bg-amber-100 text-amber-700"
                                    : job.status === "closed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {job.status}
                            </span>
                          </div>
                          <h3 className="text-base font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors uppercase leading-[1.1] truncate">
                            {job.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                              <MapPin className="w-2.5 h-2.5 text-slate-200" />
                              {job.location}
                            </div>
                            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                              <Users className="w-2.5 h-2.5 text-slate-200" />
                              {job.number_of_positions} Slots
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Horizontal Compact Footer */}
                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] font-black text-slate-200 uppercase tracking-widest">
                            ID: {job.id.slice(0, 4)}
                          </span>
                          <span className="text-slate-100 tracking-tighter mx-1">
                            &bull;
                          </span>
                          <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              "/dashboard/recruiter/hiring/applications",
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                            job.status === "active"
                              ? "bg-slate-900 text-white shadow-slate-200"
                              : "bg-white border border-slate-200 text-slate-900"
                          }`}
                        >
                          View Pipeline
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
