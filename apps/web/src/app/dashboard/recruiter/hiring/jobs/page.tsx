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
  Share2,
  DollarSign,
  Workflow,
  Lock,
  Mail,
  Phone,
  Send,
  TrendingUp,
  X,
  ChevronRight,
} from "lucide-react";
import JobInviteModal from "@/components/JobInviteModal";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import LockedView from "@/components/dashboard/LockedView";
import ShareJobModal from "@/components/ShareJobModal";
import { toast } from "sonner";

interface Job {
  id: string;
  title: string;
  description: string;
  status: "active" | "closed" | "paused";
  experience_band: string;
  job_type: string;
  location: string;
  number_of_positions: number;
  salary_range?: string;
  created_at: string;
  recruiter_id: string;
  matching_candidates_count?: number;
  applications_count?: number;
  skills_required?: string[];
  requirements?: string[];
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
  const [sharingJob, setSharingJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [viewMode, setViewMode] = useState<"details" | "matches">("details");
  const [matchingCandidates, setMatchingCandidates] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [inviteCandidate, setInviteCandidate] = useState<any | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<any | null>(null);
  const [loadingCandidateDetails, setLoadingCandidateDetails] = useState(false);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [chatThreads, setChatThreads] = useState<any[]>([]);

  const hasAccessToPersonalInfo = (candidateId: string): boolean => {
    const thread = chatThreads.find(t => t.candidate_id === candidateId);
    if (thread && !thread.is_active) {
      return false;
    }
    const candidateApplications = pipelineData.filter(app => app.candidate_id === candidateId || app.app?.candidate_id === candidateId);
    return candidateApplications.some(app => {
      const appStatus = (app.status || app.app?.status || '').toLowerCase();
      if (appStatus === 'rejected') return false;
      const isSensitiveStatus = ['applied', 'shortlisted', 'interview_scheduled', 'offered', 'hired'].includes(appStatus);
      const hasInviteReply = app.invite_message_replied || app.has_replied_to_invite || false;
      return isSensitiveStatus || hasInviteReply;
    });
  };

  const getDisplayName = (fullName: string, candidateId: string): string => {
    if (hasAccessToPersonalInfo(candidateId)) {
      return fullName;
    }
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}**** ${parts[parts.length - 1].charAt(0)}****`;
    }
    return parts[0].charAt(0) + '****';
  };

  const loadMatchingCandidates = async (job: Job) => {
    setSelectedJob(job);
    setViewMode("matches");
    setLoadingMatches(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const data = await apiClient.get(`/recruiter/jobs/${job.id}/recommended-candidates`, token);
      setMatchingCandidates(data || []);
    } catch (err) {
      console.error("Failed to load matching candidates:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const viewCandidateDetails = async (candidate: any) => {
    setActiveCandidate(candidate);
    setLoadingCandidateDetails(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/analytics/profile/${candidate.user_id}/view`, {}, token).catch(() => {});
      const fullData = await apiClient.get(`/recruiter/candidate/${candidate.user_id}`, token);
      if (fullData) {
        setActiveCandidate((prev: any) => prev && prev.user_id === candidate.user_id ? { ...prev, ...fullData } : prev);
      }
    } catch (err) {
      console.error("Failed to fetch candidate details:", err);
    } finally {
      setLoadingCandidateDetails(false);
    }
  };

  const handleInviteFromModal = async (candidateId: string, jobId: string, message: string, customTitle?: string) => {
    setInviteLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(
        `/recruiter/candidate/${candidateId}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );
      toast.success("Invitation sent successfully!");
      setInviteModalOpen(false);
      const [threadsResponse, pipelineResponse] = await Promise.all([
        apiClient.get("/chat/threads", token),
        apiClient.get("/recruiter/applications/pipeline", token)
      ]);
      setChatThreads(threadsResponse || []);
      setPipelineData(pipelineResponse || []);
    } catch (error: any) {
      console.error("Failed to send invite:", error);
      toast.error(error.message || "Failed to send invitation. Please try again.");
    } finally {
      setInviteLoading(false);
      setInviteCandidate(null);
    }
  };

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

        const [jobsData, profileData, viewsData, pipelineResponse, threadsResponse] = await Promise.all([
          apiClient.get("/recruiter/jobs", token),
          apiClient.get("/recruiter/profile", token),
          apiClient.get("/analytics/recruiter/recent-job-views", token).catch(() => ({ recent_views: [] })),
          apiClient.get("/recruiter/applications/pipeline", token).catch(() => []),
          apiClient.get("/chat/threads", token).catch(() => []),
        ]);
        setJobs(jobsData);
        setProfile(profileData);
        setRecentJobViews(viewsData.recent_views || []);
        setPipelineData(pipelineResponse || []);
        setChatThreads(threadsResponse || []);
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
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, status: newStatus as Job["status"] });
      }
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
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
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
              <div className="hidden lg:block flex-shrink-0 px-5 py-4 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
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
                  <div className="flex gap-4 min-h-0 h-full overflow-hidden">
                    {/* Left Column: Jobs List */}
                    <div className={`jobs-scroll overflow-y-auto flex-1 pr-1 space-y-3 h-full max-h-full ${selectedJob ? "block" : "grid grid-cols-1 gap-4 xl:grid-cols-2 lg:space-y-0"}`}>
                      {filteredJobs.map((job) => {
                        const isSelected = selectedJob?.id === job.id;
                        return (
                          <article
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className={`group cursor-pointer flex flex-col justify-between transition-all duration-200 bg-white border shadow-sm ${
                              selectedJob
                                ? `rounded-xl p-3.5 hover:shadow-md ${
                                    isSelected ? "border-[#FF8A00] ring-1 ring-[#FF8A00]" : "border-slate-150 hover:border-orange-200"
                                  }`
                                : "rounded-2xl p-4 hover:border-orange-200 hover:shadow-md border-slate-150"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50/50 border border-orange-100 group-hover:bg-[#FFF6ED] transition-colors">
                                    <Briefcase className="h-4 w-4 text-[#FF8A00]" />
                                  </div>
                                  <div className="min-w-0">
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

                              {/* Badges Row - Fixed Layout */}
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5" title="Location">
                                  <MapPin className="h-3 w-3 text-slate-450" />
                                  {job.location || "Remote"}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5" title="Experience">
                                  <Briefcase className="h-3 w-3 text-slate-455" />
                                  {getExperienceBandLabel(job.experience_band)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5" title="Work Mode">
                                  <Workflow className="h-3 w-3 text-slate-450" />
                                  {job.job_type ? (job.job_type === "onsite" ? "On-site" : job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)) : "Work Mode"}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5" title="Salary Range">
                                  <DollarSign className="h-3 w-3 text-slate-450" />
                                  {job.salary_range || "Salary Not Set"}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5" title="Positions">
                                  <Users className="h-3 w-3 text-slate-450" />
                                  {job.number_of_positions} {job.number_of_positions === 1 ? "Opening" : "Openings"}
                                </span>
                              </div>

                              <p className="mt-2.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
                                {job.description || "No description provided."}
                              </p>

                              {job.skills_required && job.skills_required.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Skills:</span>
                                  {job.skills_required.slice(0, 3).map((skill, index) => (
                                    <span
                                      key={index}
                                      className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {job.skills_required.length > 3 && (
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider self-center ml-0.5">
                                      +{job.skills_required.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Compact Footer metrics in the same line with applications button */}
                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>

                              <div className="flex items-center gap-3 text-slate-400">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/dashboard/recruiter/hiring/applications?job=${job.id}`);
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-[#FF8A00] transition"
                                  title="Applicants"
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  <span>{job.applications_count || 0}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadMatchingCandidates(job);
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-[#FF8A00] transition"
                                  title="Pool Matches"
                                >
                                  <Users className="h-3.5 w-3.5" />
                                  <span>{job.matching_candidates_count || 0}</span>
                                </button>
                                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400" title="Views">
                                  <Activity className="h-3.5 w-3.5" />
                                  <span>{getJobViewCount(job.id)}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSharingJob(job);
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#FF8A00] hover:text-[#FF8A00] hover:bg-orange-50/10 active:scale-95"
                                  title="Share Role"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/dashboard/recruiter/hiring/applications?job=${job.id}`);
                                  }}
                                  className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                                >
                                  Applications
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Right Column: Detailed Job View Panel / Matching Candidates Panel */}
                    {selectedJob && viewMode === "details" && (
                      <div className="w-[420px] shrink-0 bg-white border border-slate-100 rounded-2xl p-4 flex flex-col min-h-0 h-full overflow-hidden shadow-sm">
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-start justify-between pb-3.5 border-b border-slate-100">
                          <div className="min-w-0 pr-2">
                            <h2 className="text-sm font-black text-slate-800 leading-snug line-clamp-2">{selectedJob.title}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{profile?.companies?.name || "Your Company"}</p>
                          </div>
                          <button
                            onClick={() => setSelectedJob(null)}
                            className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition"
                          >
                            <XCircle className="w-5 h-5 text-slate-400 hover:text-slate-650" />
                          </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 jobs-scroll">
                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/60">
                              <span className="text-slate-400 uppercase block text-[8px] tracking-wider">Location</span>
                              <span className="text-slate-700 mt-0.5 block truncate">{selectedJob.location || "Remote"}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/60">
                              <span className="text-slate-400 uppercase block text-[8px] tracking-wider">Experience</span>
                              <span className="text-slate-700 mt-0.5 block truncate">{getExperienceBandLabel(selectedJob.experience_band)}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/60">
                              <span className="text-slate-400 uppercase block text-[8px] tracking-wider">Work Mode</span>
                              <span className="text-slate-700 mt-0.5 block truncate">
                                {selectedJob.job_type ? (selectedJob.job_type === "onsite" ? "On-site" : selectedJob.job_type.charAt(0).toUpperCase() + selectedJob.job_type.slice(1)) : "Work Mode"}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/60">
                              <span className="text-slate-400 uppercase block text-[8px] tracking-wider">Salary Range</span>
                              <span className="text-slate-700 mt-0.5 block truncate">{selectedJob.salary_range || "Not Set"}</span>
                            </div>
                            <button
                              onClick={() => loadMatchingCandidates(selectedJob)}
                              className="bg-orange-50/30 hover:bg-orange-50/80 rounded-xl p-2 border border-orange-100/60 cursor-pointer text-left transition flex flex-col justify-between"
                            >
                              <span className="text-[#FF8A00] uppercase block text-[8px] tracking-wider font-bold">Pool Matches</span>
                              <span className="text-slate-800 mt-0.5 block text-xs font-black">
                                {selectedJob.matching_candidates_count || 0} Matches
                              </span>
                            </button>
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/60 flex flex-col justify-between">
                              <span className="text-slate-400 uppercase block text-[8px] tracking-wider">Open Positions</span>
                              <span className="text-slate-700 mt-0.5 block text-xs font-bold">
                                {selectedJob.number_of_positions} {selectedJob.number_of_positions === 1 ? "Vacancy" : "Vacancies"}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Job Description</h3>
                            <p className="text-xs leading-relaxed text-slate-600 whitespace-pre-line bg-slate-50/30 p-2.5 rounded-xl border border-slate-100/50">
                              {selectedJob.description || "No description provided."}
                            </p>
                          </div>

                          {/* Key Skills */}
                          {selectedJob.skills_required && selectedJob.skills_required.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Key Skills & Tools</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedJob.skills_required.map((skill, index) => (
                                  <span
                                    key={index}
                                    className="rounded-lg border border-slate-150 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Requirements */}
                          {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Role Requirements</h3>
                              <ul className="text-xs leading-relaxed text-slate-600 bg-slate-50/30 p-2.5 rounded-xl border border-slate-100/50 space-y-1">
                                {selectedJob.requirements.map((req, index) => (
                                  <li key={index} className="flex items-start gap-1.5">
                                    <span className="text-slate-400 select-none">•</span>
                                    <span>{req}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Detailed Footer Actions */}
                        <div className="flex-shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusClasses(selectedJob.status)}`}>
                              {getStatusLabel(selectedJob.status)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              Posted {new Date(selectedJob.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSharingJob(selectedJob)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95"
                              title="Share Role"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/recruiter/hiring/jobs/${selectedJob.id}/edit`)}
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/recruiter/hiring/applications?job=${selectedJob.id}`)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                            >
                              Applications
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedJob && viewMode === "matches" && (
                      <div className="w-[420px] shrink-0 bg-white border border-slate-100 rounded-2xl p-4 flex flex-col min-h-0 h-full overflow-hidden shadow-sm animate-in slide-in-from-right duration-250">
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-start justify-between pb-3.5 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)] p-2 rounded-xl border border-orange-50/10">
                          <div className="min-w-0 pr-2">
                            <h2 className="text-sm font-black text-slate-800 leading-snug">Matching Candidates</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{selectedJob.title}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => setViewMode("details")}
                              className="text-[9px] font-black uppercase tracking-wider text-[#FF8A00] hover:text-[#E67A00] px-2 py-1.5 rounded-xl hover:bg-orange-50/50 border border-orange-100 transition"
                            >
                              Job Details
                            </button>
                            <button
                              onClick={() => setSelectedJob(null)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition"
                            >
                              <XCircle className="w-5 h-5 text-slate-400 hover:text-slate-650" />
                            </button>
                          </div>
                        </div>

                        {/* Scrollable Matches list */}
                        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 jobs-scroll">
                          {loadingMatches ? (
                            <div className="flex flex-col items-center justify-center h-full py-12">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-2">Finding matching candidates...</p>
                            </div>
                          ) : matchingCandidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <Users className="h-8 w-8 text-slate-300" />
                              <p className="text-xs font-black text-slate-800 uppercase tracking-wider mt-2">No matching candidates</p>
                              <p className="text-[10px] text-slate-400 mt-1">Try updating skills required for this job.</p>
                            </div>
                          ) : (
                            matchingCandidates.map((candidate) => {
                              const score = candidate.culture_match_score || 0;
                              const isCandidateInvited = chatThreads.some(t => t.candidate_id === candidate.user_id && t.is_active);
                              const isCandidateInviteBlocked = (() => {
                                const thread = chatThreads.find(t => t.candidate_id === candidate.user_id);
                                if (thread && !thread.is_active && thread.last_message_at) {
                                  const lastMsgDate = new Date(thread.last_message_at);
                                  const diffTime = Math.abs(new Date().getTime() - lastMsgDate.getTime());
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  return diffDays <= 30;
                                }
                                return false;
                              })();

                              return (
                                <div 
                                  key={candidate.user_id} 
                                  className="group/card rounded-xl border border-slate-100 bg-white p-3 hover:shadow-md transition-all duration-200"
                                >
                                  <div className="flex items-center gap-3">
                                    {/* Circular Match Score SVG */}
                                    <div className="flex-shrink-0 relative">
                                      <svg className="w-10 h-10 transform -rotate-90">
                                        <circle cx="20" cy="20" r="18" className="stroke-slate-100" strokeWidth="2.5" fill="transparent" />
                                        <circle 
                                          cx="20" cy="20" r="18" 
                                          className="stroke-[#FF8A00] transition-all duration-500" 
                                          strokeWidth="2.5" fill="transparent"
                                          strokeDasharray="113" 
                                          strokeDashoffset={113 - (113 * score) / 100} 
                                          strokeLinecap="round" 
                                        />
                                        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="font-black text-[9px] fill-slate-800 rotate-90 origin-center">
                                          {score}%
                                        </text>
                                      </svg>
                                    </div>

                                    {/* Candidate Info */}
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-black text-slate-800 truncate">
                                        {getDisplayName(candidate.full_name, candidate.user_id)}
                                      </h4>
                                      <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{candidate.current_role || "Sales Professional"}</p>
                                      <div className="flex items-center gap-2 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>{candidate.experience}</span>
                                        <span>•</span>
                                        <span>{candidate.expected_salary ? `\u20B9${(candidate.expected_salary / 100000).toFixed(0)}L LPA` : "Flexible"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Candidate Action Buttons */}
                                  <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between gap-2">
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => viewCandidateDetails(candidate)}
                                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                                      >
                                        View Profile
                                      </button>
                                      {candidate.resume_path && (
                                        <button
                                          onClick={() => window.open(candidate.resume_path, '_blank')}
                                          className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                                        >
                                          Resume
                                        </button>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => {
                                        setInviteCandidate(candidate);
                                        setInviteModalOpen(true);
                                      }}
                                      disabled={inviteLoading || isCandidateInvited || isCandidateInviteBlocked}
                                      className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    >
                                      <Send className="h-3 w-3" />
                                      {isCandidateInvited ? "Invited" : isCandidateInviteBlocked ? "Blocked" : "Invite"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
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

      {inviteModalOpen && inviteCandidate && (
        <JobInviteModal
          candidateId={inviteCandidate.user_id}
          candidateName={inviteCandidate.full_name}
          jobs={jobs}
          onClose={() => {
            setInviteModalOpen(false);
            setInviteCandidate(null);
          }}
          onInvite={(jobId, message, customTitle) => 
            handleInviteFromModal(inviteCandidate.user_id, jobId, message, customTitle)
          }
        />
      )}

      {activeCandidate && (
        <CandidateDetailsModal
          candidate={activeCandidate}
          loading={loadingCandidateDetails}
          onClose={() => setActiveCandidate(null)}
          onInvite={() => {
            setInviteCandidate(activeCandidate);
            setInviteModalOpen(true);
            setActiveCandidate(null);
          }}
          isInvited={chatThreads.some(t => t.candidate_id === activeCandidate.user_id && t.is_active)}
          isInviteBlocked={(() => {
            const thread = chatThreads.find(t => t.candidate_id === activeCandidate.user_id);
            if (thread && !thread.is_active && thread.last_message_at) {
              const lastMsgDate = new Date(thread.last_message_at);
              const diffTime = Math.abs(new Date().getTime() - lastMsgDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 30;
            }
            return false;
          })()}
          hasAccess={hasAccessToPersonalInfo(activeCandidate.user_id)}
          getDisplayName={getDisplayName}
        />
      )}
    </div>
  );
}

interface CandidateDetailsModalProps {
  candidate: any;
  loading: boolean;
  onClose: () => void;
  onInvite: () => void;
  isInvited: boolean;
  isInviteBlocked: boolean;
  hasAccess: boolean;
  getDisplayName: (name: string, id: string) => string;
}

function CandidateDetailsModal({
  candidate,
  loading,
  onClose,
  onInvite,
  isInvited,
  isInviteBlocked,
  hasAccess,
  getDisplayName,
}: CandidateDetailsModalProps) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex-shrink-0 bg-orange-50 border border-orange-100 flex items-center justify-center text-sm font-black text-[#FF8A00]">
              {getDisplayName(candidate.full_name, candidate.user_id)[0]}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 truncate">
                {getDisplayName(candidate.full_name, candidate.user_id)}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{candidate.current_role || "Sales Professional"}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0 border border-slate-100"
          >
            <XCircle className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 jobs-scroll">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-2">Loading details...</p>
            </div>
          ) : (
            <>
              {/* circular score */}
              <div className="bg-[#FFF8F1] rounded-2xl p-4 border border-orange-100/50 flex items-center gap-4 animate-fade-in">
                <div className="flex-shrink-0 relative">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="21" className="stroke-slate-100" strokeWidth="3" fill="transparent" />
                    <circle 
                      cx="24" cy="24" r="21" 
                      className="stroke-[#FF8A00] transition-all duration-500" 
                      strokeWidth="3" fill="transparent"
                      strokeDasharray="132" 
                      strokeDashoffset={132 - (132 * (candidate.culture_match_score || 0)) / 100} 
                      strokeLinecap="round" 
                    />
                    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="font-black text-[11px] fill-slate-800 rotate-90 origin-center">
                      {candidate.culture_match_score || 0}%
                    </text>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matching Quotient</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">{candidate.match_reasoning || "Strong fit based on skills and core competencies."}</p>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="text-slate-400 uppercase block text-[8px] tracking-wider font-bold">Experience</span>
                  <span className="text-slate-700 mt-0.5 block text-xs font-bold truncate">{candidate.experience || `${candidate.years_of_experience} Years`}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="text-slate-400 uppercase block text-[8px] tracking-wider font-bold">Location</span>
                  <span className="text-slate-700 mt-0.5 block text-xs font-bold truncate">{candidate.location || "Remote"}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="text-slate-400 uppercase block text-[8px] tracking-wider font-bold">Expectation Salary</span>
                  <span className="text-slate-700 mt-0.5 block text-xs font-bold truncate">
                    {candidate.expected_salary ? `\u20B9${(candidate.expected_salary / 100000).toFixed(1)}L LPA` : "Flexible"}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="text-slate-400 uppercase block text-[8px] tracking-wider font-bold">Employment Status</span>
                  <span className="text-slate-700 mt-0.5 block text-xs font-bold truncate capitalize">{candidate.employment_readiness_status || "Exploring"}</span>
                </div>
              </div>

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <div>
                  <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">Expertise Areas</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.map((skill: string, index: number) => {
                      const isMatched = candidate.matched_skills?.includes(skill);
                      return (
                        <span
                          key={index}
                          className={`rounded-lg border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isMatched
                              ? "bg-orange-50/50 border-orange-200 text-[#FF8A00]"
                              : "bg-slate-50 border-slate-150 text-slate-600"
                          }`}
                        >
                          {skill}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Privacy locked / unlocked info */}
              {!hasAccess ? (
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5">
                  <Lock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Contact Details Masked</p>
                    <p className="text-[9px] text-amber-600/90 leading-relaxed mt-1">
                      Unlocks when candidate applies directly, is shortlisted, or replies to an invitation thread.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Contact details</h4>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                      <Mail className="h-3.5 w-3.5 text-emerald-500" />
                      {candidate.email || "Accessible"}
                    </p>
                    <p className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                      <Phone className="h-3.5 w-3.5 text-emerald-500" />
                      {candidate.phone_number || "Accessible"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-6 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/30">
          <div>
            {candidate.resume_path && (
              <button
                onClick={() => window.open(candidate.resume_path, '_blank')}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
              >
                View Resume
              </button>
            )}
          </div>

          <button
            onClick={onInvite}
            disabled={isInvited || isInviteBlocked}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            {isInvited ? "Invited" : isInviteBlocked ? "Blocked" : "Invite Candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}

