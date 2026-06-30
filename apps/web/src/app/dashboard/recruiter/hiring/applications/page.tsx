"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  MapPin,
  Search,
  UserCheck,
  Users,
  Video,
  XCircle,
  ArrowRight,
  ClipboardList,
  Mail,
  Phone,
  Lock,
  Unlock,
  FileText,
  ChevronLeft,
  User,
  Plus,
  Award,
  Sparkles,
  Send,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RejectionModal from "@/components/RejectionModal";
import ShortlistModal from "@/components/ShortlistModal";
import InterviewScheduler from "@/components/InterviewScheduler";
import InterviewFeedbackModal from "@/components/InterviewFeedbackModal";
import LockedView from "@/components/dashboard/LockedView";
import { toast } from "sonner";

interface Application {
  id: string;
  status: string;
  feedback: string | null;
  created_at: string;
  job_id: string;
  candidate_id: string;
  jobs: {
    id: string;
    title: string;
    status: string;
    location: string | null;
    created_at: string;
  };
  candidate_profiles: {
    user_id: string;
    full_name: string;
    current_role: string | null;
    years_of_experience: number | null;
    phone_number: string | null;
    location: string | null;
    gender: string | null;
    birthdate: string | null;
    referral: string | null;
    bio: string | null;
    profile_photo_url: string | null;
    email?: string | null;
    resume_path?: string | null;
    skills?: string[] | string | null;
    is_shadow?: boolean;
  };
  resume_data?: {
    raw_text?: string | Record<string, any>;
    timeline?: any[];
    education?: any;
    achievements?: string[];
    skills?: string[];
  } | null;
  profile_scores?: {
    final_score: number;
  } | null;
  is_skill_match?: boolean;
  interviews?: any[];
}

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  job_type?: string;
  experience_band?: string;
}

const statusOptions = [
  { value: "all", label: "All Stages" },
  { value: "applied", label: "Applied" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview_scheduled", label: "Interview" },
  { value: "offered", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    interviewId: string;
    applicationId: string;
    candidateName: string;
    roundName: string;
    recruiterJoinedAt: string | null;
    candidateJoinedAt: string | null;
  }>({
    isOpen: false,
    interviewId: "",
    applicationId: "",
    candidateName: "",
    roundName: "",
    recruiterJoinedAt: null,
    candidateJoinedAt: null,
  });

  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "name-asc" | "score-desc">("newest");
  const [selectedJobId, setSelectedJobId] = useState<string>(searchParams.get("job") || "");
  const [detailTab, setDetailTab] = useState<"overview" | "resume" | "interview">("overview");

  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const [profile, setProfile] = useState<{
    companies?: {
      profile_score: number;
    };
  } | null>(null);

  const isLocked = Boolean(profile && (profile.companies?.profile_score ?? 0) === 0);

  useEffect(() => {
    const jobParam = searchParams.get("job");
    if (jobParam) {
      setSelectedJobId(jobParam);
    }
  }, [searchParams]);

  const fetchApplications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const [data, interviewData, profileData, jobsData] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token),
        apiClient.get("/interviews/my", token),
        apiClient.get("/recruiter/profile", token).catch(() => null),
        apiClient.get("/recruiter/jobs", token).catch(() => []),
      ]);

      const appsData = (data || []).map((app: any) => ({
        ...app,
        interviews: (interviewData || []).filter((i: any) => i.application_id === app.id),
      }));

      setApplications(appsData);
      setJobs(jobsData || []);
      setProfile(profileData);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchApplications();
    const interval = setInterval(fetchApplications, 60000);
    return () => clearInterval(interval);
  }, [fetchApplications]);

  const trackProfileView = async (candidateId: string, jobId?: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const url = jobId
        ? `/analytics/profile/${candidateId}/view?job_id=${jobId}`
        : `/analytics/profile/${candidateId}/view`;

      await apiClient.post(url, {}, token);
    } catch (err) {
      console.error("Failed to track profile view:", err);
    }
  };

  const handleBulkStatusChange = async (status: string, feedback?: string) => {
    const targets = activeApplicationId ? [activeApplicationId] : selectedApps;
    if (targets.length === 0) return;

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/applications/bulk-status",
        {
          application_ids: targets,
          status,
          feedback,
        },
        token,
      );

      toast.success(`Candidate status updated to ${getStatusLabel(status)}`);
      setIsRejectionModalOpen(false);
      setIsShortlistModalOpen(false);
      setSelectedApps([]);
      setActiveApplicationId(null);
      fetchApplications();
    } catch (err) {
      console.error("Failed to update statuses:", err);
      toast.error("Failed to update candidate status.");
    }
  };

  const getJobApplicationCount = (jobId: string) => {
    return applications.filter((app) => app.job_id === jobId).length;
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const nameMatch = (app.candidate_profiles?.full_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const roleMatch = (app.candidate_profiles?.current_role || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const jobMatch = (app.jobs?.title || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === "all" || app.status === filterStatus;
      const openingMatch = !selectedJobId || app.job_id === selectedJobId;

      // Experience Level Filter
      let expMatch = true;
      const yoe = app.candidate_profiles?.years_of_experience || 0;
      if (filterExperience === "junior") {
        expMatch = yoe < 3;
      } else if (filterExperience === "mid") {
        expMatch = yoe >= 3 && yoe <= 7;
      } else if (filterExperience === "senior") {
        expMatch = yoe > 7;
      }

      // Sourcing Channel Filter
      let sourceMatch = true;
      const referral = app.candidate_profiles?.referral;
      const isShadow = app.candidate_profiles?.is_shadow;
      const isInvited = app.status === "invited";

      if (filterSource === "referral") {
        sourceMatch = !!referral;
      } else if (filterSource === "sourced") {
        sourceMatch = !!isShadow || isInvited;
      } else if (filterSource === "direct") {
        sourceMatch = !referral && !isShadow && !isInvited;
      }

      return (nameMatch || roleMatch || jobMatch) && statusMatch && openingMatch && expMatch && sourceMatch;
    });
  }, [applications, searchTerm, filterStatus, selectedJobId, filterExperience, filterSource]);

  const sortedApplications = useMemo(() => {
    const items = [...filteredApplications];
    items.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === "name-asc") {
        return (a.candidate_profiles?.full_name || "").localeCompare(
          b.candidate_profiles?.full_name || "",
        );
      }
      return (b.profile_scores?.final_score || 0) - (a.profile_scores?.final_score || 0);
    });
    return items;
  }, [filteredApplications, sortOrder]);

  // Sync selectedAppId to first application in filtered list if not present
  useEffect(() => {
    if (sortedApplications.length > 0) {
      if (!sortedApplications.some((app) => app.id === selectedAppId)) {
        setSelectedAppId(sortedApplications[0].id);
      }
    } else {
      setSelectedAppId(null);
    }
  }, [sortedApplications, selectedAppId]);

  const selectedApp = useMemo(() => {
    return applications.find((app) => app.id === selectedAppId) || null;
  }, [applications, selectedAppId]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "applied":
        return "Applied";
      case "shortlisted":
        return "Shortlisted";
      case "interview_scheduled":
        return "Interview";
      case "offered":
        return "Offer";
      case "closed":
        return "Hired";
      case "rejected":
        return "Rejected";
      default:
        return status.replace(/_/g, " ");
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "applied":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "shortlisted":
        return "bg-amber-50 text-[#C96B00] border-amber-200";
      case "interview_scheduled":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "offered":
      case "closed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getScore = (app: Application) => {
    const raw = app.profile_scores?.final_score;
    if (!raw) return "-";
    return raw > 1 ? `${raw.toFixed(0)}%` : `${(raw * 100).toFixed(0)}%`;
  };

  const exportToCSV = () => {
    if (sortedApplications.length === 0) return;

    const headers = ["Role", "Location", "Candidate", "Applied Date", "Stage", "Score"];
    const rows = sortedApplications.map((app) => [
      app.jobs?.title || "N/A",
      app.jobs?.location || "Remote",
      app.candidate_profiles?.full_name || "Unknown",
      new Date(app.created_at).toLocaleDateString(),
      getStatusLabel(app.status),
      getScore(app),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `TechSalesAxis_Applications_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelect = (id: string) => {
    setSelectedApps((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const hasAccessToPersonalInfo = (app: Application) => {
    return !!(app.candidate_profiles?.email && app.candidate_profiles.email.includes("@")) && app.status !== "rejected";
  };

  const getDisplayName = (fullName: string, app: Application): string => {
    if (hasAccessToPersonalInfo(app)) {
      return fullName;
    }
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}**** ${parts[parts.length - 1].charAt(0)}****`;
    }
    return parts[0].charAt(0) + "****";
  };

  const getTimeline = (app: Application) => {
    const resume = app.resume_data;
    if (resume && Array.isArray(resume.timeline)) return resume.timeline;
    return [];
  };

  const getEducation = (app: Application) => {
    const resume = app.resume_data;
    return resume?.education || null;
  };

  const getSkills = (app: Application) => {
    const candSkills = app.candidate_profiles?.skills;
    if (Array.isArray(candSkills)) return candSkills;
    if (typeof candSkills === "string" && candSkills) {
      return candSkills.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const resumeSkills = app.resume_data?.skills;
    if (Array.isArray(resumeSkills)) return resumeSkills;
    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00]"></div>
          <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">
            Loading candidates...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.03),_transparent_40%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900">
      <style>{`
        .pipeline-scroll {
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }
        .pipeline-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .pipeline-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .pipeline-scroll::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 999px;
        }
        .pipeline-scroll::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="h-full w-full max-w-[1600px] mx-auto px-4 py-3 flex flex-col overflow-hidden">
        {isLocked ? (
          <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-orange-100/80 bg-white p-12 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
            <LockedView featureName="Candidate Pipeline" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden space-y-3.5">
            {/* Highly Compact Header row */}
            <div className="flex items-center justify-between gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(15,23,42,0.015)] flex-shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <h1 className="text-sm font-black tracking-tight text-slate-950 shrink-0">Applicants</h1>
                
                {/* Compact Selector Dropdown */}
                <div className="relative max-w-xs w-full flex items-center shrink-0">
                  <Briefcase className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full appearance-none cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-8 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] transition-all"
                  >
                    <option value="">All Job Postings ({applications.length})</option>
                    {jobs.map((job) => {
                      const count = getJobApplicationCount(job.id);
                      return (
                        <option key={job.id} value={job.id}>
                          {job.title} ({count})
                        </option>
                      );
                    })}
                  </select>
                  <span className="pointer-events-none absolute right-3 text-slate-400 text-[8px]">▼</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={exportToCSV}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
                <Link
                  href="/dashboard/recruiter/hiring/jobs"
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Manage Jobs
                </Link>
              </div>
            </div>

            {/* Split Layout: Left candidate list & Right details view */}
            <div className="flex-1 flex min-h-0 gap-4 overflow-hidden relative">
              {/* Left Pane: Candidates list */}
              <div
                className={`w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col min-h-0 bg-white border border-slate-100 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.015)] overflow-hidden lg:flex ${
                  selectedAppId && "hidden lg:flex"
                }`}
              >
                {/* Search and Sourcing/Experience Filter Controls */}
                <div className="p-4 border-b border-slate-100 space-y-2.5 bg-slate-50/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search applicant or title..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-150 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF8A00]/5"
                    />
                  </div>

                  {/* Sourcing and Experience Filters */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filterExperience}
                      onChange={(e) => setFilterExperience(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#FF8A00]/50 focus:ring-2 focus:ring-[#FF8A00]/5 cursor-pointer"
                    >
                      <option value="all">All Experience</option>
                      <option value="junior">Junior (&lt; 3 yrs)</option>
                      <option value="mid">Mid-Level (3-7 yrs)</option>
                      <option value="senior">Senior (7+ yrs)</option>
                    </select>

                    <select
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#FF8A00]/50 focus:ring-2 focus:ring-[#FF8A00]/5 cursor-pointer"
                    >
                      <option value="all">All Sources</option>
                      <option value="direct">Direct Apply</option>
                      <option value="referral">Referrals</option>
                      <option value="sourced">Sourced / Pool</option>
                    </select>
                  </div>

                  {/* Sort Selection */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                      Sort List
                    </span>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-700 outline-none focus:border-[#FF8A00]/50"
                    >
                      <option value="newest">Newest first</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="score-desc">Match Score</option>
                    </select>
                  </div>
                </div>

                {/* Horizontal Recruitment Stages navigation */}
                <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none px-4 bg-slate-50/20">
                  {statusOptions.map((status) => {
                    const count = applications.filter((app) => {
                      const matchesJob = !selectedJobId || app.job_id === selectedJobId;
                      const matchesSearch = !searchTerm || 
                        (app.candidate_profiles?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (app.candidate_profiles?.current_role || "").toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStatus = status.value === "all" || app.status === status.value;
                      
                      // Experience Filter
                      let expMatch = true;
                      const yoe = app.candidate_profiles?.years_of_experience || 0;
                      if (filterExperience === "junior") {
                        expMatch = yoe < 3;
                      } else if (filterExperience === "mid") {
                        expMatch = yoe >= 3 && yoe <= 7;
                      } else if (filterExperience === "senior") {
                        expMatch = yoe > 7;
                      }

                      // Source Filter
                      let sourceMatch = true;
                      const referral = app.candidate_profiles?.referral;
                      const isShadow = app.candidate_profiles?.is_shadow;
                      const isInvited = app.status === "invited";
                      if (filterSource === "referral") {
                        sourceMatch = !!referral;
                      } else if (filterSource === "sourced") {
                        sourceMatch = !!isShadow || isInvited;
                      } else if (filterSource === "direct") {
                        sourceMatch = !referral && !isShadow && !isInvited;
                      }

                      return matchesJob && matchesSearch && matchesStatus && expMatch && sourceMatch;
                    }).length;

                    return (
                      <button
                        key={status.value}
                        onClick={() => setFilterStatus(status.value)}
                        className={`flex items-center gap-1.5 py-3 px-2 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all relative ${
                          filterStatus === status.value
                            ? "border-[#FF8A00] text-[#FF8A00]"
                            : "border-transparent text-slate-400 hover:text-slate-650"
                        }`}
                      >
                        <span>{status.label}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                          filterStatus === status.value
                            ? "bg-[#FF8A00]/10 text-[#FF8A00]"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Candidate list view scroll area */}
                <div className="flex-1 overflow-y-auto pipeline-scroll p-4 space-y-3">
                  {sortedApplications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ClipboardList className="h-10 w-10 text-orange-200" />
                      <p className="mt-3 text-xs font-bold text-slate-500">No applicants found</p>
                      <p className="mt-1 text-[10px] text-slate-400 leading-relaxed max-w-[200px]">
                        Try checking another stage or search term.
                      </p>
                    </div>
                  ) : (
                    sortedApplications.map((app) => {
                      const displayName = getDisplayName(app.candidate_profiles.full_name, app);
                      const isSelected = selectedAppId === app.id;
                      
                      return (
                        <article
                          key={app.id}
                          onClick={() => {
                            trackProfileView(app.candidate_id, app.job_id);
                            setSelectedAppId(app.id);
                          }}
                          className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-3 relative ${
                            isSelected
                              ? "border-[#FF8A00] bg-orange-50/5 shadow-sm"
                              : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedApps.includes(app.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(app.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 h-3.5 w-3.5 cursor-pointer rounded border-slate-350 accent-[#FF8A00]"
                              />
                              <div className="min-w-0">
                                <h3 className={`text-xs font-bold text-slate-800 truncate ${
                                  isSelected ? "text-[#FF8A00]" : "group-hover:text-[#FF8A00]"
                                }`}>
                                  {displayName}
                                </h3>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 line-clamp-1">
                                  {app.candidate_profiles?.current_role || "Role not specified"}
                                </p>
                              </div>
                            </div>

                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClasses(app.status)} flex-shrink-0`}>
                              {getStatusLabel(app.status)}
                            </span>
                          </div>

                          {/* Quick details */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-slate-500 max-w-[120px]">
                              <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{app.jobs?.title}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-[#FFF7EE] border border-orange-100 px-1.5 py-0.5 text-[#C96B00] font-black">
                              Score: {getScore(app)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-slate-500">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{app.candidate_profiles?.location || "Remote"}</span>
                            </span>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedApps.length > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 bg-[#FFFBF7] p-4.5 animate-in slide-in-from-bottom duration-250">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#C96B00]">
                      {selectedApps.length} Selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={!applications.filter((app) => selectedApps.includes(app.id)).every((app) => app.status === "applied")}
                        onClick={() => {
                          setActiveApplicationId(null);
                          setIsShortlistModalOpen(true);
                        }}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Shortlist
                      </button>
                      <button
                        onClick={() => {
                          setActiveApplicationId(null);
                          setIsRejectionModalOpen(true);
                        }}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Pane: Detailed applicant view */}
              <div
                className={`flex-1 flex flex-col min-h-0 bg-white border border-slate-100 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.015)] overflow-hidden ${
                  !selectedAppId && "hidden lg:flex"
                }`}
              >
                {selectedApp ? (
                  <div className="h-full flex flex-col min-h-0">
                    {/* Back Button on Mobile */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20 shrink-0">
                      <button
                        onClick={() => setSelectedAppId(null)}
                        className="lg:hidden inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-all border border-slate-200 bg-white rounded-lg px-2.5 py-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back to list
                      </button>
                      
                      <div className="hidden lg:block">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Applicant Details
                        </span>
                      </div>

                      <span className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${getStatusClasses(selectedApp.status)}`}>
                        Stage: {getStatusLabel(selectedApp.status)}
                      </span>
                    </div>

                    {/* Candidate Details Header */}
                    <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-gradient-to-r from-orange-50/10 to-transparent">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-100 to-orange-50 flex items-center justify-center ring-2 ring-orange-200/50 flex-shrink-0 text-[#FF8A00] font-black text-sm uppercase">
                          {selectedApp.candidate_profiles?.full_name?.substring(0, 2) || "C"}
                        </div>

                        <div className="min-w-0">
                          <h2 className="text-base font-black text-slate-850 flex items-center gap-2">
                            {getDisplayName(selectedApp.candidate_profiles.full_name, selectedApp)}
                            {hasAccessToPersonalInfo(selectedApp) ? (
                              <span title="Unlocked Contact Info"><Unlock className="h-3.5 w-3.5 text-emerald-500" /></span>
                            ) : (
                              <span title="Locked Contact Info"><Lock className="h-3.5 w-3.5 text-amber-500" /></span>
                            )}
                          </h2>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {selectedApp.candidate_profiles?.current_role || "Role not specified"}
                          </p>
                          
                          {/* Masked / Unmasked Contact details */}
                          <div className="flex items-center gap-3 mt-2">
                            {hasAccessToPersonalInfo(selectedApp) ? (
                              <>
                                <span className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
                                  <Mail className="h-3.5 w-3.5 text-emerald-500" />
                                  {selectedApp.candidate_profiles.email}
                                </span>
                                {selectedApp.candidate_profiles.phone_number && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-600 font-bold border-l border-slate-200 pl-3">
                                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                    {selectedApp.candidate_profiles.phone_number}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50/50 border border-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                Contact Masked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Circular Match Score */}
                      <div className="flex-shrink-0 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        <div className="relative">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="21" className="stroke-slate-200" strokeWidth="2.5" fill="transparent" />
                            <circle
                              cx="24"
                              cy="24"
                              r="21"
                              className="stroke-[#FF8A00] transition-all duration-500"
                              strokeWidth="2.5"
                              fill="transparent"
                              strokeDasharray="132"
                              strokeDashoffset={132 - (132 * (selectedApp.profile_scores?.final_score || 0)) / 100}
                              strokeLinecap="round"
                            />
                            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="font-black text-[10px] fill-slate-800 rotate-90 origin-center">
                              {Math.round(selectedApp.profile_scores?.final_score || 0)}%
                            </text>
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Match score</span>
                          <span className="text-[10px] font-black text-[#C96B00] uppercase tracking-wider mt-0.5">IT Sales Match</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Pipeline Ribbon */}
                    <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Actions
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Direct PDF View button */}
                        {selectedApp.candidate_profiles.resume_path && (
                          <button
                            onClick={() => window.open(selectedApp.candidate_profiles.resume_path!, '_blank')}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95 shadow-xs"
                          >
                            <FileText className="h-3.5 w-3.5 text-[#FF8A00]" />
                            View Resume (PDF)
                          </button>
                        )}

                        {/* Standard pipeline actions */}
                        {selectedApp.status === "applied" && (
                          <button
                            onClick={() => {
                              setActiveApplicationId(selectedApp.id);
                              setIsShortlistModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Shortlist Candidate
                          </button>
                        )}

                        {(selectedApp.status === "shortlisted" || (selectedApp.status === "interview_scheduled" && selectedApp.interviews?.some((i) => i.status === "pending_confirmation"))) && (
                          <button
                            onClick={() => {
                              setActiveApplicationId(selectedApp.id);
                              setIsInterviewModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {selectedApp.interviews?.some((i) => i.status === "pending_confirmation") ? "Update Slots" : "Schedule Interview"}
                          </button>
                        )}

                        {selectedApp.status === "interview_scheduled" && selectedApp.interviews?.some((i) => i.status === "scheduled") && (() => {
                          const activeInterview = selectedApp.interviews.find((i) => i.status === "scheduled");
                          if (!activeInterview) return null;
                          const confirmedSlot = activeInterview.interview_slots?.find((s: any) => s.is_selected) || activeInterview.slots?.find((s: any) => s.is_selected);
                          const now = new Date();
                          const start = confirmedSlot ? new Date(confirmedSlot.start_time) : new Date();
                          const end = confirmedSlot ? new Date(confirmedSlot.end_time) : new Date();
                          const allowedStart = new Date(start.getTime() - 15 * 60 * 1000);
                          const allowedEnd = end;
                          const isActive = now >= allowedStart && now <= allowedEnd;
                          const isLocked = now < allowedStart;

                          return (
                            <>
                              {activeInterview.meeting_link && (
                                <button
                                  disabled={!isActive}
                                  onClick={async () => {
                                    try {
                                      const token = awsAuth.getToken();
                                      if (token) {
                                        apiClient.post(`/interviews/${activeInterview.id}/join-event`, { role: "recruiter" }, token);
                                      }
                                    } catch (err) {
                                      console.error("Failed to signal join:", err);
                                    }
                                    window.open(activeInterview.meeting_link, "_blank");
                                  }}
                                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-4 py-1 text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${
                                    isActive
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md cursor-pointer"
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  }`}
                                >
                                  <Video className="h-3.5 w-3.5" />
                                  {isActive ? "Join Call" : isLocked ? "Join Call (Locked)" : "Join Call (Expired)"}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setFeedbackModal({
                                    isOpen: true,
                                    interviewId: activeInterview.id,
                                    applicationId: selectedApp.id,
                                    candidateName: selectedApp.candidate_profiles.full_name || "Candidate",
                                    roundName: activeInterview.round_name,
                                    recruiterJoinedAt: activeInterview.recruiter_joined_at,
                                    candidateJoinedAt: activeInterview.candidate_joined_at,
                                  });
                                }}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-[#C96B00] transition hover:bg-orange-100 active:scale-95"
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                Log Feedback
                              </button>
                            </>
                          );
                        })()}

                        {/* Reject button */}
                        {["applied", "shortlisted"].includes(selectedApp.status) && (
                          <button
                            onClick={() => {
                              setActiveApplicationId(selectedApp.id);
                              setIsRejectionModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-rose-250 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50 active:scale-95"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabs for details */}
                    <div className="flex border-b border-slate-100 bg-slate-50/10 shrink-0">
                      {[
                        { id: "overview", label: "Overview", icon: ClipboardList },
                        { id: "resume", label: "Resume Info", icon: FileText, disabled: !selectedApp.candidate_profiles.resume_path },
                        { id: "interview", label: "Interviews", icon: Video },
                      ].map((t) => (
                        <button
                          key={t.id}
                          disabled={t.disabled}
                          onClick={() => setDetailTab(t.id as any)}
                          className={`flex items-center gap-2 py-3 px-5 text-xs font-black uppercase tracking-wider border-b-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                            detailTab === t.id
                              ? "border-[#FF8A00] text-[#FF8A00] bg-white"
                              : "border-transparent text-slate-400 hover:text-slate-650 hover:bg-slate-50/30"
                          }`}
                        >
                          <t.icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable details contents */}
                    <div className="flex-1 overflow-y-auto pipeline-scroll p-6 space-y-6">
                      {detailTab === "overview" && (
                        <div className="space-y-6">
                          {/* Bio */}
                          <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Candidate Bio
                            </h3>
                            <p className="text-xs font-semibold text-slate-605 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                              {selectedApp.candidate_profiles?.bio || "Candidate has not provided a professional bio yet."}
                            </p>
                          </div>

                          {/* Skill alignment */}
                          <div className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Skills Summary
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {getSkills(selectedApp).length === 0 ? (
                                <span className="text-xs text-slate-400">No skills declared in profile.</span>
                              ) : (
                                getSkills(selectedApp).map((skill: string) => (
                                  <span
                                    key={skill}
                                    className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-tighter"
                                  >
                                    {skill}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Education */}
                          <div className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Education Background
                            </h3>
                            {(() => {
                              const edu = getEducation(selectedApp);
                              if (!edu) return <p className="text-xs text-slate-400">No education data uploaded.</p>;
                              return (
                                <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                                  <div className="p-2 bg-orange-50 border border-orange-100 rounded-xl text-[#FF8A00] shrink-0">
                                    <Award className="h-4.5 w-4.5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-800">{edu.degree || "Degree"}</h4>
                                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{edu.institution || "Institution"}</p>
                                    {edu.year && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{edu.year}</p>}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Experience Timeline */}
                          <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Work History
                            </h3>
                            {getTimeline(selectedApp).length === 0 ? (
                              <p className="text-xs text-slate-400">No experience timeline uploaded.</p>
                            ) : (
                              <div className="relative border-l border-slate-150 pl-4 space-y-5 ml-2.5">
                                {getTimeline(selectedApp).map((entry: any, index: number) => (
                                  <div key={index} className="relative">
                                    <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white shadow-xs" />
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-850">
                                        {entry.role || entry.title || "Sales Executive"}
                                      </h4>
                                      <p className="text-[10px] font-bold text-[#C96B00] mt-0.5">
                                        {entry.company || "Tech Company"}
                                      </p>
                                      {entry.description && (
                                        <p className="text-[10px] text-slate-450 leading-normal mt-1.5 font-semibold">
                                          {entry.description}
                                        </p>
                                      )}
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                        {entry.start || "N/A"} — {entry.end || "Present"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {detailTab === "resume" && (
                        <div className="space-y-6">
                          {selectedApp.candidate_profiles.resume_path && (
                            <div className="bg-orange-50/20 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-[#FF8A00] shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800">Original Resume PDF</h4>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Open in a clean browser tab for complete viewing</p>
                                </div>
                              </div>
                              <button
                                onClick={() => window.open(selectedApp.candidate_profiles.resume_path!, '_blank')}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#E67A00] active:scale-95"
                              >
                                Open PDF
                              </button>
                            </div>
                          )}

                          {/* Render Parsed Resume Details */}
                          <div className="space-y-5">
                            {/* Skills Section */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Extracted Skills</h4>
                              <div className="flex flex-wrap gap-1.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                {getSkills(selectedApp).length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">No skills extracted.</span>
                                ) : (
                                  getSkills(selectedApp).map((skill: string) => (
                                    <span key={skill} className="px-2 py-1 bg-white border border-slate-150 rounded-lg text-[9px] font-bold text-slate-700 uppercase tracking-tight">
                                      {skill}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Timeline Section */}
                            <div className="space-y-2.5">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Parsed Work Experience</h4>
                              {getTimeline(selectedApp).length === 0 ? (
                                <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-slate-100">No experience details parsed.</p>
                              ) : (
                                <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                  {getTimeline(selectedApp).map((entry: any, index: number) => (
                                    <div key={index} className="border-l-2 border-orange-200 pl-3.5">
                                      <h5 className="text-xs font-bold text-slate-800">{entry.role || entry.title || "Sales Executive"}</h5>
                                      <p className="text-[10px] font-bold text-[#C96B00] mt-0.5">{entry.company || "Tech Company"}</p>
                                      {entry.description && <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-semibold">{entry.description}</p>}
                                      <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1">{entry.start || "N/A"} — {entry.end || "Present"}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Education Section */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Parsed Education</h4>
                              {(() => {
                                const edu = getEducation(selectedApp);
                                if (!edu) return <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-slate-100">No education details parsed.</p>;
                                return (
                                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                                    <div className="p-2 bg-white border border-slate-150 rounded-xl text-slate-500 shrink-0">
                                      <Award className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-800">{edu.degree || "Degree"}</h5>
                                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{edu.institution || "Institution"}</p>
                                      {edu.year && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{edu.year}</p>}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {detailTab === "interview" && (
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                            Interview Logs & Feedback
                          </h3>

                          {(!selectedApp.interviews || selectedApp.interviews.length === 0) ? (
                            <div className="text-center py-8 border border-dashed border-slate-100 rounded-2xl">
                              <Video className="h-8 w-8 text-slate-200 mx-auto" />
                              <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mt-2">
                                No interviews scheduled yet
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedApp.interviews.map((item: any) => (
                                <div key={item.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30">
                                  <div className="flex items-center justify-between border-b border-slate-100/50 pb-2.5">
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-850">{item.round_name || `Round ${item.round_number}`}</h4>
                                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-0.5">
                                        Type: {item.interview_type || "Video"}
                                      </p>
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                      item.status === "scheduled"
                                        ? "bg-blue-50 text-blue-700 border-blue-100"
                                        : item.status === "completed"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                    }`}>
                                      {item.status.replace(/_/g, " ")}
                                    </span>
                                  </div>

                                  {/* Slots or Details */}
                                  <div className="pt-3 text-[10px] text-slate-650 space-y-2">
                                    {item.feedback && (
                                      <div className="bg-orange-50/30 border border-orange-100/50 rounded-xl p-3">
                                        <span className="text-[8px] font-black uppercase text-[#C96B00] tracking-wider block mb-1">Feedback Logged</span>
                                        <p className="font-semibold text-slate-600">{item.feedback}</p>
                                      </div>
                                    )}
                                    
                                    {/* Slot selector confirm details */}
                                    {(() => {
                                      const confirmed = item.interview_slots?.find((s: any) => s.is_selected) || item.slots?.find((s: any) => s.is_selected);
                                      if (confirmed) {
                                        return (
                                          <div className="flex flex-col gap-1.5 font-semibold text-slate-500">
                                            <p className="flex items-center gap-1.5">
                                              <Calendar className="h-3.5 w-3.5 text-slate-450" />
                                              Confirmed Date: <span className="text-slate-805 font-bold">{new Date(confirmed.start_time).toLocaleString()}</span>
                                            </p>
                                          </div>
                                        );
                                      }
                                      return (
                                        <p className="text-slate-450 font-semibold italic">Waiting on slots selection...</p>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center p-12 bg-slate-50/20">
                    <Users className="h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 text-xs font-black text-slate-800 uppercase tracking-wider">No Applicant Selected</h3>
                    <p className="mt-1.5 text-[10px] text-slate-400 font-semibold leading-relaxed max-w-[280px]">
                      Select a candidate from the left list to review their timeline, profile details, and trigger pipeline actions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => {
          setIsRejectionModalOpen(false);
          setActiveApplicationId(null);
        }}
        onConfirm={(reason) => handleBulkStatusChange("rejected", reason)}
        count={activeApplicationId ? 1 : selectedApps.length}
      />

      <ShortlistModal
        isOpen={isShortlistModalOpen}
        onClose={() => {
          setIsShortlistModalOpen(false);
          setActiveApplicationId(null);
        }}
        onConfirm={(feedback) => handleBulkStatusChange("shortlisted", feedback)}
        count={activeApplicationId ? 1 : selectedApps.length}
      />

      {feedbackModal.isOpen && (
        <InterviewFeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
          interviewId={feedbackModal.interviewId}
          applicationId={feedbackModal.applicationId}
          candidateName={feedbackModal.candidateName}
          roundName={feedbackModal.roundName}
          recruiterJoinedAt={feedbackModal.recruiterJoinedAt}
          candidateJoinedAt={feedbackModal.candidateJoinedAt}
          onSuccess={() => {
            setFeedbackModal({ ...feedbackModal, isOpen: false });
            fetchApplications();
          }}
        />
      )}

      {isInterviewModalOpen && activeApplicationId && (
        <InterviewScheduler
          candidateName={
            applications.find((item) => item.id === activeApplicationId)?.candidate_profiles.full_name || "Candidate"
          }
          applicationId={activeApplicationId}
          jobTitle={applications.find((item) => item.id === activeApplicationId)?.jobs?.title}
          initialRoundNumber={
            (applications.find((item) => item.id === activeApplicationId)?.interviews?.length || 0) + 1
          }
          onClose={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
          }}
          onSuccess={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
            fetchApplications();
          }}
        />
      )}
    </div>
  );
}
